'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_Timing_Reward.cs (class Member_Timing_RewardController => /Member_Timing_Reward/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, s0, nStr, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr,
} = require('./_shared/batch10_common');
const { intParseOut } = require('./_shared/batch10A_common');

const router = express.Router();
const C = 'Member_Timing_Reward';

/** class MemberTimingReward */
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'ACHIVEDATE', 'TOTALREWARDAMOUNT', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE',
  'WALLETTYPE', 'STATUS'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// PORT-NOTE: the legacy command text was "...@FROMDATE,TODATE,@TOTALCOUNT OUT": the bare word TODATE is passed to the procedure as the
// literal string 'TODATE' (the bound @TODATE value was never used). Kept: @TODATE = 'TODATE'.
async function callProc(Page, MaxRows, SearchField, SearchValue, FromDate, ToDate) { // eslint-disable-line no-unused-vars
  return db.proc(DB, 'USP_MEMBERTIMING_REWARD', {
    REGNO: 0, STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: FromDate, TODATE: 'TODATE',
  });
}

// public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
async function ExportReport(req, res, FromDate, ToDate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Member_Timing_Reward_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await callProc(1, MaxRows, SearchField, SearchValue, FromDate, ToDate);
  const list = mapRows(rows, PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'MemberTimingReward.xls', Filename,
      headers: ['S.No.', 'Username', 'Membername', 'Rewardname', 'Achive Date', 'RewardAmt', 'Total RewardAmt', 'Admin Charge', 'TDS Charge'],
      rows: list, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'ACHIVEDATE', 'REWARDAMOUNT', 'TOTALREWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE']) {
          w(tab(cellStr(item, k)) + ' \t');
        }
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string btnexel, string ToDate, string SearchValue, string SearchField)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/member-timing-reward" -> Member_Timing_Reward/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-timing-reward'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = s0(req.p.orderbydate);
  const FromDate = s0(req.p.FromDate);
  const btnexel = s0(req.p.btnexel);
  const ToDate = s0(req.p.ToDate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const ip = await inlinePerms(Employeeid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  ViewBag.excelactive = await excelLink(url);
  const MaxRows = dynamicpagging;
  let Page = nInt(req.p.Page); if (Page === null) Page = 1;
  const rows = await callProc(Page, MaxRows, SearchField, SearchValue, FromDate, ToDate);
  const MemberTimingReward = mapRows(rows, PROPS);
  const TotalRecord = intParseOut(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '', dynamicpagging,
    orderbydate, SearchValue, fromDate: FromDate, toDate: ToDate,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, FromDate, ToDate, SearchField, SearchValue, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Member_Timing_Reward/Index.cshtml', Model: MemberTimingReward, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField), nStr(req.p.SearchValue), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
