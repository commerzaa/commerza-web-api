'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Blocked_DownLine.cs (class Blocked_DownLineController => /admin/Blocked_DownLine/...)
// Database: affiliate (Db_Affiliate). Model class GetPermittedCheckBoxForCheckAddNew (same file) => PERMITTED_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const { outVal, str, sp, reqNum, col } = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Blocked_DownLine';

const PERMITTED_PROPS = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME', 'SHOWACTIVE'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Blocked-DownLine" -> Blocked_DownLine/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Blocked-DownLine'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Blocked_DownLine/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult BlockedDownLine(int DownLine, string UserName, int Mode, int blocktype)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/BlockedDownLine{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const DownLine = reqNum(req, 'DownLine');
  const UserName = sp(req, 'UserName');
  const Mode = reqNum(req, 'Mode');
  reqNum(req, 'blocktype'); // bound (non-nullable) but unused by the legacy action
  let side = 0;
  if (DownLine === 1) side = 1;
  else if (DownLine === 0) side = 0;
  else if (DownLine === 2) side = 2;
  else side = 5;
  const UserId = req.user.emp_loginid;
  // [USP_BLOCKEDDOWNLINE] @USERNAME,@SIDE,@MODE,@ADMINLOGINID,@RESULT OUT
  const rows = await db.proc(DB, 'USP_BLOCKEDDOWNLINE', { USERNAME: UserName, SIDE: side, MODE: Mode, ADMINLOGINID: UserId });
  const ret = str(outVal(rows, 'RESULT'));
  res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult CheckCheckboxOnTheBehalfOfPermission()
// public (legacy had no session check; registration-form field configuration only)
router.all(`/admin/${C}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  // USP_GETDATAFORREGISTRATION @MODE (=1)
  const Details = mapRows(await db.proc(DB, 'USP_GETDATAFORREGISTRATION', { MODE: 1 }), PERMITTED_PROPS);
  res.json(Details);
}));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (PORT-NOTE: legacy had no session check but returns member wallet balances => adminAuth)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberid = sp(req, 'memberid');
  let getval = 'Invalid';
  // legacy concatenated memberid into the SQL (injection) - parameterised here. ::text keeps the SQL Server decimal text form.
  const dr = await db.queryOne(DB, `select mm.regno, coalesce(mm.fname,'') || ' ' || coalesce(mm.mname,'') || ' ' || coalesce(mm.lname,'') as mmbername,
      mm.emailid, coalesce(mp.availablecommissionwallet,0)::text as availablecommissionwallet, coalesce(availablecoinwallet,0)::text as availablecoinwallet,
      coalesce(available_fund,0)::text as available_fund
    from member_master mm inner join member_performance mp on mp.regno = mm.regno where mm.username = @memberid`, { memberid });
  if (dr) {
    getval = `${str(col(dr, 'regNo'))}^${str(col(dr, 'MMBERNAME'))}^${str(col(dr, 'EMAILID'))}^${str(col(dr, 'AVAILABLECOMMISSIONWALLET'))}^${str(col(dr, 'AvailableCoinWallet'))}^${str(col(dr, 'AVAILABLE_FUND'))}`;
  } else {
    getval = 'Invalid';
  }
  res.json(getval);
}));

// ---------------------------------------------------------------- JsonResult Getdownlinecount(string memberid)
// auth (PORT-NOTE: legacy had no session check but returns member downline data => adminAuth)
router.all(`/admin/${C}/Getdownlinecount{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberid = sp(req, 'memberid');
  // [USP_COUNT_MEMBER_DOWNLINE] @USERNAME,@TOTALMEMBER OUT,@RIGHT OUT,@LEFT OUT,@MASTERIDCOUNT OUT
  const rows = await db.proc(DB, 'USP_COUNT_MEMBER_DOWNLINE', { USERNAME: memberid });
  const totalcounts = str(outVal(rows, 'TOTALMEMBER'));
  const leftcounts = str(outVal(rows, 'LEFT'));
  const rightcounts = str(outVal(rows, 'RIGHT'));
  const masteridcount = str(outVal(rows, 'MASTERIDCOUNT'));
  res.json({ totalcounts, leftcounts, rightcounts, masteridcount });
}));

module.exports = router;
