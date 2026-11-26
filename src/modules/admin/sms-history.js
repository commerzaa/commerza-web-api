'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SMS_History.cs (class SMS_HistoryController, no namespace => /admin/SMS_History/...)
// Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS, USP_MANAGESMSHISTORY, USP_EXCEL_DOWNLOAD_HISTORY.
// Config: DynamicPagging
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Payment_Mode = require('../../lib/admin/Payment_Mode');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cvtInt, nowStamp, excelHistory, writeXlsExport, cellStr, tab, excelLink, inlinePerms, col,
} = require('./_shared/batch11-common');
const { outIntStrictOf } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'SMS_History';
const VIEW = '~/Views/AdminPanel/SMS_History/Index.cshtml';

/** public class SMSHISTORY */
const SMSHISTORY_PROPS = ['ROWNUMBER', 'SHID', 'MOBILE', 'MESSAGE', 'DATE', 'TIME', 'Full_Message', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(string MOBILE, string fromDate, string toDate, int? status, string OrderBy)
async function ExportReport(req, res, ViewBag, MOBILE, fromDate, toDate, status, OrderBy) {
  const userid = req.user.emp_id;
  const Filename = 'SMS Sent Hitory' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  // [USP_MANAGESMSHISTORY] @SHID,@MOBILE,@MESSAGE,@STATUS,@MODE,@fromDate,@ToDate,@ORDERBYFIELD,@STARTROWINDEX,@MAXROWS,@INTRESULT OUT,@TOTALSEND OUT,@TOTALFAILED OUT
  const _ObjSMSHISTORY = mapRows(await db.proc(DB, 'USP_MANAGESMSHISTORY', {
    SHID: 0, MOBILE, MESSAGE: '', STATUS: status, MODE: 2, fromDate, ToDate: toDate, ORDERBYFIELD: OrderBy, STARTROWINDEX: 1, MAXROWS: 999999,
  }), SMSHISTORY_PROPS);
  if (_ObjSMSHISTORY.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'SMS Sent Hitory.xls', downloadName: ' SMS Sent Hitory.xls', Filename, ViewBag, rows: _ObjSMSHISTORY,
      headers: ['S.No.', 'Date', 'Time', 'Message', 'Mobile No', 'Status'],
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'DATE', 'TIME', 'MESSAGE', 'MOBILE']) w(tab(cellStr(item, k)) + ' \t');
        const v = col(item, 'STATUS');
        if (v === null || v === undefined) throw new Error('Specified cast is not valid.'); // int property from a NULL column
        const statuss = Number(v);
        if (statuss === 1) w(tab('Send') + ' \t');
        else w(tab('Failed') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, string MOBILE,
//   int? page, int? status, string OrderBy, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/SMS-History" -> SMS_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/SMS-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let MOBILE = nStr(req.p.MOBILE);
  let page = nInt(req.p.page);
  let status = nInt(req.p.status);
  let OrderBy = nStr(req.p.OrderBy);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  ViewBag.PayList = await Payment_Mode.PayModeList();
  if (OrderBy === null) OrderBy = 'DESC';
  if (btnexel === null) btnexel = '';
  if (MOBILE === null) MOBILE = '';
  if (fromDate === null) fromDate = '';
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = cvtInt(value === undefined ? null : value); // Convert.ToInt16(string)
  }
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  if (status === null) status = -1;
  // USP_EXCEL_LINK @url,@ISACTIVE out
  ViewBag.excelactive = await excelLink(url);
  const Employeeid = req.user.emp_id;
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const ip = await inlinePerms(Employeeid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_MANAGESMSHISTORY', {
      SHID: 0, MOBILE, MESSAGE: '', STATUS: status, MODE: 2, fromDate, ToDate: toDate, ORDERBYFIELD: OrderBy, STARTROWINDEX: page, MAXROWS: MaxRows,
    });
    const _ObjSMSHISTORY = mapRows(rows, SMSHISTORY_PROPS);
    const TotalRecord = outIntStrictOf(rows, 'INTRESULT');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalSUCESS = outIntStrictOf(rows, 'TOTALSEND');
    ViewBag.TotalFAIELD = outIntStrictOf(rows, 'TOTALFAILED');
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.MOBILE = MOBILE;
    ViewBag.fromDate = fromDate; ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.toDate = toDate;
    ViewBag.count = status;
    ViewBag.OrderBy = OrderBy;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, MOBILE, fromDate, toDate, status, OrderBy);
      if (r.sent) return undefined;
    }
    return res.json({ view: VIEW, Model: _ObjSMSHISTORY, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_MANAGESMSHISTORY');
    return res.json({ view: VIEW, Model: null, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string MOBILE, string fromDate, string toDate, int? status, string OrderBy)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.MOBILE), nStr(req.p.fromDate), nStr(req.p.toDate), nInt(req.p.status), nStr(req.p.OrderBy));
  if (!r.sent && !res.headersSent) res.send(''); // void action => empty response
}));

module.exports = router;
