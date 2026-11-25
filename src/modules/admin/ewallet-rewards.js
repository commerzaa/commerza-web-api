'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Ewallet_Rewards.cs (class Ewallet_RewardsController => /admin/Ewallet_Rewards/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Ewallet_Rewards';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class GetAllEwalletRewards */
const REWARD_PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS'];

/** X.Value.ToString() == "" ? "0" : ... of an OUT param returned as a result column (no row / DBNull => "0") */
const outOr0 = (rows, name) => {
  const s = B.str(B.col(rows[0], name));
  return s === '' ? '0' : s;
};
const parseIntStrict = (s) => { if (!/^\s*[-+]?\d+\s*$/.test(s)) throw new Error('Input string was not in a correct format.'); return parseInt(s, 10); };
const parseDecStrict = (s) => { const n = Number(s); if (s.trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };

/** [USP_GETEWALLET_REWARDS] @TOTALCOUNT out,@REWARDSAMOUNT OUT,@ADMINCHARGE OUT,@PAYBLEAMOUNT OUT  (CommandTimeout 1000) */
async function getRewards() {
  return db.proc(DB, 'USP_GETEWALLET_REWARDS', {});
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate) {
  void SearchField; void SearchValue; void fromdate; void todate; // not used by the legacy body
  const userid = req.user.emp_id;
  const Filename = 'Rewards_List' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const GetEwalletReward = mapRows(await getRewards(), REWARD_PROPS);
  if (GetEwalletReward.length > 0) {
    let srno = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Rewards_List.xls', Filename, downloadName: ' Rewards_List.xls', // header was "filename= Rewards_List.xls"
      headers: ['S.No.', 'From Business', 'To Business', 'Rewards Amt', 'Admin', 'Payable', 'Reward Name', 'From Date'],
      rows: GetEwalletReward,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(srno)) + ' \t');
        w(B.tab(B.dec2(item.FROMBUSINESS)) + ' \t');
        w(B.tab(B.dec2(item.TOBUSINESS)) + ' \t');
        w(B.tab(B.dec2(item.REWARDSAMOUNT)) + ' \t');
        w(B.tab(B.dec2(item.ADMINCHARGE)) + ' \t');
        w(B.tab(B.dec2(item.PAYBLEAMOUNT)) + ' \t');
        w(B.tab(B.cellStr(item, 'REWARDNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'FROMDATE')) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(string SearchField, string btnexel, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck] => redirect to ~/secure-admin-login-dhiDTo5ScKAHxD9kgDRERA/logout without a session)
// route-config: "AdminPanel/Ewallet-Rewards" -> Ewallet_Rewards/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ewallet-Rewards'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = B.nStr(req.p.SearchField);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await B.perms(Empid, url));
  // PORT-NOTE: legacy try/catch around this block is commented out => exceptions propagate (500).
  const MaxRows = Number(ddlcustpage);
  if (page === null) page = 1;
  const rows = await getRewards();
  const GetEwalletReward = mapRows(rows, REWARD_PROPS);
  const TotalRecord = parseIntStrict(outOr0(rows, 'totalcount'));
  const REWARDSAMOUNTS = parseDecStrict(outOr0(rows, 'rewardsamount'));
  const ADMINCHARGES = parseDecStrict(outOr0(rows, 'admincharge'));
  const PAYBLEAMOUNTS = parseDecStrict(outOr0(rows, 'paybleamount'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.REWARDSAMOUNTS = REWARDSAMOUNTS;
  ViewBag.ADMINCHARGES = ADMINCHARGES;
  ViewBag.PAYBLEAMOUNTS = PAYBLEAMOUNTS;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Ewallet_Rewards/Index.cshtml', Model: GetEwalletReward, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromdate), B.nStr(req.p.todate));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
