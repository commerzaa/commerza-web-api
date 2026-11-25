'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DirectorBonus.cs (class DirectorBonusController, no namespace => /DirectorBonus/...)
// Database: affiliate (Db_Affiliate). Procs USP_EXCEL_LINK, USP_DirectorBonus, UPS_GetDetailsFranchiseCode, USP_Frunchise_Statements,
// USP_FRANCHISEDETAILSBYFRID, USP_FranchisePending, USP_EXCEL_DOWNLOAD_HISTORY; tables tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/adminSession');
const {
  nInt, nStr, reqInt, col, str, cvtInt, nowStamp, excelHistory, writeXlsExport, cellStr, tab, netFormat, nullRef, at,
} = require('./_shared/batch06_common');
const { smsAction, emailAction, need } = require('./_shared/batch06_debit');

const router = express.Router();
const DB = 'affiliate';
const C = 'DirectorBonus';

/** public class DirectorBonus */
const DIRECTOR_BONUS_PROPS = ['RowNumber', 'USERNAME', 'FromUsername', 'Month', 'TOTALSELFBV', 'GROUPBV', 'COMM_PER', 'INCOME', 'ADMIN_AMT', 'TDS_AMT', 'Rank'];
/** ManageStock.cs class StockDetails */
const STOCK_DETAILS_PROPS = ['RowNumber', 'TKPMID', 'PLID', 'FRID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Username', 'EMAILID', 'MRP',
  'COUNTRY', 'STATE', 'ADDRESS', 'CITY', 'PINCODE', 'Prname', 'Code', 'Name', 'PRcode', 'TKPID', 'TransferStock', 'ATTRIBUTE'];
/** Pending_RequestController.cs class PendingRequest */
const PENDING_REQUEST_PROPS = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE',
  'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region', 'StoreType',
  'FRCode', 'Emailid', 'GST', 'TinNo', 'CommissionPer', 'Referralusername', 'Remark', 'USERNAME', 'Sponsor', 'Upline_FRcode', 'Paymentdate',
  'ModeName', 'ReferanceNo', 'Attachment', 'Bank'];
/** Pending_RequestController.cs class FranchiseDetails */
const FRANCHISE_DETAILS_PROPS = ['LOGINID', 'PASSWORD', 'EMAILID', 'MOBILE', 'NAME', 'FRCode'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate,
//   string SearchField, string SearchValue, string btnexel, string Click, int? Month)
// auth (PORT-NOTE: legacy dereferenced Session["Admin_User"] inside its try => adminAuth)
// route-config: "AdminPanel/Director-Bonus" -> DirectorBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Director-Bonus'], adminAuth, asyncHandler(async (req, res) => {
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
  if (Click === null) Click = '';
  if (Month === null) Month = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (btnexel === null) btnexel = ''; // eslint-disable-line no-unused-vars
  const ViewBag = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out  (the result is ignored: excelactive is hard-coded 0)
  await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const isactive = 0;
  ViewBag.excelactive = isactive;
  try {
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    const token = emp ? issueAdminToken(emp) : undefined;
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    // DBO.USP_DirectorBonus @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Month,@orderbydate,@SearchField,''
    const rows = await db.proc(DB, 'USP_DirectorBonus', {
      fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, Month, orderbydate, SearchField, Detail: '',
    });
    const DirectorBonus = mapRows(rows, DIRECTOR_BONUS_PROPS);
    const tc = str(col(rows[0], 'TotalCount'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
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
    let DirectorBonus_detils = [];
    if (Click !== '') {
      // DBO.USP_DirectorBonus @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Month,@orderbydate,@SearchField,@Detail
      DirectorBonus_detils = mapRows(await db.proc(DB, 'USP_DirectorBonus', {
        fromDate: '', toDate: '', MAXROWS: MaxRows, STARTROWINDEX: Page, Month: 0, orderbydate, SearchField: '', Detail: Click,
      }), DIRECTOR_BONUS_PROPS);
      ViewBag.check = 1;
    }
    ViewBag.Details = DirectorBonus_detils;
    const out = { view: '~/Views/AdminPanel/DirectorBonus/Index.cshtml', Model: DirectorBonus, ...ViewBag };
    if (token) out.token = token; // refreshed Session["Admin_User"]
    return res.json(out);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/DirectorBonus/Index.cshtml', ...ViewBag });
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
  const FranchiseDetails = mapRows(await db.proc(DB, 'USP_FRANCHISEDETAILSBYFRID', { FRID }), FRANCHISE_DETAILS_PROPS);
  const fd0 = at(FranchiseDetails, 0); // FranchiseDetails[0] => ArgumentOutOfRangeException when empty
  const PasswordForSmsOrEmail = await UtilityClass.Decryptword(fd0.PASSWORD);
  const VeryfimsgOTp = await smsAction(24);
  const OtpMessageForVerification = need(VeryfimsgOTp).Sms_Content; // eslint-disable-line no-unused-vars
  const emailVerificationmsg = await emailAction(20);
  if (intResult === 'success') {
    if (Number(VeryfimsgOTp.Sms_Send_Status) === 1) {
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(fd0.NAME, VeryfimsgOTp.Sms_Content, fd0.LOGINID, PasswordForSmsOrEmail, 12);
      Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(fd0.MOBILE, messg, '1'))
        .catch((e) => console.error('[admin] DirectorBonus SMS thread failed:', e.message));
    }
    if (Number(need(emailVerificationmsg).Email_Send_Status) === 1) {
      const Mailmsg = emailVerificationmsg.Email_Content;
      const fileUploader = null;
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(fd0.NAME, Mailmsg, fd0.LOGINID, PasswordForSmsOrEmail, 11, '');
      Promise.resolve().then(() => {
        if (fd0.EMAILID === null || fd0.EMAILID === undefined) throw nullRef();
        return UtilityClass.SendEmailByApiSetting(fd0.NAME, PasswordForSmsOrEmail, '', '', '', '', String(fd0.EMAILID).toLowerCase(),
          emailVerificationmsg.Email_Subject, DynamicMsg, fileUploader);
      }).catch((e) => console.error('[admin] DirectorBonus email thread failed:', e.message));
    }
  }
  return res.json(intResult);
}));

// ---------------------------------------------------------------- JsonResult Details(int FRID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Details{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FRID = reqInt(req.p.FRID, 'FRID');
  // DBO.USP_FranchisePending @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@FRID
  const PendingRequestLIst = mapRows(await db.proc(DB, 'USP_FranchisePending', {
    fromDate: '', toDate: '', MAXROWS: 1, STARTROWINDEX: 1, FRID,
  }), PENDING_REQUEST_PROPS);
  res.json(PendingRequestLIst);
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"]). Not called by Index.
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Page = nInt(req.p.Page);
  const FromDate = nStr(req.p.FromDate);
  const ToDate = nStr(req.p.ToDate);
  const userid = req.user.emp_id;
  const Filename = 'Pending_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  const list = mapRows(await db.proc(DB, 'USP_FranchisePending', {
    fromDate: FromDate, toDate: ToDate, MAXROWS: MaxRows, STARTROWINDEX: Page, FRID: '',
  }), PENDING_REQUEST_PROPS);
  let x = { sent: false };
  if (list.length > 0) {
    x = await writeXlsExport({
      req, res, sheet: 'Pending_Request.xls', Filename, ViewBag: {}, rows: list,
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
        for (const k of ['ADDRESS', 'STATE', 'CITY', 'PINCODE', 'Taluk', 'District', 'Circle', 'Region']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
