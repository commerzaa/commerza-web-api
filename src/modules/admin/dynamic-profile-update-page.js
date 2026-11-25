'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Dynamic_ProfileUpdate_Page.cs (class Dynamic_ProfileUpdate_PageController => /Dynamic_ProfileUpdate_Page/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_GETATHENTICATIONFORMOBILE, Usp_AddOrRemoveProfileField;
// table tbl_detailspagemasterforprofileupdation (EF _Master_UpdateProfilePage).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const Dynamic_ProfileUpdatePage = require('../../lib/admin/Dynamic_ProfileUpdatePage');
const { adminAuth, legacyUrl, isAdmin, errorInsert } = require('./_shared/admin-session');
const { nStr, reqInt, col, str, cvtInt } = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Dynamic_ProfileUpdate_Page';

/** Models/Dynamic_ProfileUpdatePage.cs */
const DPUP_PROPS = ['TDPMFRID', 'FIELDNAME', 'DISPLAYSHOW', 'SHOWACTIVE', 'VALIDATIONACTIVE', 'ISEDIT', 'STATUS', 'ACTIVE', 'FID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/master-Profile-Update" -> Dynamic_ProfileUpdate_Page/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/master-Profile-Update'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const prow = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  const e = str(col(prow, 'EXCELSTATUS'));
  const i = str(col(prow, 'ISEDIT'));
  ViewBag.isactive = cvtInt(e === '' ? '0' : e);
  ViewBag.isedit = cvtInt(i === '' ? '0' : i);
  const pum = new Dynamic_ProfileUpdatePage();
  // USP_GETATHENTICATIONFORMOBILE @MODE (1 = mobile, 2 = email)
  const MobileAuthentication = mapRows(await db.proc(DB, 'USP_GETATHENTICATIONFORMOBILE', { MODE: 1 }), DPUP_PROPS);
  if (MobileAuthentication !== null) ViewBag.MobileEmailAuthentication = MobileAuthentication;
  const EmailAuthentication = mapRows(await db.proc(DB, 'USP_GETATHENTICATIONFORMOBILE', { MODE: 2 }), DPUP_PROPS);
  if (EmailAuthentication !== null) ViewBag.EmailAuthentication = EmailAuthentication;
  const Model = await pum.AllRoleList();
  res.json({ view: '~/Views/AdminPanel/Dynamic_ProfileUpdate_Page/Index.cshtml', Model, ...ViewBag });
}));

/** [Usp_AddOrRemoveProfileField] @id,@value,@mode,@fildname,@displayshow,@intResult out */
async function addOrRemove(id, value, mode, fildname, displayshow) {
  const row = await db.procOne(DB, 'Usp_AddOrRemoveProfileField', { id, value, mode, fildname, displayshow });
  return str(col(row, 'intResult'));
}

// ---------------------------------------------------------------- JsonResult Show_Hide(int id, int value, int mode)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Show_Hide{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const id = reqInt(req.p.id, 'id');
  const value = reqInt(req.p.value, 'value');
  const mode = reqInt(req.p.mode, 'mode');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    const stringret = await addOrRemove(id, value, mode, '', cvtInt('0'));
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_DIRECTINCOME_REPORT');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult Edit_Data(int RID)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Edit_Data{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const RID = reqInt(req.p.RID, 'RID');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    let stringret = '';
    let FIELDNAME = '';
    let DISPLAYSHOW = 0;
    // db._Master_UpdateProfilePage.Where(a => a.TDPMFRID == RID).FirstOrDefault()
    const r = await db.queryOne(DB, 'select * from tbl_detailspagemasterforprofileupdation where tdpmfrid = @RID limit 1', { RID });
    const row = r ? mapRow(r, DPUP_PROPS) : null;
    if (row !== null) {
      FIELDNAME = row.FIELDNAME;
      DISPLAYSHOW = row.DISPLAYSHOW;
    }
    stringret = stringret + '^' + 'Success' + '^' + (FIELDNAME === null ? '' : FIELDNAME) + '^' + DISPLAYSHOW;
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Edit_Data');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult Updatefeildname(int RID, string fildname, int displayshow, int mode)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Updatefeildname{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const RID = reqInt(req.p.RID, 'RID');
  const fildname = nStr(req.p.fildname);
  const displayshow = reqInt(req.p.displayshow, 'displayshow');
  const mode = reqInt(req.p.mode, 'mode');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    const stringret = await addOrRemove(RID, cvtInt('0'), mode, fildname, displayshow);
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_AddOrRemoveProfileField');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
