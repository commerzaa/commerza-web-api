'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Manage_Attributes.cs (class Manage_AttributesController; DB: Db_Shopping)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ddl_Master = require('../../lib/portal/ddl_Master');
const Attributes_With_Category = require('../../lib/portal/Attributes_With_Category');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Manage_Attributes';
const ATT_PROPS = Attributes_With_Category.PROPS;
const DDL_PROPS = ['CategoryId', 'Create_Date', 'ddl_ID', 'ddl_Name', 'ddl_Name_ID', 'ddl_Text', 'ddl_Value', 'isActive', 'MainCategoryId', 'parent_ddl_ID', 'SubCategoryId'];

// public static Attributes_With_Category Attributes_With_CategoryDetilas(int AWCT_ID)  (static => not an MVC action; internal)
async function Attributes_With_CategoryDetilas(AWCT_ID) {
  const row = await db.queryOne(DB, 'select * from tbl_attributes_with_category where is_active = true and awct_id = @AWCT_ID limit 1', { AWCT_ID });
  return mapRow(row, ATT_PROPS);
}
void Attributes_With_CategoryDetilas;

// auth (PORT-NOTE: legacy had no session check; protected because it changes the global attribute catalogue)
router.all(`${P}/AddUpdateAttributes{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const type = req.p.type;
  const id = c.bindInt(req, 'id');
  const AWCT_ID = c.bindInt(req, 'AWCT_ID');
  const att_Name = req.p.att_Name;
  const att_Type = req.p.att_Type;
  const select_DdlId = c.bindInt(req, 'select_DdlId');
  const att_Default_Value = req.p.att_Default_Value;
  const mode = req.p.mode;
  const IsMendatory = c.bindInt(req, 'IsMendatory');
  const IsSearch = c.bindInt(req, 'IsSearch');
  const IsActive = c.bindInt(req, 'IsActive');
  const r = await db.procOne(DB, 'usp_manage_attributes_witdcategory', {
    type: c.isNull(type) ? null : type, id, awct_id: AWCT_ID, att_name: c.isNull(att_Name) ? null : att_Name,
    att_type: c.isNull(att_Type) ? null : att_Type, select_ddlid: select_DdlId,
    att_default_value: c.isNull(att_Default_Value) ? null : att_Default_Value,
    isactive: IsActive, ismendatory: IsMendatory, issearch: IsSearch, mode: c.isNull(mode) ? null : mode,
  });
  // @STRRESULT OUT (DBNull.ToString() => "")
  const Ret = r && !c.isNull(r.strresult) ? String(r.strresult) : '';
  res.json(Ret);
}));

// auth (PORT-NOTE: legacy had no session check; protected because it deletes catalogue rows)
router.all(`${P}/DeleteAttributes{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const AWCT_ID = c.bindInt(req, 'AWCT_ID');
  // legacy: "DELETE FROM TBL_ATTRIBUTES_WITH_CATEGORY WHERE AWCT_ID=" + AWCT_ID (parameterised here)
  const Ret = await db.exec(DB, 'delete from tbl_attributes_with_category where awct_id = @AWCT_ID', { AWCT_ID });
  if (Ret > 0) return res.json('Attribute Deleted successfully !');
  return res.json('some error occured !');
}));

// public when type/id are missing (legacy returned NewIndex without touching the session);
// otherwise (Login)Session["Plid"] is cast unguarded => NullReferenceException without login.
// route-config: merchant/Manage-Attributes and merchant/Manage-Attributes/{type}/{id} -> Manage_Attributes/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/Manage-Attributes', '/portal/merchant/Manage-Attributes/:type/:id'], ps.portalSession, asyncHandler(async (req, res) => {
  const type = c.isNull(req.p.type) ? null : String(req.p.type);
  let id = c.isNull(req.p.id) ? null : String(req.p.id);
  if (type === null || id === null) {
    return res.json({ view: '~/Views/CustomerPanel/Manage_Attributes/NewIndex.cshtml' });
  }
  // Redirecting Merchant to the dashboard if It is not the ATCShopping Id
  if (!ps.isCustomer(req)) throw c.NRE();
  if (c.toInt64(req.user.plid) !== 1) {
    // Response.Redirect("dashBoard") ends the request
    return res.json({ redirect: 'dashBoard' });
  }
  const ViewBag = {};
  ViewBag.Type = type;
  ViewBag.Id = id;

  id = await UtilityClass.Decryptword(String(id));

  const rows = await db.proc(DB, 'usp_attribute_list', { type, id });
  // PORT-NOTE: @CAT_NAME OUT / @TOTALCOUNT OUT are read from the first result row (none => "" / 0).
  const first = rows[0] || {};
  const TotalRecord = c.toInt32(first.totalcount);
  const catName = c.isNull(first.cat_name) ? '' : String(first.cat_name);
  const liAtt = mapRows(rows, ATT_PROPS);

  if (catName === '') {
    return res.json({ redirect: '/Home/index' });
  }
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.cat_Name = catName;
  ViewBag.CatSubCatID = String(id);
  ViewBag.CatSubCat_Type = String(type);
  const Row = await new ddl_Master().GetDDLList(type, id);
  const Li_Ddl_Main = [];
  const Li_Ddl_Child = [];
  for (const Item of Row) {
    // new ddl_Master { ddl_ID, parent_ddl_ID, ddl_Name, ddl_Text, ddl_Value, isActive } (ddl_Name_ID is read but not copied)
    const obj = {};
    for (const k of DDL_PROPS) obj[k] = null;
    obj.ddl_ID = Item.ddl_ID;
    obj.parent_ddl_ID = Item.parent_ddl_ID;
    obj.ddl_Name = Item.ddl_Name;
    obj.ddl_Text = Item.ddl_Text;
    obj.ddl_Value = Item.ddl_Value;
    obj.isActive = Item.isActive;
    if (Number(Item.parent_ddl_ID) === 0) Li_Ddl_Main.push(obj);
    else Li_Ddl_Child.push(obj);
  }
  const obj2 = { ddl_Child: Li_Ddl_Child, ddl_Master: Li_Ddl_Main, li_Att: liAtt };
  return c.viewJson(res, '~/Views/CustomerPanel/Manage_Attributes/Index.cshtml', obj2, ViewBag);
}));

// public
router.all(`${P}/test{/:id}`, asyncHandler(async (req, res) => {
  res.json('ok');
}));

module.exports = router;
