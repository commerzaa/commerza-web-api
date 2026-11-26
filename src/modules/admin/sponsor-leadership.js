'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Sponsor_Leadership.cs (class Sponsor_LeadershipController, no namespace => /admin/Sponsor_Leadership/...)
// Database: affiliate (Db_Affiliate). Procs USP_GET_SPONSORLEADERSHIP, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, str, perms, cvtInt, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, errorView,
} = require('./_shared/batch11-common');
const { outDecStrictOf } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'Sponsor_Leadership';

/** public class SponsorLeaderShip */
const SPONSOR_LEADERSHIP_PROPS = ['RowNumber', 'FROMUSERNAME', 'TOUSERNAME', 'Date', 'BASEAMOUNT', 'INCOME'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
async function ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'Sponsor_Leadership_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // [USP_GET_SPONSORLEADERSHIP] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@PLID,@TOTALBASEAMOUNT OUT,@TOTALINCOME OUT
  const RewardAchivers = mapRows(await db.proc(DB, 'USP_GET_SPONSORLEADERSHIP', {
    STARTROWINDEX: 1, MAXROWS: 999999, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate, TODATE: todate, PLID: 0,
  }), SPONSOR_LEADERSHIP_PROPS);
  if (RewardAchivers.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Sponsor_Leadership.xls', Filename, ViewBag, rows: RewardAchivers,
      headers: ['S.No.', 'From Username', 'To Username', 'Date', 'Base Amount', 'Income'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['RowNumber', 'FROMUSERNAME', 'TOUSERNAME', 'Date']) w(tab(cellStr(item, k)) + ' \t');
        w(tab(dec2(item.BASEAMOUNT)) + ' \t');
        w(tab(dec2(item.INCOME)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string username,
//   string btnexel, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Sponsor-Leadership" -> Sponsor_Leadership/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Sponsor-Leadership'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let username = nStr(req.p.username);
  let btnexel = nStr(req.p.btnexel);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (username === null) username = ''; // eslint-disable-line no-unused-vars
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const ViewBag = {};
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission / GetExcelPermission
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_GET_SPONSORLEADERSHIP', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate, TODATE: todate, PLID: 0,
    });
    const RewardAchivers = mapRows(rows, SPONSOR_LEADERSHIP_PROPS);
    const tc = str(col(rows[0], 'TOTALCOUNT'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
    const TOTALBASEAMOUNTS = outDecStrictOf(rows, 'TOTALBASEAMOUNT'); // decimal.Parse(...)
    const TOTALINCOMES = outDecStrictOf(rows, 'TOTALINCOME');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALBASEAMOUNTS = TOTALBASEAMOUNTS;
    ViewBag.TOTALINCOMES = TOTALINCOMES;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Sponsor_Leadership/Index.cshtml', Model: RewardAchivers, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_GET_SPONSORLEADERSHIP');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.fromdate), nStr(req.p.todate), nStr(req.p.SearchField), nStr(req.p.SearchValue));
  if (!r.sent && !res.headersSent) res.send(''); // void action => empty response
}));

module.exports = router;
