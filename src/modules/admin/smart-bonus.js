'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SmartBonus.cs (class SmartBonusController, no namespace => /admin/SmartBonus/...)
// Database: affiliate (Db_Affiliate). Procs USP_SmartBonus, UPS_GetDetailsFranchiseCode, USP_Frunchise_Statements, USP_FRANCHISEDETAILSBYFRID,
// USP_FranchisePending, USP_EXCEL_DOWNLOAD_HISTORY; tables tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, col, str, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, netFormat, nullRef, at,
} = require('./_shared/batch11-common');
const { smsAction, emailAction, need } = require('./_shared/batch06-debit');
const { fireAndForget, PENDING_REQUEST_PROPS, FRANCHISE_DETAILS_PROPS, STOCK_DETAILS_PROPS } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'SmartBonus';
const VIEW = '~/Views/AdminPanel/SmartBonus/Index.cshtml';

/** public class SmartBonus */
const SMART_BONUS_PROPS = ['RowNumber', 'USERNAME', 'FromUsername', 'Month', 'TOTALSELFBV', 'GROUPBV', 'COMM_PER', 'INCOME', 'ADMIN_AMT', 'TDS_AMT',
  'Pointvalue', 'Totalpointvalue', 'MemberValue'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
// (private string regno = "" - unused instance field)
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
async function ExportReport(req, res, ViewBag, Page, FromDate, ToDate) {
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
      req, res, sheet: 'Pending_Request.xls', Filename, ViewBag, rows: list,
      // PORT-NOTE: 14 headers but 13 cells per row ("Commision" has no cell, its write is commented out) - legacy layout kept.
      headers: ['S.No.', 'Name', 'Applied For', 'Commision', 'Mobile', 'Date', 'Address', 'State', 'City', 'PinCode', 'Taluk', 'District', 'Circle', 'Region'],
      innerProc: 'AllEPinRequestsList', outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'FNAME')) + ' \t');
        w(tab(cellStr(item, 'PackageName')) + ' \t');
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(netFormat(item.DATE, 'ddMMMyyyy')) + ' \t');
        for (const k of ['ADDRESS', 'STATE', 'CITY', 'PINCODE', 'Taluk', 'District', 'Circle', 'Region']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate,
//   string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth (PORT-NOTE: legacy dereferenced Session["Admin_User"] inside its try => adminAuth)
// route-config: "AdminPanel/Smart-Bonus" -> SmartBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Smart-Bonus'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let Page = nInt(req.p.Page);
  let FromDate = nStr(req.p.FromDate);
  let ToDate = nStr(req.p.ToDate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let btnexel = nStr(req.p.btnexel);
  let Click = nStr(req.p.Click);
  let Month = nInt(req.p.Month);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (Click === null) Click = ''; // eslint-disable-line no-unused-vars
  if (Month === null) Month = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  const out = {};
  try {
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!emp) throw nullRef(); // EM.Emp_ID on the refreshed (null) session object
    out.token = issueAdminToken(emp); // refreshed Session["Admin_User"]
    Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission / GetExcelPermission
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    // DBO.USP_SmartBonus @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Month,@orderbydate,@SearchField,''
    // (the 9th positional argument '' binds @SearchValue; the named @SearchValue SqlParameter is not referenced by the SQL text)
    const rows = await db.proc(DB, 'USP_SmartBonus', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, Month, orderbydate, SearchField: SearchField.trim(), SearchValue: '',
    });
    const SmartBonus = mapRows(rows, SMART_BONUS_PROPS);
    const tc = str(col(rows[0], 'TotalCount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
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
    ViewBag.check = 0;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: VIEW, Model: SmartBonus, ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: VIEW, Model: null, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- JsonResult GetFRCODE(string prefix)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetFRCODE{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ObjUserName = mapRows(await db.proc(DB, 'UPS_GetDetailsFranchiseCode', { UserName: nStr(req.p.prefix) }), STOCK_DETAILS_PROPS);
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
  let intResult = '';
  const loginid = req.user.emp_id;
  const pass = 100000 + Math.floor(Math.random() * 900000); // new Random().Next(100000, 1000000)
  const Password = await UtilityClass.Encryptword(String(pass));
  // USP_Frunchise_Statements @FRID,@PLID,@Regno,@Remark,@status,@IntResult OUT,@PassWord,@referralusername  (DoNotEnsureTransaction)
  const row = await db.procOne(DB, 'USP_Frunchise_Statements', {
    FRID, PLID: Emp_ID, Regno: loginid, Remark, status, PassWord: Password, referralusername,
  });
  intResult = str(col(row, 'IntResult'));
  // USP_FRANCHISEDETAILSBYFRID @FRID
  const FranchiseDetails = mapRows(await db.proc(DB, 'USP_FRANCHISEDETAILSBYFRID', { FRID }), FRANCHISE_DETAILS_PROPS);
  const fd0 = at(FranchiseDetails, 0); // FranchiseDetails[0] => ArgumentOutOfRangeException when empty
  const PasswordForSmsOrEmail = await UtilityClass.Decryptword(fd0.PASSWORD);
  const VeryfimsgOTp = await smsAction(24);
  const OtpMessageForVerification = need(VeryfimsgOTp).Sms_Content; // eslint-disable-line no-unused-vars
  const emailVerificationmsg = await emailAction(20);
  if (intResult === 'success') {
    if (Number(VeryfimsgOTp.Sms_Send_Status) === 1) {
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(fd0.NAME, VeryfimsgOTp.Sms_Content, fd0.LOGINID, PasswordForSmsOrEmail, 12);
      fireAndForget('SmartBonus SMS', () => UtilityClass.SendSMSWithAPI(fd0.MOBILE, messg, '1'));
    }
    if (Number(need(emailVerificationmsg).Email_Send_Status) === 1) {
      const Mailmsg = emailVerificationmsg.Email_Content;
      const fileUploader = null;
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(fd0.NAME, Mailmsg, fd0.LOGINID, PasswordForSmsOrEmail, 11, '');
      fireAndForget('SmartBonus email', () => {
        if (fd0.EMAILID === null || fd0.EMAILID === undefined) throw nullRef();
        return UtilityClass.SendEmailByApiSetting(fd0.NAME, PasswordForSmsOrEmail, '', '', '', '', String(fd0.EMAILID).toLowerCase(),
          emailVerificationmsg.Email_Subject, DynamicMsg, fileUploader);
      });
    }
  }
  return res.json(intResult);
}));

// ---------------------------------------------------------------- JsonResult Details(int FRID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Details{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FRID = reqInt(req.p.FRID, 'FRID');
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID   (MaxRows = 100 declared, 1 passed)
  const PendingRequestLIst = mapRows(await db.proc(DB, 'USP_FranchisePending', {
    fromDate: '', toDate: '', MAXROWS: 1, STARTROWINDEX: 1, FRID,
  }), PENDING_REQUEST_PROPS);
  res.json(PendingRequestLIst);
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nInt(req.p.Page), nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField), nStr(req.p.SearchValue));
  if (!r.sent && !res.headersSent) res.send(''); // void action => empty response
}));

module.exports = router;
