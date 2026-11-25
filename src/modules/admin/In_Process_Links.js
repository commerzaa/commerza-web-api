'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\In_Process_Links.cs (class In_Process_LinksController => /admin/In_Process_Links/...)
// Database: affiliate (Db_Affiliate). The file also declares `public class Get_Inprocess_Links` (model => INPROCESS_PROPS).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');
const P = require('./_shared/batch08B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'In_Process_Links';

/** class Get_Inprocess_Links */
const INPROCESS_PROPS = ['RowNumber', 'HRID', 'Amount', 'Create_Date', 'Expire_Date', 'FromLoginId', 'FromEmailId', 'FromName', 'FromMobile',
  'InvestID', 'GiveID', 'Help_Date', 'GH_Status', 'RegDate', 'FromRegNo', 'ToRegNo', 'ToLoginID', 'ToEmailId', 'ToName', 'ToMobile',
  'BlockChainAddress', 'BtcAmount', 'HRStatus', 'orderID', 'PaySlip', 'Remark', 'hashcode'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** Convert.ToInt64(string): null => 0, invalid => FormatException */
const toInt64 = (v) => B.cvtInt(v);
/** string + string in C# (null => "") */
const cat = (...a) => a.map((x) => (x === null || x === undefined ? '' : String(x))).join('');
/** fire-and-forget like `new Thread(delegate { ... }).Start()` */
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[In_Process_Links] background send failed:', e.message)); };

/** dbo.usp_getSendLinksList @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out */
async function getSendLinksList(StartRowIndex, MaxRows, SearchField, SearchValue, fromDate, ToDate) {
  if (SearchValue === null || SearchValue === undefined) throw B.nullRef(); // SearchValue.Trim()
  return db.proc(DB, 'usp_getSendLinksList', {
    StartRowIndex, MaxRows, SearchField, SearchValue: String(SearchValue).trim(), fromDate, ToDate,
  });
}

/** db._Member_Master.Where(a => a.regNo == Regno).FirstOrDefault() */
async function memberByRegNo(Regno) {
  const r = await db.queryOne(DB, 'select * from member_master where regno = @Regno limit 1', { Regno });
  if (!r) return null;
  return { regNo: B.col(r, 'regno'), FName: B.col(r, 'fname'), LName: B.col(r, 'lname'), mobile: B.col(r, 'mobile'),
    userName: B.col(r, 'username'), Emailid: B.col(r, 'emailid') };
}
/** db._TBL_SMSACTION.Where(b => b.ID == id).FirstOrDefault() (null => NullReferenceException on .Sms_Content) */
async function smsContent(id) {
  const r = await db.queryOne(DB, 'select sms_content from tbl_smsaction where id = @id limit 1', { id });
  if (!r) throw B.nullRef();
  return B.col(r, 'sms_content');
}
/** db._tbl_emailaction.Where(b => b.EID == id).FirstOrDefault() */
async function emailAction(id) {
  const r = await db.queryOne(DB, 'select email_subject, email_content from tbl_emailaction where eid = @id limit 1', { id });
  if (!r) throw B.nullRef();
  return { Email_Subject: B.col(r, 'email_subject'), Email_Content: B.col(r, 'email_content') };
}
const lower = (s) => { if (s === null || s === undefined) throw B.nullRef(); return String(s).toLowerCase(); };

/** public string Confirm_Request(Int64 Regno, Int64 HRID, int ActionBy, string FromName, string FromMobile, string FromEmailid) */
async function Confirm_Request(Regno, HRID, ActionBy, FromName, FromMobile, FromEmailid) {
  if (ActionBy !== 2) return 'this function has been closed';
  // dbo.Usp_Confirm_Request @HRID,@ActionBy,@SessionRegno,@BTC,@BTC_Address,@HashCode,@time,@IsTestMode,@Message out
  const r = await db.procOne(DB, 'Usp_Confirm_Request', {
    HRID, ActionBy, SessionRegno: Regno, BTC: 0, BTC_Address: '', HashCode: '', time: 0, IsTestMode: true,
  });
  const Result = B.str(B.col(r, 'Message'));
  const mm = await memberByRegNo(Regno);
  const SenderSms = await smsContent(37);
  const SenderMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(FromName, SenderSms, '', '', 25);
  await smsContent(39); // ReciverConfirmRequest (fetched; legacy then used SenderConfirmRequest.Sms_Content below)
  if (!mm) throw B.nullRef();
  // PORT-NOTE: legacy quirk kept - receiver SMS is built from the SENDER template (ID 37), not ID 39.
  const ReciverMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(cat(mm.FName, mm.LName), SenderSms, '', '', 26);
  const SenderEmailAction = await emailAction(33);
  const SenderDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(FromName, SenderEmailAction.Email_Content, '', '', 25, '');
  const ReciverEamilAction = await emailAction(34);
  const ReciverEmailSubject = ReciverEamilAction.Email_Subject;
  const ReciverDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(cat(mm.FName, mm.LName), ReciverEamilAction.Email_Content, '', '', 26, '');
  const fileUploader = null;
  if (Result === 'success') {
    bg(() => UtilityClass.SendSMSWithAPI(mm.mobile, ReciverMobileSMS, '1'));
    bg(() => UtilityClass.SendSMSWithAPI(FromMobile, SenderMobileSMS, '1'));
    bg(() => UtilityClass.SendEmailByApiSetting(mm.userName, '', '', '', '', '', lower(mm.Emailid), ReciverEmailSubject, ReciverDynamicEmailSms, fileUploader));
    // PORT-NOTE: legacy quirk kept - the sender mail uses the RECEIVER subject.
    bg(() => UtilityClass.SendEmailByApiSetting(FromName, '', '', '', '', '', lower(FromEmailid), ReciverEmailSubject, SenderDynamicEmailSms, fileUploader));
  }
  return Result;
}

/** public string Reject_Request(Int64 Regno, Int64 HRID, int ActionBy, string FromName, string FromMobile, string FromEmailid) */
async function Reject_Request(Regno, HRID, ActionBy, FromName, FromMobile, FromEmailid) {
  // dbo.Usp_Reject_Request @HRID,@ActionBy,@SessionRegno,@Message out
  const r = await db.procOne(DB, 'Usp_Reject_Request', { HRID, ActionBy, SessionRegno: Regno });
  const Result = B.str(B.col(r, 'Message'));
  const mm = await memberByRegNo(Regno);
  const SenderSms = await smsContent(37);
  if (!mm) throw B.nullRef();
  const SenderRejectMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(cat(mm.FName, mm.LName), SenderSms, '', '', 27);
  const ReciverSms = await smsContent(39);
  const ReciverRejectMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(FromName, ReciverSms, '', '', 28);
  const SenderRejectEmailAction = await emailAction(35);
  const SenderRejectEmailSubject = SenderRejectEmailAction.Email_Subject;
  await UtilityClass.FindingEmailContentWithUserIdPassword(FromName, SenderRejectEmailAction.Email_Content, '', '', 27, ''); // SenderRejectDynamicEmailSms (unused by legacy)
  const ReciverRejectEamilAction = await emailAction(36);
  const ReciverRejectEmailSubject = ReciverRejectEamilAction.Email_Subject;
  const ReciverRejectDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(cat(mm.FName, mm.LName), ReciverRejectEamilAction.Email_Content, '', '', 28, '');
  const fileUploader = null;
  if (Result === 'success') {
    bg(() => UtilityClass.SendSMSWithAPI(mm.mobile, ReciverRejectMobileSMS, '1'));
    bg(() => UtilityClass.SendSMSWithAPI(FromMobile, SenderRejectMobileSMS, '1'));
    bg(() => UtilityClass.SendEmailByApiSetting(mm.userName, '', '', '', '', '', lower(mm.Emailid), ReciverRejectEmailSubject, ReciverRejectDynamicEmailSms, fileUploader));
    // PORT-NOTE: legacy quirk kept - the sender mail has the receiver subject and the sender SUBJECT as its body.
    bg(() => UtilityClass.SendEmailByApiSetting(FromName, '', '', '', '', '', lower(FromEmailid), ReciverRejectEmailSubject, SenderRejectEmailSubject, fileUploader));
  }
  return Result;
}

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate) {
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const list = mapRows(await getSendLinksList(1, 9999999, SearchField, SearchValue, fromDate, toDate), INPROCESS_PROPS);
  if (list.length > 0) {
    let RowNumber = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Process_Link.xls', Filename,
      headers: ['S.No.', 'Order ID', 'BTC Address', 'Date'],
      rows: list,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(RowNumber)) + ' \t');
        w(B.tab(B.cellStr(item, 'orderID')) + ' \t');
        w(B.tab(B.cellStr(item, 'BlockChainAddress')) + ' \t');
        w(B.tab(B.cellStr(item, 'Create_Date')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/In-Process-Links" -> In_Process_Links/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/In-Process-Links'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) dynamicpagging = B.cvtInt(config.app.DynamicPagging); // Convert.ToInt16(value)
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const pr = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  const ex = B.str(B.col(pr, 'EXCELSTATUS'));
  const ie = B.str(B.col(pr, 'ISEDIT'));
  ViewBag.isactive = B.cvtInt(ex === '' ? '0' : ex);
  ViewBag.isedit = B.cvtInt(ie === '' ? '0' : ie);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  // USP_EXCEL_LINK @url,@ISACTIVE out  (CommandTimeout 1000)
  const el = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ia = B.str(B.col(el, 'ISACTIVE'));
  ViewBag.excelactive = B.cvtInt(ia === '0' ? '0' : ia); // "" (DBNull) => FormatException like Convert.ToInt32("")
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await getSendLinksList(page, MaxRows, SearchField, SearchValue, fromDate, toDate);
  const objGet_Inprocess_Links = mapRows(rows, INPROCESS_PROPS);
  const TotalRecord = P.intParse(B.str(B.col(rows[0], 'TotalCount'))); // int.Parse(spOutput.Value.ToString())
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.dynamicpagging = dynamicpagging;
  if (btnexel === 'Export Excel') {
    // PORT-NOTE: legacy Response.Redirect to the sheet ended the request; the file is sent directly instead.
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/In_Process_Links/Index.cshtml', Model: objGet_Inprocess_Links, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate), B.nStr(req.p.toDate));
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult ChangeStatus(string HRID, string Mode, string Regno, string FromName, string FromMobile, string FromEmailid)
// auth (legacy had no session check; confirms/rejects help requests and sends SMS/mail => protected)
router.all(`/admin/${C}/ChangeStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const HRID = B.nStr(req.p.HRID);
  const Mode = B.nStr(req.p.Mode);
  const Regno = B.nStr(req.p.Regno);
  const FromName = B.nStr(req.p.FromName);
  const FromMobile = B.nStr(req.p.FromMobile);
  const FromEmailid = B.nStr(req.p.FromEmailid);
  let ReturnResult = '';
  if (Mode === '2') ReturnResult = await Confirm_Request(toInt64(Regno), toInt64(HRID), 2, FromName, FromMobile, FromEmailid);
  else if (Mode === '3') ReturnResult = await Reject_Request(toInt64(Regno), toInt64(HRID), 2, FromName, FromMobile, FromEmailid);
  return res.json(ReturnResult);
}));

// ---------------------------------------------------------------- JsonResult Expiredateupdate(string orderID)
// auth (legacy had no session check; extends help-request expiry => protected)
router.all(`/admin/${C}/Expiredateupdate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const orderID = B.nStr(req.p.orderID);
  try {
    // update Help_Requests set Expire_Date=dateadd(HOUR, 24, Expire_Date) where LinkID='<orderID>'  (parameterised)
    const Ret = await db.exec(DB, "update help_requests set expire_date = expire_date + interval '24 hours' where linkid = @orderID",
      { orderID: orderID === null ? '' : orderID });
    if (Ret > 0) return res.json('ok' + Ret);
    return res.json('');
  } catch (ex) {
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- public string Confirm_Request(Int64 Regno, Int64 HRID, int ActionBy, string FromName, string FromMobile, string FromEmailid)
// auth (public method => routable in legacy; no session check there - protected here)
router.all(`/admin/${C}/Confirm_Request{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await Confirm_Request(B.reqInt(req.p.Regno, 'Regno'), B.reqInt(req.p.HRID, 'HRID'), B.reqInt(req.p.ActionBy, 'ActionBy'),
    B.nStr(req.p.FromName), B.nStr(req.p.FromMobile), B.nStr(req.p.FromEmailid));
  res.type('text/html').send(r); // string action => ContentResult
}));

// ---------------------------------------------------------------- public string Reject_Request(Int64 Regno, Int64 HRID, int ActionBy, string FromName, string FromMobile, string FromEmailid)
// auth (public method => routable in legacy; no session check there - protected here)
router.all(`/admin/${C}/Reject_Request{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await Reject_Request(B.reqInt(req.p.Regno, 'Regno'), B.reqInt(req.p.HRID, 'HRID'), B.reqInt(req.p.ActionBy, 'ActionBy'),
    B.nStr(req.p.FromName), B.nStr(req.p.FromMobile), B.nStr(req.p.FromEmailid));
  res.type('text/html').send(r); // string action => ContentResult
}));

module.exports = router;
