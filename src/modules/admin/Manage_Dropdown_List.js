'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Manage_Dropdown_List.cs (class Manage_Dropdown_ListController => /Manage_Dropdown_List/...)
// Database: affiliate (Db_Affiliate). Tables: tbl_ddl_master, tbl_dropdown, tbl_dropdowndetails, tbl_attributes_with_category, tbl_category,
// tbl_sub_category.
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const ddl_Master = require('../../lib/admin/ddl_Master');
const ddlMasterData = require('../../lib/admin/ddlMasterData');
const ddldetails = require('../../lib/admin/ddldetails');
const Attributes_With_Category = require('../../lib/admin/Attributes_With_Category');
const { adminAuth, isAdmin } = require('./_shared/adminSession');
const { DB, nStr, reqInt, reqLong, cvtInt, outStr, col } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Manage_Dropdown_List';

const MAINPRODUCTCATEGORY = ['CATID', 'CATNAME'];
const SUBPRODUCTCATEGORY = ['SCATID', 'SCATNAME'];
const KEYWORDADD_LIST = ['ROWNUMBER', 'KMID', 'KEYWORDNAME', 'KACTIVE', 'CATNAME', 'SCATNAME', 'CATID', 'MAINCATID'];
const ATTR_PROPS = Attributes_With_Category.PROPS || ['AWCT_ID', 'Main_Cat_ID', 'Sub_Cat_ID', 'Cat_ID', 'Att_Name', 'Att_Type', 'ddl_ID',
  'Default_Value', 'Sr_No', 'Is_Active'];

// ---------------------------------------------------------------- JsonResult AddUpdateSelectList(int ddl_ID, int parent_ddl_ID, string ddl_Name, string ddl_Text,
//   string ddl_Value, string mode, string MainCategoryId, string SubCategoryId, string CategoryId, string title)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected with adminAuth)
router.all(`/admin/${C}/AddUpdateSelectList{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ddl_ID = reqInt(req.p.ddl_ID, 'ddl_ID');
  const parent_ddl_ID = reqInt(req.p.parent_ddl_ID, 'parent_ddl_ID');
  let title = nStr(req.p.title); if (title === null) title = '';
  // DBO.IMS_USP_MANAGE_DROPDOWN_LIST @DDL_ID,@PARENT_DDL_ID,@DDL_NAME,@DDL_TEXT,@DDL_VALUE,@MODE,@MAINCATEGORYID,@SUBCATEGORYID,@CATEGORYID,@STRRESULT OUT,@Title
  const row = await db.procOne(DB, 'IMS_USP_MANAGE_DROPDOWN_LIST', {
    DDL_ID: ddl_ID, PARENT_DDL_ID: parent_ddl_ID, DDL_NAME: nStr(req.p.ddl_Name), DDL_TEXT: nStr(req.p.ddl_Text), DDL_VALUE: nStr(req.p.ddl_Value),
    MODE: nStr(req.p.mode), MAINCATEGORYID: cvtInt(nStr(req.p.MainCategoryId)), SUBCATEGORYID: cvtInt(nStr(req.p.SubCategoryId)),
    CATEGORYID: cvtInt(nStr(req.p.CategoryId)), Title: title,
  });
  return res.json(outStr(row, 'strresult'));
}));

// ---------------------------------------------------------------- JsonResult getpackagelist(Int64 urid)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/getpackagelist{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const urid = reqLong(req.p.urid, 'urid');
  const rows = await db.query(DB, 'select catid as scatid, catname as scatname from tbl_category where status = 1 and maincatid = @urid', { urid });
  return res.json(mapRows(rows, SUBPRODUCTCATEGORY));
}));

// ---------------------------------------------------------------- JsonResult getAttributetablelist(Int64 urid)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/getAttributetablelist{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  reqLong(req.p.urid, 'urid'); // bound but unused
  // Usp_Attribute_List @type,@id,@cat_Name out,@TotalCount out
  const rows = await db.proc(DB, 'Usp_Attribute_List', { type: 'subcat', id: 0 });
  return res.json(mapRows(rows, ATTR_PROPS));
}));

// ---------------------------------------------------------------- JsonResult getSubCategory(Int64 urid)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/getSubCategory{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const urid = reqLong(req.p.urid, 'urid');
  const rows = await db.query(DB, 'select subcatid as kmid, subcatname as keywordname from tbl_sub_category where status = 1 and catid = @urid', { urid });
  return res.json(mapRows(rows, KEYWORDADD_LIST));
}));

// ---------------------------------------------------------------- JsonResult AddUpdateAttributes(string type, int id, int AWCT_ID, string att_Name, string att_Type,
//   int select_DdlId, string att_Default_Value, string mode)
// auth-by-check (legacy returned Json("error^This page has been expired, Please login again.") - contract kept)
router.all(`/admin/${C}/AddUpdateAttributes{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const id = reqInt(req.p.id, 'id');
  const AWCT_ID = reqInt(req.p.AWCT_ID, 'AWCT_ID');
  const select_DdlId = reqInt(req.p.select_DdlId, 'select_DdlId');
  let Ret = '';
  if (!isAdmin(req)) {
    Ret = 'error^This page has been expired, Please login again.';
  } else {
    // Usp_Manage_Attributes_WitdCategory @type,@id,@AWCT_ID,@att_Name,@att_Type,@select_DdlId,@att_Default_Value,@ISMENDATORY,@ISSEARCH,@ISACTIVE,@mode,@strResult out
    const row = await db.procOne(DB, 'Usp_Manage_Attributes_WitdCategory', {
      type: nStr(req.p.type), id, AWCT_ID, att_Name: nStr(req.p.att_Name), att_Type: nStr(req.p.att_Type), select_DdlId,
      att_Default_Value: nStr(req.p.att_Default_Value), ISMENDATORY: false, ISSEARCH: false, ISACTIVE: true, mode: nStr(req.p.mode),
    });
    Ret = outStr(row, 'strresult');
  }
  return res.json(Ret);
}));

/** common body of both Index branches: build the Ddl_Container */
async function buildContainer(withCategories) {
  const Row = await db.query(DB, 'select ddl_id, parent_ddl_id, ddl_name, ddl_name_id, ddl_text, ddl_value, isactive, maincategoryid, subcategoryid, categoryid from tbl_ddl_master', {});
  const Row1 = await db.query(DB, 'select ddid, name, description, status from tbl_dropdown', {});
  const Row2 = await db.query(DB, 'select dddid, ddid, type, content, details, status from tbl_dropdowndetails', {});
  const Row3 = await db.query(DB, 'select awct_id, main_cat_id, sub_cat_id, cat_id, att_name, att_type, ddl_id, default_value, sr_no, is_active from tbl_attributes_with_category', {});
  const Li_Ddl_Main = []; const Li_Ddl_Child = [];
  for (const Item of Row) {
    const obj = { ...new ddl_Master() };
    obj.ddl_ID = col(Item, 'ddl_id');
    obj.parent_ddl_ID = col(Item, 'parent_ddl_id');
    obj.ddl_Name = col(Item, 'ddl_name');
    obj.ddl_Text = col(Item, 'ddl_text');
    obj.ddl_Value = col(Item, 'ddl_value');
    obj.isActive = col(Item, 'isactive');
    if (withCategories) {
      obj.MainCategoryId = cvtInt(col(Item, 'maincategoryid'));
      obj.SubCategoryId = cvtInt(col(Item, 'subcategoryid'));
      obj.CategoryId = cvtInt(col(Item, 'categoryid'));
    }
    if (Number(obj.parent_ddl_ID) === 0) Li_Ddl_Main.push(obj); else Li_Ddl_Child.push(obj);
  }
  const Li_ddlmasterdata = Row1.map((item) => ({ ...new ddlMasterData(), DDID: col(item, 'ddid'), NAME: col(item, 'name'), DESCRIPTION: col(item, 'description'), STATUS: col(item, 'status') }));
  const Li_ddldetails = Row2.map((item) => ({ ...new ddldetails(), DDDID: col(item, 'dddid'), DDID: col(item, 'ddid'), Type: col(item, 'type'), Content: col(item, 'content'), Details: col(item, 'details'), STATUS: col(item, 'status') }));
  const Li_attributescategory = mapRows(Row3, ATTR_PROPS);
  // class Ddl_Container
  return { ddl_Child: Li_Ddl_Child, ddl_Master: Li_Ddl_Main, ddl_MasterData: Li_ddlmasterdata, ddldetails: Li_ddldetails, attributescategory: Li_attributescategory };
}

// ---------------------------------------------------------------- Index(string subpagename, string type, string id)
// auth (PORT-NOTE: legacy had no session check on this admin page - protected with adminAuth)
// route-config: "AdminPanel/Manage-Dropdown-List" -> Manage_Dropdown_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manage-Dropdown-List'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const TempData = {};
  const ref = req.get('referer');
  if (ref) {
    try { ViewBag.PreviourURL = new URL(ref).pathname; } catch (_) { /* invalid referrer => Request.UrlReferrer == null */ }
  }
  let subpagename = nStr(req.p.subpagename); if (subpagename === null) subpagename = '';
  const type = nStr(req.p.type);
  let id = nStr(req.p.id);
  if (id === null || id === '') id = '0';
  else id = await UtilityClass.Decryptword(id);
  TempData.Type = type;
  TempData.Id = id;
  if (subpagename === 'deletedddl') {
    const obj2 = await buildContainer(false);
    return res.json({ view: '~/Views/Adminpanel/Deactivated_Dropdown_List/Index.cshtml', Model: obj2, ...ViewBag, TempData });
  }
  let MainCategoryId = 0; let SubCategoryId = 0; let CategoryId = 0;
  const Id = cvtInt(id);
  if (type === 'mcat') MainCategoryId = Id;
  if (type === 'cat') {
    CategoryId = Id;
    const obj = await db.queryOne(DB, 'select maincatid, catname from tbl_category where catid = @Id limit 1', { Id });
    if (obj) {
      MainCategoryId = cvtInt(String(col(obj, 'maincatid')));
      ViewBag.CatName = col(obj, 'catname');
    }
  }
  if (type === 'subcat') {
    SubCategoryId = Id;
    const obj = await db.queryOne(DB, 'select catid, maincatid, subcatname from tbl_sub_category where subcatid = @Id limit 1', { Id });
    if (obj) {
      CategoryId = cvtInt(String(col(obj, 'catid')));
      MainCategoryId = cvtInt(String(col(obj, 'maincatid')));
      ViewBag.CatName = col(obj, 'subcatname');
    }
  }
  ViewBag.MainCategoryId = MainCategoryId;
  ViewBag.SubCategoryId = SubCategoryId;
  ViewBag.CategoryId = CategoryId;
  const obj2 = await buildContainer(true);
  ViewBag.category = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 1, DDLID: 0, DDLTABLETYPE: 'TBL_MAIN_CATEGORY' }), MAINPRODUCTCATEGORY);
  ViewBag.subcategory = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 2, DDLID: 0, DDLTABLETYPE: 'TBL_CATEGORY' }), SUBPRODUCTCATEGORY);
  ViewBag.subsubcategory = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 3, DDLID: 0, DDLTABLETYPE: 'TBL_SUB_CATEGORY' }), KEYWORDADD_LIST);
  return res.json({ view: '~/Views/AdminPanel/Manage_Dropdown_List/Index.cshtml', Model: obj2, ...ViewBag, TempData });
}));

module.exports = router;
