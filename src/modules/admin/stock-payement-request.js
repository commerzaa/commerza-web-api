'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Stock_Payement_Request.cs (class Stock_Payement_RequestController, no namespace => /admin/Stock_Payement_Request/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, Usp_Franchise_Payement_Request, USP_EXCEL_DOWNLOAD_HISTORY,
// USP_FRANCHISEDETAILSBYFRID; tables tbl_franchise_payement_request, tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, col, str, cvtInt, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, excelLink, inlinePerms, at, nullRef, firstCol,
} = require('./_shared/batch11-common');
const { smsAction, emailAction, need } = require('./_shared/batch06-debit');
const { fireAndForget, FRANCHISE_DETAILS_PROPS } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'Stock_Payement_Request';

/** public class stock_Payement_Request */
const STOCK_PAYEMENT_REQUEST_PROPS = ['RowNumber', 'FPRID', 'USERNAME', 'FRCode', 'Bank', 'ModeName', 'Amount', 'Request_Date', 'status', 'FNAME', 'EMAILID',
  'REMARKS', 'BRANCH', 'IFSC', 'Attachment', 'Refrence'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(string Username, string fromdate, string todate, string status)
async function ExportReport(req, res, ViewBag, Username, fromdate, todate, status) {
  const userid = req.user.emp_id;
  const Filename = 'Stock_Payment_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // [Usp_Franchise_Payement_Request] @STARTROWINDEX,@MAXROWS,@ModeName,@USERNAME,@From,@To,@Mode,@TOTALCOUNT OUT
  const Obj = mapRows(await db.proc(DB, 'Usp_Franchise_Payement_Request', {
    STARTROWINDEX: 1, MAXROWS: 100, ModeName: status, USERNAME: Username, From: fromdate, Mode: 1, To: todate,
  }), STOCK_PAYEMENT_REQUEST_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Stock_Payment_Request.xls', Filename, ViewBag, rows: Obj,
      headers: ['S.No.', 'Request Date', 'Name', 'Frcode', 'Amount', 'Payment Mode'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['RowNumber', 'Request_Date', 'USERNAME', 'FRCode']) w(tab(cellStr(item, k)) + ' \t');
        w(tab(dec2(item.Amount)) + ' \t');
        w(tab(cellStr(item, 'ModeName')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? page, string btnexel, string fromdate,
//   string status, string todate, string Username)
// auth (reads Session["Admin_User"]; Session == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Stock-Payement-Request" -> Stock_Payement_Request/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Stock-Payement-Request'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let page = nInt(req.p.page);
  let btnexel = nStr(req.p.btnexel);
  let fromdate = nStr(req.p.fromdate);
  let status = nStr(req.p.status);
  let todate = nStr(req.p.todate);
  let Username = nStr(req.p.Username);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const ip = await inlinePerms(Employeeid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out
  ViewBag.excelactive = await excelLink(url);
  if (status === null) status = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // [Usp_Franchise_Payement_Request] @STARTROWINDEX,@MAXROWS,@ModeName,@USERNAME,@From,@To,@Mode,@TOTALCOUNT OUT,@FPRID,@STATUS,@AdminRemark,@loginid,@orderbydate
  // (@STARTROWINDEX is always 1 in the legacy call)
  const rows = await db.proc(DB, 'Usp_Franchise_Payement_Request', {
    STARTROWINDEX: 1, MAXROWS: MaxRows, ModeName: status, USERNAME: Username, From: fromdate, Mode: 1, To: todate,
    FPRID: 0, STATUS: 0, AdminRemark: '0', loginid: 0, orderbydate,
  });
  const Obj = mapRows(rows, STOCK_PAYEMENT_REQUEST_PROPS);
  const tc = str(col(rows[0], 'TotalCount'));
  const TotalRecord = cvtInt(tc === '' ? '0' : tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.Paymentmode = status;
  ViewBag.Username = Username;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.status = status;
  ViewBag.toDate = todate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, Username, fromdate, todate, status);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Stock_Payement_Request/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string Username, string fromdate, string todate, string status)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.Username), nStr(req.p.fromdate), nStr(req.p.todate), nStr(req.p.status));
  if (!r.sent && !res.headersSent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GETDetails(int FPRID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GETDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FPRID = reqInt(req.p.FPRID, 'FPRID');
  // [Usp_Franchise_Payement_Request] @STARTROWINDEX,@MAXROWS,@ModeName,@USERNAME,@From,@To,@Mode,@TOTALCOUNT OUT,@FPRID
  const Obj = mapRows(await db.proc(DB, 'Usp_Franchise_Payement_Request', {
    STARTROWINDEX: 1, MAXROWS: 100, ModeName: '', USERNAME: '', From: '', Mode: 2, To: '', FPRID,
  }), STOCK_PAYEMENT_REQUEST_PROPS);
  return res.json(Obj);
}));

// ---------------------------------------------------------------- JsonResult updatestatus(int FPRID, int STATUS, string AdminRemark)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/updatestatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FPRID = reqInt(req.p.FPRID, 'FPRID');
  const STATUS = reqInt(req.p.STATUS, 'STATUS');
  const AdminRemark = nStr(req.p.AdminRemark);
  let DynamicEmailSms = '';
  let MobileSMS = '';
  let EmailSubject = '';
  // select ISNULL(FRID,0) as FRID from TBL_FRANCHISE_PAYEMENT_REQUEST where FPRID=<FPRID>   .FirstOrDefault() (no row => 0)
  const frRow = firstCol(await db.query(DB, 'select coalesce(frid, 0) as frid from tbl_franchise_payement_request where fprid = @FPRID', { FPRID }));
  const Frid = frRow === null || frRow === undefined ? 0 : Number(frRow);
  // USP_FRANCHISEDETAILSBYFRID @FRID
  const FranchiseDetails = mapRows(await db.proc(DB, 'USP_FRANCHISEDETAILSBYFRID', { FRID: Frid }), FRANCHISE_DETAILS_PROPS);
  const loginid = req.user.emp_id;
  // [Usp_Franchise_Payement_Request] @STARTROWINDEX,@MAXROWS,@ModeName,@USERNAME,@From,@To,@Mode,@TOTALCOUNT OUT,@FPRID,@STATUS,@AdminRemark,@loginid
  const row = await db.procOne(DB, 'Usp_Franchise_Payement_Request', {
    STARTROWINDEX: 1, MAXROWS: 100, ModeName: '', USERNAME: '', From: '', Mode: 3, To: '', FPRID, STATUS, AdminRemark, loginid,
  });
  const status = str(col(row, 'TotalCount'));
  if (status === '2') {
    const SMSVerification = need(await smsAction(29));
    MobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(at(FranchiseDetails, 0).NAME, SMSVerification.Sms_Content, '', '', 17);
    const emailVerificationmsg = need(await emailAction(25));
    EmailSubject = emailVerificationmsg.Email_Subject;
    DynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(FranchiseDetails[0].NAME, emailVerificationmsg.Email_Content, '', '', 16, '');
  } else if (status === '3') {
    const SMSVerification = need(await smsAction(30));
    MobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(at(FranchiseDetails, 0).NAME, SMSVerification.Sms_Content, '', '', 18);
    const emailVerificationmsg = need(await emailAction(26));
    EmailSubject = emailVerificationmsg.Email_Subject;
    DynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(FranchiseDetails[0].NAME, emailVerificationmsg.Email_Content, '', '', 17, '');
  }
  if (status === '2' || status === '3') {
    const fd0 = FranchiseDetails[0];
    fireAndForget('Stock_Payement_Request SMS', () => UtilityClass.SendSMSWithAPI(fd0.MOBILE, MobileSMS, '1'));
    const fileUploader = null;
    fireAndForget('Stock_Payement_Request email', () => {
      if (fd0.EMAILID === null || fd0.EMAILID === undefined) throw nullRef();
      return UtilityClass.SendEmailByApiSetting(fd0.NAME, fd0.PASSWORD, '', '', '', '', String(fd0.EMAILID).toLowerCase(), EmailSubject, DynamicEmailSms, fileUploader);
    });
  }
  return res.json(status);
}));

module.exports = router;
