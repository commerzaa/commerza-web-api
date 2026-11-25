'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\RenewableNotification.cs (class RenewableNotificationController => /admin/RenewableNotification/...)
// Database: affiliate (Db_Affiliate). Procs: USP_RENEWABLENOTIFICATION, USP_EXCEL_DOWNLOAD_HISTORY. Table: TBL_SMSTEMPLATE.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, cvtInt, cvtDec, perms, excelHistory, nowStamp, writeXlsExport, cellStr, tab, errorView, trimS, splitCsv, firstCol,
} = require('./_shared/batch12-common');
const { rowsOut, omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'RenewableNotification';

/** class RenewableNotification */
const RENEWABLE_PROPS = ['ROWNUMBER', 'Name', 'Mobile', 'InvestmentDate', 'ExpireDate', 'PackageAmount', 'USERNAME'];
/** class SmsTemplate */
const SMS_TEMPLATE_PROPS = ['STID', 'TITLE', 'MESSAGE'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'RenewableNotification_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // (unused)
  void MaxRows;
  // [USP_RENEWABLENOTIFICATION] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE
  const AllFreeEpinList = mapRows(await db.proc(DB, 'USP_RENEWABLENOTIFICATION', omitNull({
    STARTROWINDEX: 1, MAXROWS: 9999999, FROMDATE: FromDate, TODATE: ToDate, SEARCHFIEL: trimS(SearchField), SEARCHVALUE: trimS(SearchValue),
  })), RENEWABLE_PROPS);
  if (AllFreeEpinList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'RenewableNotification.xls', downloadName: 'RenewableNotification.xls', Filename,
      headers: ['S.No.', 'Name', 'Username', 'Mobile', 'Package Amount', 'Investment Date', 'Expire Date'],
      rows: AllFreeEpinList,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(cellStr(item, 'PackageAmount')) + ' \t'); // decimal.ToString()
        w(tab(cellStr(item, 'InvestmentDate')) + ' \t'); // DateTime.ToString()
        w(tab(cellStr(item, 'ExpireDate')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField,
//   string btnexel, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck]: no session => redirect "~/secure-admin-login-.../logout")
// route-config: "AdminPanel/Renewable-Notification" -> RenewableNotification/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Renewable-Notification'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let btnexel = nStr(req.p.btnexel);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (btnexel === null) btnexel = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  try {
    const MaxRows = cvtInt(dynamicpagging);
    if (page === null) page = 1;
    // [USP_RENEWABLENOTIFICATION] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@TOTALCOUNT OUT,@TOTALPACKAMOUNT out,@orderbydate
    const rows = await db.proc(DB, 'USP_RENEWABLENOTIFICATION', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, RENEWABLE_PROPS);
    // PORT-NOTE: with no rows PG cannot return the OUT values => TotalRecord 0 / TOTALPACKAMOUNTS 0.
    const tc = rowsOut(rows, 'TOTALCOUNT');
    const tcs = tc === null ? '' : tc;
    const TotalRecord = parseInt(tcs === '' ? '0' : tcs, 10);
    if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
    const tp = rowsOut(rows, 'TOTALPACKAMOUNT');
    if (tp === '') throw new Error('Input string was not in a correct format.'); // decimal.Parse(DBNull.ToString())
    const TOTALPACKAMOUNTS = tp === null ? 0 : cvtDec(tp);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALPACKAMOUNTS = TOTALPACKAMOUNTS;
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
    return res.json({ view: '~/Views/AdminPanel/RenewableNotification/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_RENEWABLENOTIFICATION');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField), nStr(req.p.SearchValue));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetSmsTemplate()
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetSmsTemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SmsTemplate = mapRows(await db.query(DB, 'select stid, title, message from tbl_smstemplate', {}), SMS_TEMPLATE_PROPS);
  return res.json(SmsTemplate);
}));

// ---------------------------------------------------------------- JsonResult SendPertiCularSms(string MobileNo, string Message)
// auth (legacy had no session check; sends SMS through the company gateway => adminAuth)
router.all(`/admin/${C}/SendPertiCularSms{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Result = await UtilityClass.SendSMSWithAPI(nStr(req.p.MobileNo), nStr(req.p.Message), '1');
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult SendBulkSMS(string MobileNo, string Message)
// auth (legacy had no session check; sends SMS through the company gateway => adminAuth)
router.all(`/admin/${C}/SendBulkSMS{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Message = nStr(req.p.Message);
  let Result = '';
  const MobilArray = splitCsv(nStr(req.p.MobileNo), ','); // MobileNo.Split(new[] { "," }, StringSplitOptions.None) (null => NullReferenceException)
  for (let i = 0; i < MobilArray.length; i += 1) {
    Result = await UtilityClass.SendSMSWithAPI(MobilArray[i], Message, '1');
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult GetSmsMessageFromSmsTemplate(int Stid)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetSmsMessageFromSmsTemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Stid = reqInt(req.p.Stid, 'Stid');
  // SqlQuery<string>("select MESSAGE from TBL_SMSTEMPLATE where STID=" + Stid).FirstOrDefault()  (parameterised)
  const Result = firstCol(await db.query(DB, 'select message from tbl_smstemplate where stid = @Stid limit 1', { Stid }));
  return res.json(Result);
}));

module.exports = router;
