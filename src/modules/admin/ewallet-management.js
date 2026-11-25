'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\EwalletManagementController.cs
// (namespace Common.Controllers.AdminPanel, class EwalletManagementController => /admin/EwalletManagement/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'EwalletManagement';

/** class Fund_ManagementList1 (Fund_Management.cs) */
const FML1_PROPS = ['RowNumber', 'TFHID', 'RegNo', 'Mobile', 'Type', 'Amount', 'Date', 'ByUser', 'Remark', 'Status', 'Username', 'EmailId',
  'FullName', 'ByUserFullName', 'ByUsername', 'GeneratedBy', 'PaymentModeName', 'ChallanImage', 'BankName', 'BranchName', 'ReferenceNumber',
  'ReferenceDate', 'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin', 'ActivityByUserId', 'IFSCCode', 'TransactionId', 'BTCADDRESS', 'PAYMENTMODE'];
/** class Fund_ManagementList (Fund_Management_list.cs) */
const FML_PROPS = [...FML1_PROPS, 'ANO', 'BK', 'PaymentStatus'];

const nre = () => B.nullRef();

/** tbl_smsaction / tbl_emailaction / member_master FirstOrDefault() helpers (EF LINQ => parameterised SELECT) */
async function smsAction(id) {
  const r = await db.queryOne(DB, 'select id, sms_content, sms_send_status, smscategory from tbl_smsaction where id = @id limit 1', { id });
  return r ? { ID: B.col(r, 'id'), Sms_Content: B.col(r, 'sms_content'), Sms_Send_Status: B.col(r, 'sms_send_status'), SMSCategory: B.col(r, 'smscategory') } : null;
}
async function emailAction(eid) {
  const r = await db.queryOne(DB, 'select eid, email_subject, email_content, email_send_status from tbl_emailaction where eid = @eid limit 1', { eid });
  return r ? { EID: B.col(r, 'eid'), Email_Subject: B.col(r, 'email_subject'), Email_Content: B.col(r, 'email_content'), Email_Send_Status: B.col(r, 'email_send_status') } : null;
}

/**
 * public void DownloadExcelForBulkApprovalProcessedOpen(string FromDate, string ToDate, string Paymentmode)
 * Returns the legacy Response.Redirect target.
 */
async function DownloadExcelForBulkApprovalProcessedOpen(req, ViewBag, FromDate, ToDate, Paymentmode) {
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  const MaxRows = 100000;
  const Page = '1';
  // [Usp_Bulk_Data_Download_Fund_Transfer_Execll_Processed] @Mode,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@Paymentmode (CommandTimeout 1000)
  const Obj = mapRows(await db.proc(DB, 'Usp_Bulk_Data_Download_Fund_Transfer_Execll_Processed', {
    Mode: '2', FromDate, ToDate, StartRowIndex: Page, MaxRows, Paymentmode,
  }), FML_PROPS);
  const LoginIDNew = req.user.emp_loginid;
  const MemberNameNew = req.user.emp_name === null || req.user.emp_name === undefined ? '' : String(req.user.emp_name);
  const fname = 'i-wallet-processed-top-up-request-by-user_' + LoginIDNew + '_' + MemberNameNew + '.xls';
  const filepath = path.join(config.uploadDir, 'TopupRequestList', fname);
  ViewBag.ProcessedOpen = filepath;
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  let out = '';
  for (const h of ['ROWNUMBER', 'TFHID', 'REGNO', 'AMOUNT', 'DATE', 'USERNAME', 'PAYMENTMODE', 'RECEIPT', 'BANKNAME', 'BRANCHNAME',
    'REFERENCENUMBER', 'REFERENCEDATE', 'MEMBER REMARK', 'YOUR USER ID', 'YOUR REMARK', 'PAYMENT STATUS']) out += `${h} \t`;
  for (const Items of Obj) {
    void Items;
    out += '\r\n'; // wr.WriteLine(); (the per-row try body is empty / commented out in the legacy code)
  }
  fs.writeFileSync(filepath, out);
  // PORT-NOTE: legacy Response.Redirect to the hard-coded host "http://admin.cryptoinbox.com/TopupRequestList/..." is kept as-is.
  return 'http://admin.cryptoinbox.com/TopupRequestList/i-wallet-processed-top-up-request-by-user_' + LoginIDNew + '_' + MemberNameNew + '.xls';
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? page, string fromdate, string Paymentmode, string DownloadProcessedExcel, string todate, string OrderBy, string Username, string Mobile, string minamount, string Mode, string maxamount, string IsVerifiedByAdmin, string ModeOpen, string DownloadProcessedExcelOpen, string TransactionId)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/E-wallet-management" -> EwalletManagement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/E-wallet-management'], adminAuth, asyncHandler(async (req, res) => {
  let page = B.nInt(req.p.page);
  let fromdate = B.nStr(req.p.fromdate);
  let Paymentmode = B.nStr(req.p.Paymentmode);
  let DownloadProcessedExcel = B.nStr(req.p.DownloadProcessedExcel);
  let todate = B.nStr(req.p.todate);
  let OrderBy = B.nStr(req.p.OrderBy);
  let Username = B.nStr(req.p.Username);
  let Mobile = B.nStr(req.p.Mobile);
  let minamount = B.nStr(req.p.minamount);
  let Mode = B.nStr(req.p.Mode);
  let maxamount = B.nStr(req.p.maxamount);
  let IsVerifiedByAdmin = B.nStr(req.p.IsVerifiedByAdmin);
  let ModeOpen = B.nStr(req.p.ModeOpen);
  let DownloadProcessedExcelOpen = B.nStr(req.p.DownloadProcessedExcelOpen);
  let TransactionId = B.nStr(req.p.TransactionId);
  const ViewBag = {};

  if (OrderBy === null) OrderBy = '';
  if (Paymentmode === null) Paymentmode = '0';
  if (TransactionId === null) TransactionId = '0';
  if (Mobile === null) Mobile = '';
  if (DownloadProcessedExcel === null) DownloadProcessedExcel = '';
  if (DownloadProcessedExcelOpen === null) DownloadProcessedExcelOpen = '';
  if (Mode === null) Mode = '';
  if (ModeOpen === null) ModeOpen = '';
  if (IsVerifiedByAdmin === null) IsVerifiedByAdmin = '-1';
  if (maxamount === null) maxamount = '0';
  if (maxamount === '') maxamount = '0';
  if (minamount === '') minamount = '0';
  if (minamount === null) minamount = '0';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  const MaxRows = 100;
  if (page === null) page = 1;
  // [USP_FUND_TRANSFER] @MODE,@REGNO,@BYUSERREGNO,@TYPE,@AMOUNT,@REMARK,@STRRESULT OUT,@TOTALCOUNT OUT,@FROMDATE,@TODATE,@STARTROWINDEX,@MAXROWS,
  //   @TFHID,@EMAILID,@MINAMOUNT,@MAXAMOUNT,@ISVERIFIEDBYADMIN,@ORDERBYFIELD,@PaymentMode,@TransactionId,@DATE,@APROVETRANSACTIONID (CommandTimeout 1000)
  const rows = await db.proc(DB, 'USP_FUND_TRANSFER', {
    MODE: 2, REGNO: '0', BYUSERREGNO: '0', TYPE: 'Cr', AMOUNT: '0', REMARK: Username, FROMDATE: fromdate, TODATE: todate,
    STARTROWINDEX: page, MAXROWS: MaxRows, TFHID: 0, EMAILID: Mobile, MINAMOUNT: minamount, MAXAMOUNT: maxamount,
    ISVERIFIEDBYADMIN: IsVerifiedByAdmin, ORDERBYFIELD: OrderBy, PaymentMode: Paymentmode, TransactionId, DATE: '', APROVETRANSACTIONID: '',
  });
  const Obj = mapRows(rows, FML1_PROPS);
  // Convert.ToInt32(TotalCount.Value.ToString()) (no try/catch in legacy: DBNull => FormatException => 500)
  const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.Paymentmode = Paymentmode;
  ViewBag.OrderBy = OrderBy;
  ViewBag.Username = Username;
  ViewBag.Mobile = Mobile;
  ViewBag.minamount = minamount === '0' ? '' : minamount;
  ViewBag.maxamount = maxamount === '0' ? '' : maxamount;
  ViewBag.IsVerifiedByAdmin = IsVerifiedByAdmin;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  if (DownloadProcessedExcel !== '') {
    // legacy: body commented out
  }
  if (Mode !== '') {
    // legacy: body commented out
  }
  if (DownloadProcessedExcelOpen !== '') {
    const redirect = await DownloadExcelForBulkApprovalProcessedOpen(req, ViewBag, fromdate, todate, Paymentmode);
    return res.json({ redirect }); // Response.Redirect ended the request
  }
  if (ModeOpen !== '') {
    // legacy: body commented out
  }
  return res.json({ view: '~/Views/AdminPanel/EwalletManagement/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void DownloadExcelForBulkApprovalProcessedOpen(string FromDate, string ToDate, string Paymentmode)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/DownloadExcelForBulkApprovalProcessedOpen{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const redirect = await DownloadExcelForBulkApprovalProcessedOpen(req, {}, B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nStr(req.p.Paymentmode));
  res.json({ redirect });
}));

// ---------------------------------------------------------------- JsonResult AddFunds(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth (Session["Admin_User"] == null => Response.Redirect("/"))
router.all(`/admin/${C}/AddFunds{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = B.nStr(req.p.Username);
  const Amount = B.reqDec(req.p.Amount, 'Amount');
  const Id = B.reqInt(req.p.Id, 'Id');
  const Remark = B.nStr(req.p.Remark);
  const GAKEY = B.nStr(req.p.GAKEY);
  const EmpID = req.user.emp_id;
  let ret = '';
  let IsGoogleAuthenticated = '';
  // PORT-NOTE: MVC binds "" as null, so the legacy `Username == ""` / `GAKEY == ""` checks only match a literal "" (never) - kept.
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  if (Amount <= 0) return res.json('Error^Amount should be a non negative number.');
  if (Id <= 0) return res.json('Error^Some error occured.Try typing username again.');

  let gaObj = new Admin_Security_Key();
  gaObj = await gaObj.Get_Security_Key(EmpID);
  if (gaObj !== null && gaObj !== undefined) {
    IsGoogleAuthenticated = '1';
    if (GAKEY === '') return res.json('Error^Enter your GA Key.');
  } else {
    IsGoogleAuthenticated = '0';
  }
  if (IsGoogleAuthenticated !== '0') {
    let objs = new Admin_Security_Key();
    objs = await objs.Get_Security_Key(EmpID);
    if (objs) {
      objs = await objs.Get_Security_Key(EmpID);
      if (objs) {
        objs = await objs.Get_Security_Key(EmpID);
        if (objs) {
          const ValidRandomNo = await objs.Get_GA_Key(EmpID);
          if (!(await objs.Check_GaKeyForEnableTime(EmpID, ValidRandomNo, GAKEY))) {
            if (GAKEY !== '') return res.json('Error^Invalid GA Key. Please enter a valid GA Key.');
          }
        }
      }
    }
  }

  // Db._Member_Master.Where(a => a.userName == Username).FirstOrDefault()  (EF: null => IS NULL)
  const md = Username === null
    ? await db.queryOne(DB, 'select regno, username, emailid, mobile from member_master where username is null limit 1', {})
    : await db.queryOne(DB, 'select regno, username, emailid, mobile from member_master where username = @Username limit 1', { Username });
  const MemberDetails = md ? { userName: B.col(md, 'username'), Emailid: B.col(md, 'emailid'), mobile: B.col(md, 'mobile') } : null;
  const Employeeid = EmpID;
  // [USP_Income_TRANSFER] ... (CommandTimeout 1000, TransactionalBehavior.DoNotEnsureTransaction)
  const row = await db.procOne(DB, 'USP_Income_TRANSFER', {
    Mode: '1', RegNo: Id, ByUserRegNo: 0, Type: 'Cr', Amount, Remark, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100',
    TFHID: 0, EMAILID: '', MINAMOUNT: 0, MAXAMOUNT: 0, ISVERIFIEDBYADMIN: -1, ORDERBYFIELD: '', PaymentMode: 0, TransactionId: '',
    ACTIVITYBYUSER: '', ACTIVITY_BY_EMP_ID: 0, TXID: '', AmountBTC: 0, DATE: '', APROVETRANSACTIONID: '', EID: Employeeid,
    orderbydate: '', SessionID: '0',
  });
  ret = B.outStr(row, 'strresult');
  if (ret === 'success') {
    try {
      const Frommsg = await smsAction(1048);
      if (!Frommsg) throw nre();
      const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(Username, Frommsg.Sms_Content, '', '', 35, Id, 0, '', '', 0, Amount);
      const Creditemailmsg = await emailAction(1044);
      if (!Creditemailmsg || !MemberDetails) throw nre();
      const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', Creditemailmsg.Email_Content, MemberDetails.Emailid, '', 38, '', '', Id, 0, '', '', 0, 0, Amount);
      if (Frommsg.SMSCategory === 'Transfer') {
        if (Number(Frommsg.Sms_Send_Status) === 1) {
          // new Thread(...).Start() => fire and forget
          Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1')).catch((e) => console.error('[EwalletManagement] SMS:', e.message));
        }
      }
      if (Number(Creditemailmsg.Email_Send_Status) === 1) {
        const fileUploader = null;
        // PORT-NOTE: Emailid.ToLower() ran inside the thread delegate (an NRE there crashed the worker thread); here it only logs.
        Promise.resolve().then(() => UtilityClass.SendEmailByApiSetting(MemberDetails.userName, '', '', '', '', '', (() => { if (MemberDetails.Emailid === null || MemberDetails.Emailid === undefined) throw nre(); return String(MemberDetails.Emailid).toLowerCase(); })(),
          Creditemailmsg.Email_Subject, DynamicMsgForCredit, fileUploader)).catch((e) => console.error('[EwalletManagement] Email:', e.message));
      }
    } catch (ex) {
      // legacy: catch (Exception ex) { }
    }
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult TopupRequest(decimal Amount, string PaymentMode, string ModeName, string CommentORRemark, string ChallanImage, string BankName, string BranchName, string ReferenceDate, string ReferenceNumber, string IFSCCode, string Username)
// auth (no explicit check, but reads Session["Admin_User"] => NullReferenceException without a session)
router.all(`/admin/${C}/TopupRequest{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Amount = B.reqDec(req.p.Amount, 'Amount');
  const PaymentMode = B.nStr(req.p.PaymentMode);
  const ModeName = B.nStr(req.p.ModeName);
  const CommentORRemark = B.nStr(req.p.CommentORRemark);
  const ChallanImage = B.nStr(req.p.ChallanImage);
  const BankName = B.nStr(req.p.BankName);
  const BranchName = B.nStr(req.p.BranchName);
  const ReferenceDate = B.nStr(req.p.ReferenceDate);
  const ReferenceNumber = B.nStr(req.p.ReferenceNumber);
  const IFSCCode = B.nStr(req.p.IFSCCode);
  const Username = B.nStr(req.p.Username);

  let TransactionId = '';
  const BTCAddress = ''; let OTPCODE = ''; const BtcUserId = ''; const BTCLabelName = ''; const BitCoinAmount = '';
  const BWAFW = 0;
  {
    const msg = await smsAction(5);
    const emailmsg = await emailAction(5);
    if (!msg) throw nre();
    if (Number(msg.Sms_Send_Status) === 0) {
      if (!emailmsg) throw nre();
      if (Number(emailmsg.Email_Send_Status) === 0) {
        if ((config.app.MasterCode || '') === OTPCODE) {
          sessionStore.set(req, 'SessionOTP', OTPCODE);
        }
      }
    }
  }
  if (PaymentMode === '14') {
    try {
      // PORT-NOTE: TempData["TransactionId"] is never written anywhere in the admin app => Convert.ToString(null) == "".
      TransactionId = '';
      if (TransactionId === '') return res.json('error^Invalid Transaction Id.');
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'TopupRequest');
      return res.json('error^Invalid Transaction Id.' + ExpObj.message);
    }
  }
  if (PaymentMode === '3') TransactionId = ReferenceNumber;
  if (OTPCODE === null) OTPCODE = '0';
  const Employeeid = req.user.emp_id;
  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') return res.json('error^Mandatory fields are required.');
  let ImageName = ''; let FullUrlWithFolder = '';
  let RegNo = 0;
  const CurrencySymbol = config.app.CurrencySymbol || ''; // read, unused (legacy)
  void CurrencySymbol;
  let ReturnOutput = '';
  try {
    RegNo = Employeeid;
    const Emp_Code = req.user.emp_code;
    if (Emp_Code === null || Emp_Code === undefined) throw nre(); // Emp_Master.Emp_Code.ToString()
    const ActivityByUser = String(Emp_Code) + ' ' + '(' + (req.user.emp_name === null || req.user.emp_name === undefined ? '' : req.user.emp_name) + ')';
    if (ChallanImage !== '') {
      // PORT-NOTE: MVC bound "" as null, and `null != ""` is true, so the upload ran with a null image too (kept).
      FullUrlWithFolder = `${req.protocol}://${req.get('host')}` + '/Challen_Image/';
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    const row = await db.procOne(DB, 'Usp_Ewallet_History_Admin', {
      Mode: 1, RegNo, Type: 'Cr', Amount, Remark: CommentORRemark, PaymentMode, PaymentModeName: ModeName, ChallanImage: FullUrlWithFolder,
      BankName, BranchName, ReferenceNumber, ReferenceDate, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100', IFSCCode,
      BTCAddress, BtcUserId, BTCLabelName, BitCoinAmount: (BitCoinAmount === '' ? '0.00000000' : BitCoinAmount), TransactionId, BWAFW,
      ActivityByUser, Username,
    });
    const sr = B.col(row, 'strresult');
    if (sr === null || sr === undefined) throw nre(); // SpOutPut.Value.ToString() on a missing value
    if (B.str(sr).toLowerCase() === 'success') {
      ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.';
      sessionStore.set(req, 'SessionOTP', null);
    } else {
      ReturnOutput = B.str(sr);
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_Fund_Request');
    ReturnOutput = 'error^Some exception occured while making the request.';
  }
  return res.json(ReturnOutput);
}));

module.exports = router;
