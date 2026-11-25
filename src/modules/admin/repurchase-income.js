'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Repurchase_Income.cs
// (class Common.Controllers.AdminPanel.Repurchase_IncomeController => /admin/Repurchase_Income/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, view, perms, fmtDate, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, toInt32, outParseInt, outParseDec,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'Repurchase_Income';

/** class RepurchaseIncome */
const REPURCHASE_INCOME_PROPS = ['ROWNUMBER', 'MPID', 'LOGINID', 'PAYFROM', 'PAYTO', 'BINARYINCOME', 'GROUPBONUS', 'ACTIVE', 'PAYID', 'USERNAME',
  'NAME', 'OLBV', 'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MATCHBV', 'PAIDBV', 'FLUSHBV', 'CFLBV', 'CFRBV', 'Mobile', 'EmailID', 'PAYDATE', 'TDS',
  'ADMINCHARGE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';
// private string binaryUrl (instance field, per request)

// public void ExportReport(int? payid, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
async function ExportReport(req, res, payid, SearchField, SearchValue, fromDate, toDate, page, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Repurchase_Income' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = await UtilityClass.GridPageSize(); // (unused, like legacy)
  void MaxRows;
  if (page === null) page = 1;
  // (SearchField / SearchValue parameters are ignored: legacy passed "" to the proc; no @TOTALADMINCHARGE / @TOTALTDS => proc defaults)
  const rows = await db.proc(DB, 'USP_REPURCHAGE_MEMBER_PAYOUT', {
    StartRowIndex: page, MaxRows: '100000', PayID: payid, REGNO: toInt32('0'), SearchField: '', SearchValue: '', fromDate, ToDate: toDate,
    LoginId: '', Mode: toInt32('0'),
  });
  const RepurchaseIncome = mapRows(rows, REPURCHASE_INCOME_PROPS);
  if (RepurchaseIncome.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Repurchase_Income.xls', Filename,
      // legacy wrote "Tds\t" and "Admin Charge\t" (no space before the tab) for the last two headers
      rawHeaders: ['S.No.', 'Payout Date', 'Username', 'TLBV', 'TRBV', 'CLBV', 'CRBV', 'Match BV', 'Binary Income'].map((h) => `${h} \t`).join('')
        + 'Tds\tAdmin Charge\t',
      rows: RepurchaseIncome,
      innerProc: 'RepurchaseIncome',
      outerProc: 'USP_REPURCHAGE_MEMBER_PAYOUT',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(fmtDate(item.PAYDATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(cs(item.USERNAME)) + ' \t');
        w(tab(n2(item.TLBV)) + ' \t');
        w(tab(n2(item.TRBV)) + ' \t');
        w(tab(n2(item.CLBV)) + ' \t');
        w(tab(n2(item.CRBV)) + ' \t');
        w(tab(n2(item.MATCHBV)) + ' \t');
        w(tab(n2(item.BINARYINCOME)) + ' \t');
        w(tab(n2(item.TDS)) + ' \t');
        w(tab(n2(item.ADMINCHARGE)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, int? payid, string SearchField, string SearchValue, string fromDate, string toDate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/repurchase_income" -> Repurchase_Income/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/repurchase_income'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let payid = nint(req.p.payid);
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  // (no try/catch in legacy: errors are unhandled => 500)
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // binaryUrl = Request.Url.ToString(); text after the first '?' is decrypted as a user name and forces the USERNAME search
  // PORT-NOTE: the raw (URL-encoded) query text is used; legacy Uri.ToString() unescaped it. Any query string goes to Decryptword like legacy.
  const binaryrequesturl = req.originalUrl.split('?');
  let username = '';
  if (binaryrequesturl.length >= 2) {
    username = await UtilityClass.Decryptword(binaryrequesturl[1]);
    SearchField = 'USERNAME';
    SearchValue = username;
  }
  if (payid === null) payid = 0;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (toDate === null) toDate = '';
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  await perms(url, Empid, ViewBag);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_REPURCHAGE_MEMBER_PAYOUT', {
    StartRowIndex: page, MaxRows, PayID: payid, REGNO: toInt32('0'), SearchField, SearchValue, fromDate, ToDate: toDate, LoginId: '',
    Mode: toInt32('0'),
  });
  const RepurchaseIncome = mapRows(rows, REPURCHASE_INCOME_PROPS);
  const TotalRecord = outParseInt(rows, 'TotalCount');
  const TOTALBINARYINCOMEs = outParseDec(rows, 'TOTALBINARYINCOME');
  const TOTALAdminCharge = outParseDec(rows, 'TOTALADMINCHARGE');
  const TOTALTDSCharge = outParseDec(rows, 'TOTALTDS');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TOTALBINARYINCOME = TOTALBINARYINCOMEs;
  ViewBag.TOTALAdminCharge = TOTALAdminCharge;
  ViewBag.TOTALTDSCharge = TOTALTDSCharge;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.SearchValue = SearchValue;
  ViewBag.payid = payid;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, payid, SearchField, SearchValue, fromDate, toDate, page, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/Repurchase_Income/Index.cshtml', RepurchaseIncome, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(int? payid, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nint(req.p.payid), nstr(req.p.SearchField), nstr(req.p.SearchValue), nstr(req.p.fromDate),
    nstr(req.p.toDate), nint(req.p.page), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
