'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\manage_sponsorController.cs
// (namespace Crypto_Inbox_Admin.Controllers.AdminPanel, class manage_sponsorController => /manage_sponsor/...)
// Database: affiliate (Db_Affiliate). Proc: usp_Changesponsor.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nStr, reqInt, outStr } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'manage_sponsor';

/** class GetDetailsByUserName */
const PROPS = ['EMAILID', 'FNAME', 'LNAME', 'loginid'];

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Manage-Sponsor" -> manage_sponsor/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manage-Sponsor'], adminAuth, asyncHandler(async (req, res) => {
  return res.json({ view: '~/Views/AdminPanel/Manage_Sponsor/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult CheckUserExistsOnBlur(string UserName, int Type)
// auth (PORT-NOTE: legacy had no session check on this member lookup - protected)
router.all(`/admin/${C}/CheckUserExistsOnBlur{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Type = reqInt(req.p.Type, 'Type');
  let RetMsg = 'Available|^';
  // usp_Changesponsor @username,@sponcername,@STRRESULT OUT,@CHANEBY,@MODE,@TYPE
  const rows = await db.proc(DB, 'usp_Changesponsor', { username: nStr(req.p.UserName), sponcername: '', CHANEBY: '0', MODE: '1', TYPE: Type });
  const RowSp = rows.length ? mapRow(rows[0], PROPS) : null;
  if (RowSp === null) {
    // PORT-NOTE: legacy Json(...) without JsonRequestBehavior.AllowGet => a GET request got an InvalidOperationException (500).
    if (req.method === 'GET') {
      const e = new Error('This request has been blocked because sensitive information could be disclosed to third party web sites when this is used in a GET request. To allow GET requests, set JsonRequestBehavior to AllowGet.');
      e.status = 500; throw e;
    }
    // PORT-NOTE: with no row the PG function cannot return @STRRESULT => ''.
    return res.json('Invalid|^' + outStr(rows[0], 'strresult'));
  }
  const s = (v) => (v === null || v === undefined ? '' : String(v));
  RetMsg = 'Exists|^' + s(RowSp.EMAILID) + '^' + s(RowSp.FNAME) + ' ' + s(RowSp.LNAME) + ' ' + s(RowSp.LNAME) + '^' + s(RowSp.loginid);
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult changesponsor(string UserName, string sponcername)
// auth (reads Session["Admin_User"].Emp_ID before the try => NullReferenceException without a session)
router.all(`/admin/${C}/changesponsor{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Empid = req.user.emp_id;
  let RetMsg = '';
  try {
    const row = await db.procOne(DB, 'usp_Changesponsor', {
      username: nStr(req.p.UserName), sponcername: nStr(req.p.sponcername), CHANEBY: Empid, MODE: 2, TYPE: '0',
    });
    RetMsg = 'Success|^' + outStr(row, 'strresult');
    return res.json(RetMsg);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_Changesponsor');
    RetMsg = 'Error occurred. Please try later';
    return res.json(RetMsg);
  }
}));

module.exports = router;
