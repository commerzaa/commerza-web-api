'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BankWithdrawalRequestController.cs (class BankWithdrawalRequestController => /BankWithdrawalRequest/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const ATCAPI = require('../../lib/admin/ATCAPI');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, reqInt, toInt32, toStr, nullRef, tab, nowStamp, tsvExport } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'BankWithdrawalRequest';

/** class PayoutReport (PayoutReportController.cs) */
const PAYOUTREPORT_PROPS = ['RowNumber', 'Date', 'EmailId', 'FULLEmailId', 'UserName', 'FullName', 'PHONE', 'WITHDRAWAMOUNT', 'PayableAmount',
  'AccountNo', 'AccountHolderName', 'BankName', 'BranchName', 'IFSCCODE', 'WDID', 'Status', 'TransactionId', 'ADMIN_REMARK', 'ATC_WalletAddress',
  'ATCUserId', 'ActivityByUserId', 'TDS', 'ADMINCHARGE', 'transactionid', 'Processing_Fee', 'INCOMETYPENAME', 'Repurchase'];
/** class ATCDatails (PayoutReportController.cs) */
const ATCDATAILS_PROPS = ['INR', 'Atc_WalletAddress', 'ATCUserId'];
/** class ATCWalletDetails (PayoutReportController.cs) */
const ATCWALLETDETAILS_PROPS = ['FromUserid', 'ToUserId', 'ToWalletAddress', 'NoOfCoin'];
/** class ShowChart (PayoutReportController.cs) */
const SHOWCHART_PROPS = ['DATE', 'USERNAME', 'PHONE', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSC', 'WithDrawlPoints',
  'Atc_WalletAddress', 'STATUS'];
/** class Club_downloadExcel (Pending_Withdrawals.cs) */
const CLUB_DOWNLOADEXCEL_PROPS = ['RowNumber', 'Date', 'UserName', 'Grossamount', 'ADMINCHARGE', 'TDS', 'NetAmount', 'AccountNo', 'AccountHolderName',
  'BankName', 'BranchName', 'IFSCCODE', 'Status', 'FileName', 'Clubgroup', 'TotalRequest', 'TotalAmount', 'TotalTransaction', 'ProcessDate',
  'ProcessBY', 'ProcessIPAddress', 'DrAccountNo'];
/** class TRANSACTION */
const TRANSACTION_PROPS = ['Request', 'NoOFTransaction', 'AMOUNT'];
// class banklist (TABDID, Name, BankName, FileName, BankID, AccountNo) is declared in the C# file but never used.

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

const mapPath = (v) => path.join(config.uploadDir, String(v || '').replace(/^~?[\\/]*/, ''));
const fix2 = (v) => { if (v === null || v === undefined) nullRef(); return Number(v).toFixed(2); };

/** C# String.Substring(startIndex, length) with the .NET Framework argument checks/messages */
function csSubstring(s, startIndex, length) {
  if (s === null || s === undefined) nullRef();
  if (startIndex < 0) throw new Error('StartIndex cannot be less than zero.\r\nParameter name: startIndex');
  if (startIndex > s.length) throw new Error('startIndex cannot be larger than length of string.\r\nParameter name: startIndex');
  if (length < 0) throw new Error('Length cannot be less than zero.\r\nParameter name: length');
  if (startIndex > s.length - length) throw new Error('Index and length must refer to a location within the string.\r\nParameter name: length');
  return s.substr(startIndex, length);
}
/** JArray.Parse(x)[0][key].ToString() */
function jarr0(text, key) {
  let a;
  try { a = JSON.parse(text); } catch (e) { throw new Error(`Unexpected character encountered while parsing value: ${String(text).slice(0, 1)}. Path '', line 0, position 0.`); }
  if (!Array.isArray(a)) throw new Error('Error reading JArray from JsonReader. Current JsonReader item is not an array.');
  if (a.length === 0) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
  const v = a[0] && typeof a[0] === 'object' ? a[0][key] : undefined;
  if (v === undefined) nullRef();
  return v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
}
/** Emp_Master.Emp_Code.ToString() + " " + "(" + Emp_Master.Emp_Name + ")" */
function activityBy(req) {
  const code = req.user ? req.user.emp_code : null;
  if (code === null || code === undefined) nullRef();
  return `${String(code)} (${req.user.emp_name === null || req.user.emp_name === undefined ? '' : req.user.emp_name})`;
}

/** Shared mail block of Approve_Withdrawal / ApproveOrRejectWithdrawalInBulk (status 1 => EID 40 / mode 32, status 2 => EID 41 / mode 33). */
async function sendWithdrawalMail(username, status, remarks) {
  const eid = status === 1 ? 40 : 41;
  // Db._Member_Master.Where(a => a.userName == username).Select(a => a.Emailid).FirstOrDefault()
  const er = await db.queryOne(DB, 'select emailid from member_master where username = @username limit 1', { username });
  const EmailId = er ? col(er, 'emailid') : null;
  const emailmsg = await db.queryOne(DB, 'select email_content, email_send_status, email_subject, action_name, eid from tbl_emailaction where eid = @eid limit 1', { eid });
  if (!emailmsg) nullRef(); // emailmsg.Email_Content on null
  const em = mapRow(emailmsg, ['Email_Content', 'Email_Send_Status', 'Email_Subject', 'Action_Name', 'EID']);
  const WithdrawalMsg = em.Email_Content;
  const DynamicSponcerMsg = status === 1
    ? await UtilityClass.FindingEmailContentWithUserIdPassword(username, WithdrawalMsg, EmailId, '', 32, '', '', 0, 0, '')
    : await UtilityClass.FindingEmailContentWithUserIdPassword(username, WithdrawalMsg, EmailId, '', 33, '', remarks, 0, 0, '');
  if (Number(em.Email_Send_Status) === 1) {
    // new Thread(() => SendEmailByApiSetting(...)).Start()  => fire-and-forget
    setImmediate(() => {
      Promise.resolve().then(() => {
        if (EmailId === null || EmailId === undefined) nullRef(); // EmailId.ToLower() inside the thread
        return UtilityClass.SendEmailByApiSetting(username, '', '', '', '', '', String(EmailId).toLowerCase(), em.Email_Subject, DynamicSponcerMsg, null);
      }).catch((e) => console.error('[admin/BankWithdrawalRequest] mail thread failed:', e.message));
    });
  }
}

/** public string Approve_WithdrawalInBulk(int wdid, int status, string remarks) */
async function Approve_WithdrawalInBulk(req, wdid, status, remarks) { // eslint-disable-line no-unused-vars
  let ret = '';
  let TransactionId = '';
  try {
    let Obj = null;
    if (status === 1) {
      const r = await db.procOne(DB, 'Usp_ATCTransfer', { Wdid: wdid });
      Obj = r ? mapRow(r, ATCWALLETDETAILS_PROPS) : null;
      try {
        // #region For Check Receiver Atc Wallet Address Exists Or Not
        if (!Obj) nullRef();
        const APIResponseValidate = await ATCAPI.ValidateATCWalletAddress(Obj.ToWalletAddress);
        const ATCWalletValidate = csSubstring(APIResponseValidate, 2, APIResponseValidate.length - 4).replace(/\\/g, '');
        const ResponseValidate = jarr0(ATCWalletValidate, 'Response');
        const IsSuccessValidate = jarr0(ATCWalletValidate, 'IsSuccess');
        if (IsSuccessValidate.trim() !== '1') return ResponseValidate;
        // #endregion
        const APIResponse = await ATCAPI.ATCSendReceived(Obj.FromUserid, Obj.ToWalletAddress, Obj.NoOfCoin === null ? '' : String(Obj.NoOfCoin));
        const RegistrationResponse = csSubstring(APIResponse, 2, APIResponse.length - 4).replace(/\\/g, '');
        const ResponseMessage = jarr0(RegistrationResponse, 'Response');
        TransactionId = jarr0(RegistrationResponse, 'TxID');
        if (ResponseMessage.trim().toLowerCase() !== 'true') return ResponseMessage;
        if (TransactionId === '') return ResponseMessage;
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, 'Check Receiver Atc Wallet Address Exists Or Not');
        return ExpObj.message;
      }
    }
    const ActivityByUserId = activityBy(req);
    const row = await db.procOne(DB, 'USP_WITHDRAWAL_APPROVEORREJECT', {
      WDID: wdid, MODE: status, ActivityByUserId, TransactionId,
    });
    ret = str(col(row, 'strresult'));
    return ret;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_WITHDRAWAL_APPROVEORREJECT');
    ret = ExpObj.message;
    return ret;
  }
}

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string Userdownlinemember) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, ByStatus, page, OrderBy, Userdownlinemember) {
  const userid = req.user.emp_id;
  const Filename = `PayoutReport_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, MODE: '1', FILENAME: Filename });
  let loginid = ''; let phone = ''; let accountno = ''; let ifsccode = ''; let accountholdername = ''; let bankname = '';
  let branchname = ''; let username = ''; let NAME = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  } else if (SearchField === 'emailid') loginid = SearchValue.trim();
  else if (SearchField === 'mobile') phone = SearchValue.trim();
  else if (SearchField === 'accnum') accountno = SearchValue.trim();
  else if (SearchField === 'ifsc') ifsccode = SearchValue.trim();
  else if (SearchField === 'accholname') accountholdername = SearchValue.trim();
  else if (SearchField === 'bankname') bankname = SearchValue.trim();
  else if (SearchField === 'branchname') branchname = SearchValue.trim();
  else if (SearchField === 'username') username = SearchValue.trim();
  else if (SearchField === 'Name') NAME = SearchValue.trim();
  if (OrderBy === null) OrderBy = ''; // eslint-disable-line no-param-reassign
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  // [USP_BANKWITHDRAWLREQUESTREPORT] (export: @totalTDS/@TotalAdminC passed as input "0", @SIDE 0, @orderbydate "")
  const Obj = mapRows(await db.proc(DB, 'USP_BANKWITHDRAWLREQUESTREPORT', {
    WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: loginid, Phone: phone, AccountNo: accountno, IFSCCODE: ifsccode,
    AccountHolderName: accountholdername, BANKNAME: bankname, BRANCHNAME: branchname, STARTROWINDEX: page, MAXROWS: MaxRows, Mode: '1',
    Username: username, STATUS: ByStatus.trim(), Userdownlinemember, SIDE: 0, totalTDS: '0', TotalAdminC: '0', SUMWITHDRAWLPOINTS1: '0',
    TotalAmt: '0', orderbydate: '', NAME,
  }), PAYOUTREPORT_PROPS);
  if (Obj.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'BankWithdrawalRequestReport.xls', attachName: ' PayoutReport.xls', filename: Filename, rows: Obj,
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      headers: ['S.No. \t', 'Date \t', 'Username \t', 'Name \t', 'A/c Holder Name. \t', 'Bank Name \t', 'Account No. \t', 'IFSC \t', 'Branch \t',
        'TDS \t', 'Amount \t', 'PayableAmount  \t', 'Status \t', 'Activity By \t'],
      cells: (item, w) => {
        for (const k of ['RowNumber', 'Date', 'UserName', 'FullName', 'AccountHolderName', 'BankName']) w(tab(toStr(item[k])) + ' \t');
        w(tab("'" + toStr(item.AccountNo)) + ' \t');
        w(tab(toStr(item.IFSCCODE)) + ' \t');
        w(tab(toStr(item.BranchName)) + ' \t');
        w(tab(fix2(item.TDS)) + ' \t');
        w(tab(toStr(item.WITHDRAWAMOUNT)) + ' \t');
        w(tab(fix2(item.PayableAmount)) + ' \t');
        w(tab(toStr(item.Status)) + ' \t');
        w(toStr(item.ActivityByUserId).replace(/\t/g, '   ') + ' \t'); // (3 spaces here in legacy)
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side, string btnexelreadonly)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Bank-Withdrawal-Request" -> BankWithdrawalRequest/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Bank-Withdrawal-Request'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromDate = sv(req.p.fromDate);
  let toDate = sv(req.p.toDate);
  let ByStatus = sv(req.p.ByStatus);
  let page = nint(req.p.page);
  let OrderBy = sv(req.p.OrderBy);
  const releasepayout = sv(req.p.releasepayout);
  let btnexel = sv(req.p.btnexel);
  let Userdownlinemember = sv(req.p.Userdownlinemember);
  let Side = nint(req.p.Side);
  const btnexelreadonly = sv(req.p.btnexelreadonly);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let loginid = ''; let phone = ''; let accountno = ''; let ifsccode = ''; let accountholdername = ''; let bankname = '';
  let branchname = ''; let username = ''; let NAME = '';
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = toInt32(config.app.DynamicPagging); // Convert.ToInt16(AppSettings["DynamicPagging"])
  if (orderbydate === null) orderbydate = '';
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const MaxRows = Number(dynamicpagging);
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  } else if (SearchField === 'emailid') loginid = SearchValue.trim();
  else if (SearchField === 'mobile') phone = SearchValue.trim();
  else if (SearchField === 'AccountNo') accountno = SearchValue.trim();
  else if (SearchField === 'IFSCCODE') ifsccode = SearchValue.trim();
  else if (SearchField === 'accholname') accountholdername = SearchValue.trim();
  else if (SearchField === 'BankName') bankname = SearchValue.trim();
  else if (SearchField === 'branchname') branchname = SearchValue.trim();
  else if (SearchField === 'username') username = SearchValue.trim();
  else if (SearchField === 'AccountHolderName') accountholdername = SearchValue.trim();
  else if (SearchField === 'Name') NAME = SearchValue.trim();
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  const rows = await db.proc(DB, 'USP_BANKWITHDRAWLREQUESTREPORT', {
    WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: loginid, Phone: phone, AccountNo: accountno, IFSCCODE: ifsccode,
    AccountHolderName: accountholdername, BANKNAME: bankname, BRANCHNAME: branchname, STARTROWINDEX: page, MAXROWS: MaxRows, Mode: '1',
    Username: username, STATUS: ByStatus.trim(), Userdownlinemember, SIDE: Side, SUMWITHDRAWLPOINTS1: '0', TotalAmt: '0', orderbydate, NAME,
  });
  const Obj = mapRows(rows, PAYOUTREPORT_PROPS);
  const r0 = rows[0];
  const rc = str(col(r0, 'recordcount'));
  const TotalRecord = parseInt(rc === '' ? '0' : rc, 10);
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  const sw = col(r0, 'sumwithdrawalamt');
  if (sw === null || sw === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDecimal(DBNull)
  const SumofWithdrawal = Number(sw);
  ViewBag.totalWithdrawal = SumofWithdrawal;
  ViewBag.totalTDS = col(r0, 'totaltds') === undefined ? null : col(r0, 'totaltds');
  ViewBag.TotalAdminC = col(r0, 'totaladminc') === undefined ? null : col(r0, 'totaladminc');
  if (releasepayout !== null) {
    if (releasepayout === 'Release Current Page All Payout') {
      for (const ItemForPayoutRelease of Obj) {
        if (ItemForPayoutRelease.Status === null) nullRef();
        if (String(ItemForPayoutRelease.Status).trim().toLowerCase() === 'pending') {
          if (ItemForPayoutRelease.ATC_WalletAddress !== '' && ItemForPayoutRelease.ATCUserId !== '') {
            // eslint-disable-next-line no-unused-vars
            const MethodCallReturn = await Approve_WithdrawalInBulk(req, toInt32(ItemForPayoutRelease.WDID), 1, 'Your Payout Released');
          }
        }
      }
    }
  }
  ViewBag.CurrentPage = page;
  ViewBag.Userdownlinemember = Userdownlinemember;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.SearchValue = SearchValue;
  ViewBag.ByStatus = ByStatus;
  ViewBag.OrderBy = OrderBy;
  try {
    const ar = await db.procOne(DB, 'Get_AdminATCDetails', {});
    const ObjSATCDatails = ar ? mapRow(ar, ATCDATAILS_PROPS) : null;
    if (!ObjSATCDatails) nullRef();
    const { ATCUserId } = ObjSATCDatails;
    const { Atc_WalletAddress } = ObjSATCDatails;
    ViewBag.Atc_WalletAddress = Atc_WalletAddress;
    ViewBag.Atc_Rate = fix2(ObjSATCDatails.INR);
    if (ATCUserId !== '' && Atc_WalletAddress !== '' && ATCUserId !== null && Atc_WalletAddress !== null) {
      try {
        const APIResponse = await ATCAPI.GetATCWalletBalance(ATCUserId, Atc_WalletAddress);
        const RegistrationResponse = csSubstring(APIResponse, 2, APIResponse.length - 4).replace(/\\/g, '');
        const ATCCoin = jarr0(RegistrationResponse, 'Response');
        ViewBag.ATCCoin = ATCCoin;
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, 'ItemForPayoutRelease');
        ViewBag.ATCCoin = '0.00000000';
        ViewBag.Message = ExpObj.message;
      }
    } else {
      ViewBag.ATCCoin = '0.00000000';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_BANKWITHDRAWLREQUESTREPORT');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.ATCCoin = '0.00000000';
  }
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, ByStatus, page, OrderBy, Userdownlinemember)) return undefined;
  }
  if (btnexelreadonly === 'Club Excel ReadOnly') {
    // (empty block in legacy)
  }
  return res.json({ view: '~/Views/AdminPanel/BankWithdrawalRequest/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReportReadOnly(string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string Userdownlinemember, int? Side)
// auth (admin-only club withdrawal NEFT export; PORT-NOTE: legacy had no session check)
router.all(`/admin/${C}/ExportReportReadOnly{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const page = nint(req.p.page);
  try {
    const obj1 = mapRows(await db.proc(DB, 'usp_clubhistory', {
      WithDrawalFromDate: '', WithDrawalToDate: '', LoginId: '', Phone: '', AccountNo: '', IFSCCODE: '', AccountHolderName: '', BANKNAME: '',
      BRANCHNAME: '', STARTROWINDEX: page, MAXROWS: 1000000, Mode: '1', Username: '', STATUS: '', Userdownlinemember: '', SIDE: 0, totalTDS: '0',
      TotalAdminC: '0', SUMWITHDRAWLPOINTS1: '0', TotalAmt: '0', orderbydate: '', ProcessBy: '', ProcessIPAddress: '',
    }), CLUB_DOWNLOADEXCEL_PROPS);
    // PORT-NOTE: Microsoft.Office.Interop.Excel replaced by exceljs (lazy). Template ~/WithdrawalsClubExcel/NEFT-Converter-bulk-Upload.xlsx,
    // sheet "NEFT Converter", rows from 17. AutoFit and the Locked flags (no sheet protection => no effect) are approximated.
    const ExcelJS = require('exceljs'); // eslint-disable-line global-require
    const tpl = mapPath('~/WithdrawalsClubExcel/NEFT-Converter-bulk-Upload.xlsx');
    let mWorkBook = null;
    if (fs.existsSync(tpl)) {
      mWorkBook = new ExcelJS.Workbook();
      await mWorkBook.xlsx.readFile(tpl);
    }
    if (!mWorkBook) nullRef(); // mWorkBook.Worksheets on null
    const mWSheet1 = mWorkBook.getWorksheet('NEFT Converter');
    if (!mWSheet1) throw new Error('Invalid index. (Exception from HRESULT: 0x8002000B (DISP_E_BADINDEX))');
    mWSheet1.name = 'NEFT Converter';
    let Filename = '';
    let k = 17;
    for (let j = 0; j < obj1.length; j++) {
      // eslint-disable-next-line no-unused-vars
      const cur = config.app.Currency || '';
      const it = obj1[j];
      const set = (c, v) => { mWSheet1.getRow(k).getCell(c).value = v; };
      set(1, toStr(it.RowNumber));
      mWSheet1.getRow(k).getCell(1).protection = { locked: true };
      set(2, "'" + toStr(it.DrAccountNo)); // (.ToString() == null is never true; null => NullReferenceException)
      set(3, toStr(it.Grossamount));
      set(4, toStr(it.AccountHolderName));
      set(5, toStr(it.IFSCCODE));
      set(6, "'" + toStr(it.AccountNo));
      set(7, '10');
      set(8, '');
      set(9, '');
      if (Filename === '') Filename = toStr(it.FileName);
      k += 1;
    }
    for (let c = 1; c <= 10; c++) mWSheet1.getColumn(c).protection = { locked: true }; // A17:J17 EntireColumn.Locked = true
    const outDir = mapPath('~/WithdrawalsClubExcel');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `Withdrawal_${Filename}.xlsx`);
    await mWorkBook.xlsx.writeFile(outFile);
    // Response.Redirect("~/WithdrawalsClubExcel/Withdrawal_<Filename>.xlsx") => the saved file is sent directly
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', `attachment;filename=Withdrawal_${Filename} .xlsx`);
    return res.send(fs.readFileSync(outFile));
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_BANKWITHDRAWLREQUESTREPORT');
    // ViewBag.filepath = ExpObj.Message (void action => empty response)
    return res.send('');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.fromDate), sv(req.p.toDate),
    sv(req.p.ByStatus), nint(req.p.page), sv(req.p.OrderBy), sv(req.p.Userdownlinemember));
  if (!sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Approve_Withdrawal(int wdid, int status, string remarks, string username, int PaidMode, string Transaction, string paiddate)
// auth (reads Session["Admin_User"]; legacy NullReference was caught and its message returned)
router.all(`/admin/${C}/Approve_Withdrawal{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const wdid = reqInt(req.p.wdid, 'wdid');
  const status = reqInt(req.p.status, 'status');
  const remarks = sv(req.p.remarks);
  const username = sv(req.p.username);
  const PaidMode = reqInt(req.p.PaidMode, 'PaidMode');
  const Transaction = sv(req.p.Transaction);
  const paiddate = sv(req.p.paiddate);
  let ret = '';
  try {
    const ActivityByUserId = activityBy(req);
    const row = await db.procOne(DB, 'USP_BANKWITHDRAWAL_APPROVEORREJECT', {
      WDID: wdid, MODE: status, ACTIVITYBYUSERID: ActivityByUserId, PaidMode, Remark: remarks, Transaction, paiddate,
    });
    ret = str(col(row, 'strresult'));
    if (ret === 'SUCCESS') {
      if (status === 1 || status === 2) await sendWithdrawalMail(username, status, remarks);
    }
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_BANKWITHDRAWAL_APPROVEORREJECT');
    ret = ExpObj.message;
    return res.json(ret);
  }
}));

// ---------------------------------------------------------------- JsonResult transaction(string SearchField, string SearchValue, string fromDate, string toDate, string Userdownlinemember, int Side)
// auth (PORT-NOTE: legacy had NO session check on this withdrawal summary - protected here)
router.all(`/admin/${C}/transaction{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Side = reqInt(req.p.Side, 'Side');
  try {
    const Obj = mapRows(await db.proc(DB, 'Usp_USED_E_EWALLET_REPORT', {
      WithDrawalFromDate: sv(req.p.fromDate), WithDrawalToDate: sv(req.p.toDate), Userdownlinemember: sv(req.p.Userdownlinemember), SIDE: Side,
      SearchField: sv(req.p.SearchField), SearchValue: sv(req.p.SearchValue),
    }), TRANSACTION_PROPS);
    return res.json(Obj);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_TRANSACTION_COUNT');
    return res.json(ExpObj.message);
  }
}));

// ---------------------------------------------------------------- public string Approve_WithdrawalInBulk(int wdid, int status, string remarks)
// auth (routable public method returning a string => Content; reads Session["Admin_User"])
router.all(`/admin/${C}/Approve_WithdrawalInBulk{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const wdid = reqInt(req.p.wdid, 'wdid');
  const status = reqInt(req.p.status, 'status');
  const out = await Approve_WithdrawalInBulk(req, wdid, status, sv(req.p.remarks));
  res.type('text/html').send(out === null || out === undefined ? '' : String(out));
}));

// ---------------------------------------------------------------- JsonResult ApproveOrRejectWithdrawalInBulk(string wdid, int status, string remarks, int PaidMode, string Transaction, string paiddate)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ApproveOrRejectWithdrawalInBulk{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const wdid = sv(req.p.wdid);
  const status = reqInt(req.p.status, 'status');
  const remarks = sv(req.p.remarks);
  const PaidMode = reqInt(req.p.PaidMode, 'PaidMode');
  const Transaction = sv(req.p.Transaction);
  const paiddate = sv(req.p.paiddate);
  let ret = '';
  if (wdid === null) nullRef(); // wdid.Split('^') outside the try
  const WdidArray = wdid.split('^');
  try {
    for (let i = 0; i < WdidArray.length - 1; i++) {
      const Regno = toInt32(WdidArray[i]);
      // Db._Member_Master.Where(a => a.regNo == Regno).Select(a => a.userName).FirstOrDefault()   (legacy looked the user up by regNo = WDID)
      const ur = await db.queryOne(DB, 'select username from member_master where regno = @Regno limit 1', { Regno });
      const username = ur ? col(ur, 'username') : null;
      const ActivityByUserId = activityBy(req);
      const row = await db.procOne(DB, 'USP_BANKWITHDRAWAL_APPROVEORREJECT', {
        WDID: WdidArray[i], MODE: status, ACTIVITYBYUSERID: ActivityByUserId, PaidMode, Remark: remarks, Transaction, paiddate,
      });
      ret = str(col(row, 'strresult'));
      if (ret === 'SUCCESS') {
        if (status === 1 || status === 2) await sendWithdrawalMail(username, status, remarks);
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_BANKWITHDRAWAL_APPROVEORREJECT');
    ret = ExpObj.message;
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult showdata(int wdid)
// auth (PORT-NOTE: legacy had NO session check although it returns member bank/withdrawal data - protected here)
router.all(`/admin/${C}/showdata{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const wdid = reqInt(req.p.wdid, 'wdid');
  const GrowthList = mapRows(await db.proc(DB, 'usp_get10lastrecord', { wdid }), SHOWCHART_PROPS);
  return res.json(GrowthList);
}));

// ---------------------------------------------------------------- JsonResult Check_accountdetails(int ID)
// public (legacy had no session check; returns only 0/1/2)
router.all(`/admin/${C}/Check_accountdetails{/:id}`, asyncHandler(async (req, res) => {
  try {
    const ID = reqInt(req.p.ID, 'ID');
    // select case when filename!='' then 1 else 0 end from Tbl_Admin_BankDetails where TABDID=<ID>  (parameterised)
    const v = await db.scalar(DB, "select case when filename <> '' then 1 else 0 end from tbl_admin_bankdetails where tabdid = @ID limit 1", { ID });
    const r = v === null || v === undefined ? 0 : Number(v);
    return res.json(r);
  } catch (ex) {
    if (ex && ex.status === 500 && /parameters dictionary/.test(ex.message)) throw ex; // binding failure happened before the action in legacy
    return res.json(2);
  }
}));

module.exports = router;
