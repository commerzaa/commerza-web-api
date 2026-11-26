'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TwoFA_Security.cs (class TwoFA_SecurityController => /admin/TwoFA_Security/...)
// Database: affiliate (Db_Affiliate). Procs USP_GET2FASECURITY, USP_ENABLAEORDESABLE_2FA.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, nStr, reqInt, splitCsv } = require('./_shared/batch11-common');
const { sqlInt } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'TwoFA_Security';

/** class TowFADetails */
const TOW_FA_PROPS = ['ROWNUMBER', 'TSTID', 'SECURITYTYPE', 'ACTIVE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (only assigned here).
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/2fa-Security" -> TwoFA_Security/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/2fa-Security'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id; // eslint-disable-line no-unused-vars
  // (an @EXCELSTATUS output SqlParameter was declared but never used)
  const TowFalist = mapRows(await db.proc(DB, 'USP_GET2FASECURITY', {}), TOW_FA_PROPS);
  return res.json({ view: '~/Views/AdminPanel/TwoFA_Security/Index.cshtml', Model: TowFalist });
}));

// ---------------------------------------------------------------- JsonResult EnableOrDesabled2FA(string Tstid, int Active)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/EnableOrDesabled2FA{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Tstid = nStr(req.p.Tstid);
  const Active = reqInt(req.p.Active, 'Active');
  let IntResult = 0;
  if (Active === 1) IntResult = 1;
  else IntResult = 2;
  const WdidArray = splitCsv(Tstid);
  for (let i = 0; i < WdidArray.length; i++) {
    // USP_ENABLAEORDESABLE_2FA @TSMID,@ACTIVE
    await db.proc(DB, 'USP_ENABLAEORDESABLE_2FA', { TSMID: sqlInt(WdidArray[i]), ACTIVE: Active });
  }
  return res.json(IntResult);
}));

module.exports = router;
