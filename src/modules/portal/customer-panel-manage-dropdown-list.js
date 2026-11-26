'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Manage_Dropdown_List.cs (class Manage_Dropdown_ListController; DB: Db_Shopping)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Manage_Dropdown_List';
const DDL_PROPS = ['CategoryId', 'Create_Date', 'ddl_ID', 'ddl_Name', 'ddl_Name_ID', 'ddl_Text', 'ddl_Value', 'isActive', 'MainCategoryId', 'parent_ddl_ID', 'SubCategoryId'];
const isTrue = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';

/** new ddl_Master() (unset properties keep their C# defaults: null) */
const newDdl = () => { const o = {}; for (const k of DDL_PROPS) o[k] = null; return o; };

// auth (legacy: Session["PLID"] == null => Json("error^This page has been expired, Please login again."))
router.all(`${P}/AddUpdateSelectList{/:id}`, ...ps.customerOr('error^This page has been expired, Please login again.'), asyncHandler(async (req, res) => {
  const ddl_ID = c.bindInt(req, 'ddl_ID');
  const parent_ddl_ID = c.bindInt(req, 'parent_ddl_ID');
  const { ddl_Name, ddl_Text, ddl_Value, mode, MainCategoryId, SubCategoryId, CategoryId } = req.p;
  const nz = (v) => (c.isNull(v) ? null : v);
  const r = await db.procOne(DB, 'ims_usp_manage_dropdown_list', {
    ddl_id: ddl_ID, parent_ddl_id: parent_ddl_ID, ddl_name: nz(ddl_Name), ddl_text: nz(ddl_Text), ddl_value: nz(ddl_Value), mode: nz(mode),
    maincategoryid: c.toInt32(MainCategoryId), subcategoryid: c.toInt32(SubCategoryId), categoryid: c.toInt32(CategoryId),
  });
  // @STRRESULT OUT
  const Ret = r && !c.isNull(r.strresult) ? String(r.strresult) : '';
  res.json(Ret);
}));

// auth (legacy: Session["PLID"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/Manage-Dropdown-List/{type}/{id} -> Manage_Dropdown_List/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/Manage-Dropdown-List/:type/:id'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const ref = req.get('referer');
  if (ref) {
    let PreviousUrl = ref;
    try { PreviousUrl = new URL(ref).pathname; } catch (_) { /* keep raw */ }
    ViewBag.PreviourURL = PreviousUrl;
  }
  let subpagename = req.p.subpagename;
  const type = c.isNull(req.p.type) ? null : String(req.p.type);
  let id = c.isNull(req.p.id) ? null : String(req.p.id);
  if (c.isNull(subpagename)) subpagename = '';
  if (c.isNull(id) || id === '') id = '0';
  else id = await UtilityClass.Decryptword(id);

  ps.tempDataSet(req, 'Type', type);
  ps.tempDataSet(req, 'Id', id);
  const TempData = { Type: type, Id: id };

  const toDdl = (Item, withCats) => {
    const obj = newDdl();
    obj.ddl_ID = Item.ddl_id;
    obj.parent_ddl_ID = Item.parent_ddl_id;
    obj.ddl_Name = Item.ddl_name;
    obj.ddl_Text = Item.ddl_text;
    obj.ddl_Value = Item.ddl_value;
    obj.isActive = isTrue(Item.isactive);
    if (withCats) {
      obj.MainCategoryId = c.toInt32(Item.maincategoryid);
      obj.SubCategoryId = c.toInt32(Item.subcategoryid);
      obj.CategoryId = c.toInt32(Item.categoryid);
    }
    return obj;
  };

  if (subpagename === 'deletedddl') {
    const Row = await db.query(DB, `select ddl_id, parent_ddl_id, ddl_name, ddl_name_id, ddl_text, ddl_value, isactive, maincategoryid, subcategoryid, categoryid
                                      from tbl_ddl_master`);
    const Li_Ddl_Main = []; const Li_Ddl_Child = [];
    for (const Item of Row) {
      const obj = toDdl(Item, false);
      if (Number(Item.parent_ddl_id) === 0) Li_Ddl_Main.push(obj); else Li_Ddl_Child.push(obj);
    }
    const obj2 = { ddl_Child: Li_Ddl_Child, ddl_Master: Li_Ddl_Main };
    return res.json({ view: '~/Views/CustomerPanel/Deactivated_Dropdown_List/Index.cshtml', Model: obj2, ViewBag, ...ViewBag, TempData });
  }

  let MainCategoryId = 0; let SubCategoryId = 0; let CategoryId = 0;
  const Id = c.toInt32(id);
  if (type === 'mcat') {
    MainCategoryId = Id;
  }
  if (type === 'cat') {
    CategoryId = Id;
    const obj = await db.queryOne(DB, 'select maincatid, catname from tbl_category where catid = @Id limit 1', { Id });
    if (obj) {
      MainCategoryId = c.toInt32(c.isNull(obj.maincatid) ? '' : String(obj.maincatid));
      ViewBag.CatName = obj.catname;
    }
  }
  if (type === 'subcat') {
    SubCategoryId = Id;
    const obj = await db.queryOne(DB, 'select catid, maincatid, subcatname from tbl_sub_category where subcatid = @Id limit 1', { Id });
    if (obj) {
      CategoryId = c.toInt32(c.isNull(obj.catid) ? '' : String(obj.catid));
      MainCategoryId = c.toInt32(c.isNull(obj.maincatid) ? '' : String(obj.maincatid));
      ViewBag.CatName = obj.subcatname;
    }
  }
  ViewBag.MainCategoryId = MainCategoryId;
  ViewBag.SubCategoryId = SubCategoryId;
  ViewBag.CategoryId = CategoryId;

  const Row = await db.query(DB, `select ddl_id, parent_ddl_id, ddl_name, ddl_name_id, ddl_text, ddl_value, isactive, maincategoryid, subcategoryid, categoryid
                                    from tbl_ddl_master
                                   where maincategoryid = @MainCategoryId and subcategoryid = @SubCategoryId and categoryid = @CategoryId`,
  { MainCategoryId, SubCategoryId, CategoryId });
  const Li_Ddl_Main = []; const Li_Ddl_Child = [];
  for (const Item of Row) {
    const obj = toDdl(Item, true);
    if (Number(Item.parent_ddl_id) === 0) Li_Ddl_Main.push(obj); else Li_Ddl_Child.push(obj);
  }
  const obj2 = { ddl_Child: Li_Ddl_Child, ddl_Master: Li_Ddl_Main };
  return res.json({ view: '~/Views/CustomerPanel/Manage_Dropdown_List/Index.cshtml', Model: obj2, ViewBag, ...ViewBag, TempData });
}));

module.exports = router;
