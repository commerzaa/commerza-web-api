// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Deactivated_Dropdown_List.cs (class Deactivated_Dropdown_ListController; DB: Db_Shopping)
// Table: tbl_ddl_master (_ddl_Master)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Deactivated_Dropdown_List';
const DDL_PROPS = ['CategoryId', 'Create_Date', 'ddl_ID', 'ddl_Name', 'ddl_Name_ID', 'ddl_Text', 'ddl_Value', 'isActive', 'MainCategoryId', 'parent_ddl_ID', 'SubCategoryId'];
const isTrue = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';
/** new ddl_Master() (unset properties keep their C# defaults) */
const newDdl = () => { const o = {}; for (const k of DDL_PROPS) o[k] = null; o.ddl_ID = 0; o.parent_ddl_ID = 0; o.isActive = false; return o; };

// auth (legacy: Session["PLID"] == null => RedirectToAction("Index","Home"); ViewBag.PreviourURL is set before the check)
// route-config: merchant/Deactivated-Dropdown-List -> Deactivated_Dropdown_List/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/Deactivated-Dropdown-List'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const ref = req.get('referer');
  if (ref) {
    let PreviousUrl = ref;
    try { PreviousUrl = new URL(ref).pathname; } catch (_) { /* keep raw */ }
    ViewBag.PreviourURL = PreviousUrl;
  }
  // (from e in db._ddl_Master select new { ddl_ID, parent_ddl_ID, ddl_Name, ddl_Name_ID, ddl_Text, ddl_Value, isActive }).ToList()
  const Row = await db.query(DB, 'select ddl_id, parent_ddl_id, ddl_name, ddl_name_id, ddl_text, ddl_value, isactive from tbl_ddl_master');
  const Li_Ddl_Main = [];
  const Li_Ddl_Child = [];
  for (const Item of Row) {
    const obj = newDdl();
    obj.ddl_ID = Number(Item.ddl_id);
    obj.parent_ddl_ID = Item.parent_ddl_id === null ? null : Number(Item.parent_ddl_id);
    obj.ddl_Name = Item.ddl_name;
    obj.ddl_Text = Item.ddl_text;
    obj.ddl_Value = Item.ddl_value;
    obj.isActive = isTrue(Item.isactive);
    if (obj.parent_ddl_ID === 0) Li_Ddl_Main.push(obj);
    else Li_Ddl_Child.push(obj);
  }
  const obj2 = { ddl_Child: Li_Ddl_Child, ddl_Master: Li_Ddl_Main };
  res.json({ view: '~/Views/CustomerPanel/Deactivated_Dropdown_List/Index.cshtml', Model: obj2, ViewBag, ...ViewBag });
}));

// public (the legacy Session["PLID"] check is reproduced inside: the id is decrypted/validated BEFORE it, so the error order is kept)
router.all(`${P}/ReactivateSelectList{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let str_ddl_ID = b.mvcStr(req, 'str_ddl_ID');
  let ddl_ID = 0;
  let Ret = '';
  try {
    str_ddl_ID = await UtilityClass.Decryptword(str_ddl_ID);
    // int.TryParse
    const t = str_ddl_ID === null || str_ddl_ID === undefined ? '' : String(str_ddl_ID).trim();
    const isNumeric = /^[+-]?\d+$/.test(t) && Math.abs(parseInt(t, 10)) <= 2147483647;
    const n = isNumeric ? parseInt(t, 10) : 0;
    if (isNumeric === false) {
      Ret = 'error^some error occured !';
      return res.json(Ret);
    }
    if (n <= 0) {
      Ret = 'error^some error occured !';
      return res.json(Ret);
    }
    ddl_ID = n;
  } catch (ex) {
    Ret = 'error^some error occured !';
    return res.json(Ret);
  }

  if (!ps.isCustomer(req)) {
    Ret = 'error^This page has been expired, Please login again.';
  } else {
    const r = await db.exec(DB, 'update tbl_ddl_master set isactive = true where ddl_id = @ddl_id', { ddl_id: ddl_ID });
    if (r > 0) Ret = 'success^success';
    else Ret = 'error^some error occured !';
  }
  res.json(Ret);
}));

module.exports = router;
