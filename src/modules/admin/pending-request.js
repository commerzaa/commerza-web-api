'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Pending_RequestController.cs (class Pending_RequestController, no namespace
// => /admin/Pending_Request/...). Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS, USP_FranchisePending,
// UPS_GetDetailsFranchiseCode, USP_Frunchise_Statements, USP_FRANCHISEDETAILSBYFRID, USP_EXCEL_DOWNLOAD_HISTORY; tables tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const {
  nInt, nStr, reqInt, col, str, nowStamp, excelHistory, writeXlsExport, cellStr, tab, netFormat, nullRef, at, excelLink, inlinePerms, outIntOf,
} = require('./_shared/batch11-common');
const { smsAction, emailAction, need } = require('./_shared/batch06-debit');
const { STOCK_DETAILS_PROPS } = require('./_shared/batch07-d-common');
const { PENDING_REQUEST_PROPS, FRANCHISE_DETAILS_PROPS } = require('./_shared/batch13-01-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Pending_Request';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue) { // eslint-disable-line no-unused-vars
  const userid = req.user.emp_id;
  const Filename = 'Pending_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID
  const list = mapRows(await db.proc(DB, 'USP_FranchisePending', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, FRID: '',
  }), PENDING_REQUEST_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Pending_Request.xls', Filename, rows: list,
      // PORT-NOTE: 14 headers but 13 cells per row ("Commision" has no cell) - legacy layout kept.
      headers: ['S.No.', 'Name', 'Applied For', 'Commision', 'Mobile', 'Date', 'Address', 'State', 'City', 'PinCode', 'Taluk', 'District', 'Circle', 'Region'],
      innerProc: 'AllEPinRequestsList', outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'FNAME')) + ' \t');
        w(tab(cellStr(item, 'PackageName')) + ' \t');
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(netFormat(item.DATE, 'ddMMMyyyy')) + ' \t');
        w(tab(cellStr(item, 'ADDRESS')) + ' \t');
        w(tab(cellStr(item, 'STATE')) + ' \t');
        w(tab(cellStr(item, 'CITY')) + ' \t');
        w(tab(cellStr(item, 'PINCODE')) + ' \t');
        w(tab(cellStr(item, 'Taluk')) + ' \t');
        w(tab(cellStr(item, 'District')) + ' \t');
        w(tab(cellStr(item, 'Circle')) + ' \t');
        w(tab(cellStr(item, 'Region')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate,
//   string ToDate, string SearchField, string SearchValue, string btnexel)
// auth (PORT-NOTE: legacy had no session check but dereferenced Session["Admin_User"] inside its try => adminAuth)
// route-config: "AdminPanel/Pending-Request" -> Pending_Request/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Pending-Request{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let Page = nInt(req.p.Page);
  let FromDate = nStr(req.p.FromDate);
  let ToDate = nStr(req.p.ToDate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  let token;
  try {
    const Empid = req.user.emp_id;
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid)
    if (!emp) throw nullRef(); // EM.Emp_ID on a null session object
    token = issueAdminToken(emp);
    const Employeeid = emp.Emp_ID;
    const p = await inlinePerms(Employeeid, url);
    ViewBag.isactive = p.isactive;
    ViewBag.isedit = p.isedit;
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID,@orderbydate,@SearchField
    const rows = await db.proc(DB, 'USP_FranchisePending', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, FRID: '', orderbydate, SearchField,
    });
    const LiUserWiseIWalletStatementsController_Report = mapRows(rows, PENDING_REQUEST_PROPS);
    const TotalRecord = outIntOf(rows, 'TotalCount'); // int.Parse(v == "" ? "0" : v)
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = FromDate;
    ViewBag.toDate = ToDate;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    const out = { view: '~/Views/AdminPanel/Pending_Request/Index.cshtml', Model: LiUserWiseIWalletStatementsController_Report, ...ViewBag };
    if (token) out.token = token; // refreshed Session["Admin_User"]
    return res.json(out);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/Pending_Request/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- JsonResult GetFRCODE(string prefix)
// auth (PORT-NOTE: legacy had no session check; admin data (franchise lookup) => adminAuth)
router.all(`/admin/${C}/GetFRCODE{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const prefix = nStr(req.p.prefix);
  // [UPS_GetDetailsFranchiseCode] @UserName
  const ObjUserName = mapRows(await db.proc(DB, 'UPS_GetDetailsFranchiseCode', { UserName: prefix }), STOCK_DETAILS_PROPS);
  res.json(ObjUserName);
}));

// ---------------------------------------------------------------- JsonResult StatusUpdate(int Emp_ID, string Remark, string status, int FRID, string referralusername)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/StatusUpdate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Emp_ID = reqInt(req.p.Emp_ID, 'Emp_ID');
  const Remark = nStr(req.p.Remark);
  const status = nStr(req.p.status);
  const FRID = reqInt(req.p.FRID, 'FRID');
  const referralusername = nStr(req.p.referralusername);
  let Result = 0; // eslint-disable-line no-unused-vars
  let intResult = '';
  const loginid = req.user.emp_id;
  const pass = 100000 + Math.floor(Math.random() * 900000); // new Random().Next(100000, 1000000)
  const Password = await UtilityClass.Encryptword(String(pass));
  // USP_Frunchise_Statements @FRID,@PLID,@Regno,@Remark,@status,@IntResult OUT,@PassWord,@referralusername,@EID  (DoNotEnsureTransaction)
  const row = await db.procOne(DB, 'USP_Frunchise_Statements', {
    FRID, PLID: Emp_ID, Regno: loginid, Remark, status, PassWord: Password, referralusername, EID: req.user.emp_id,
  });
  // (Result = rows affected by ExecuteSqlCommand - never used afterwards)
  intResult = str(col(row, 'IntResult'));
  // USP_FRANCHISEDETAILSBYFRID @FRID
  const FranchiseDetails = mapRows(await db.proc(DB, 'USP_FRANCHISEDETAILSBYFRID', { FRID }), FRANCHISE_DETAILS_PROPS);
  const fd0 = at(FranchiseDetails, 0); // FranchiseDetails[0] => ArgumentOutOfRangeException when empty
  const PasswordForSmsOrEmail = await UtilityClass.Decryptword(fd0.PASSWORD);
  const VeryfimsgOTp = await smsAction(24); // db._TBL_SMSACTION.Where(a => a.ID == 24).FirstOrDefault()
  const OtpMessageForVerification = need(VeryfimsgOTp).Sms_Content; // eslint-disable-line no-unused-vars
  const emailVerificationmsg = await emailAction(20); // db._tbl_emailaction.Where(a => a.EID == 20).FirstOrDefault()
  if (intResult === 'success') {
    if (Number(VeryfimsgOTp.Sms_Send_Status) === 1) {
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(fd0.NAME, VeryfimsgOTp.Sms_Content, fd0.LOGINID, PasswordForSmsOrEmail, 12);
      Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(fd0.MOBILE, messg, '1'))
        .catch((e) => console.error('[admin] Pending_Request SMS thread failed:', e.message));
    }
    if (Number(need(emailVerificationmsg).Email_Send_Status) === 1) {
      const Mailmsg = emailVerificationmsg.Email_Content;
      const fileUploader = null;
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(fd0.NAME, Mailmsg, fd0.LOGINID, PasswordForSmsOrEmail, 11, '');
      Promise.resolve().then(() => {
        if (fd0.EMAILID === null || fd0.EMAILID === undefined) throw nullRef();
        return UtilityClass.SendEmailByApiSetting(fd0.NAME, PasswordForSmsOrEmail, '', '', '', '', String(fd0.EMAILID).toLowerCase(),
          emailVerificationmsg.Email_Subject, DynamicMsg, fileUploader);
      }).catch((e) => console.error('[admin] Pending_Request email thread failed:', e.message));
    }
  }
  return res.json(intResult);
}));

// ---------------------------------------------------------------- JsonResult Details(int FRID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Details{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FRID = reqInt(req.p.FRID, 'FRID');
  const MaxRows = 100; // eslint-disable-line no-unused-vars
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID
  const PendingRequestLIst = mapRows(await db.proc(DB, 'USP_FranchisePending', {
    fromDate: '', toDate: '', MAXROWS: 1, STARTROWINDEX: 1, FRID,
  }), PENDING_REQUEST_PROPS);
  res.json(PendingRequestLIst);
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nInt(req.p.Page), nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField),
    nStr(req.p.SearchValue));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
