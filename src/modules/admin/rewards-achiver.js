'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Rewards_Achiver.cs
// (class Rewards_AchiverController => /admin/Rewards_Achiver/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, view, perms, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, outParseIntZ, outParseDec, nre,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'Rewards_Achiver';

/** class Rewards_Achiver */
const RA_PROPS = ['ROWNUMBER', 'REWARDNAME', 'FROMDATE', 'TODATE', 'REWARDSAMOUNT', 'MATCHAMOUNT', 'USERNAME'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

const trimS = (v) => { if (v === null || v === undefined) throw nre(); return String(v).trim(); };

// public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
async function ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Reward_Achiver_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  // db.Database.CommandTimeout = 1000 ; (no @orderbydate => proc default)
  const rows = await db.proc(DB, 'USP_REWARDACHIVERS', {
    STARTROWINDEX: 1, MAXROWS: 9999999, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: trimS(SearchField), SEARCHVALUE: trimS(SearchValue),
  });
  const AllFreeEpinList = mapRows(rows, RA_PROPS);
  if (AllFreeEpinList.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Reward_Achiver.xls', Filename,
      headers: ['S.No.', 'Username', 'Rewards Name', 'From Date', 'To Date', 'Rewards Amount', 'Total Match'],
      rows: AllFreeEpinList,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.USERNAME)) + ' \t');
        w(tab(cs(item.REWARDNAME)) + ' \t');
        w(tab(cs(item.FROMDATE)) + ' \t');
        w(tab(cs(item.TODATE)) + ' \t');
        w(tab(n2(item.REWARDSAMOUNT)) + ' \t');
        w(tab(n2(item.MATCHAMOUNT)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Rewards-Achiver" -> Rewards_Achiver/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Rewards-Achiver'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let SearchField = nstr(req.p.SearchField);
  let btnexel = nstr(req.p.btnexel);
  let SearchValue = nstr(req.p.SearchValue);
  let fromdate = nstr(req.p.fromdate);
  let todate = nstr(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const Empid = req.user.emp_id;
  await perms(url, Empid, ViewBag);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_REWARDACHIVERS', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, RA_PROPS);
    const TotalRecord = outParseIntZ(rows, 'TOTALCOUNT');
    const TOTALREWARDSAMOUNTs = outParseDec(rows, 'TOTALREWARDSAMOUNT');
    const TOTALMATCHAMOUNTs = outParseDec(rows, 'TOTALMATCHAMOUNT');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALREWARDSAMOUNTs = TOTALREWARDSAMOUNTs;
    ViewBag.TOTALMATCHAMOUNTs = TOTALMATCHAMOUNTs;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/Rewards_Achiver/Index.cshtml', AllFreeEpinList, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_REWARDACHIVERS');
    return view(res, '~/Views/PageNotFound/Index.cshtml', undefined, ViewBag);
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.fromdate), nstr(req.p.todate), nstr(req.p.SearchField), nstr(req.p.SearchValue), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
