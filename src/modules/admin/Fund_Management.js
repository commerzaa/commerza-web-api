'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Fund_Management.cs (class Fund_ManagementController => /Fund_Management/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');
const D = require('./_shared/batch07D_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Fund_Management';

// PORT-NOTE: legacy `private static string url, url1` were never assigned/used in this controller.

/**
 * public void DownloadExcelForBulkApprovalProcessedOpen(string FromDate, string ToDate, string Paymentmode)
 * Writes ~/TopupRequestList/i-wallet-processed-top-up-request-by-user_<Emp_LoginID>_<Emp_Name>.xls (header row + one empty line per row:
 * the per-row try block is empty in legacy) and Response.Redirect("http://admin.cryptoinbox.com/TopupRequestList/<same file>").
 * PORT-NOTE: the redirect to the hard-coded legacy host is replaced by sending the written file as a download.
 */
async function DownloadExcelForBulkApprovalProcessedOpen(req, res, FromDate, ToDate, Paymentmode, ViewBag) {
  if (FromDate === null || FromDate === undefined) FromDate = '';
  if (ToDate === null || ToDate === undefined) ToDate = '';
  const MaxRows = 100000;
  const Page = '1';
  // [Usp_Bulk_Data_Download_Fund_Transfer_Execll_Processed] @Mode,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@Paymentmode  (CommandTimeout 1000)
  const params = { Mode: '2', FromDate, ToDate, StartRowIndex: Page, MaxRows };
  if (Paymentmode !== null && Paymentmode !== undefined) params.Paymentmode = Paymentmode; // null SqlParameter => proc default
  const Obj = mapRows(await db.proc(DB, 'Usp_Bulk_Data_Download_Fund_Transfer_Execll_Processed', params), D.FUND_MANAGEMENT_LIST_PROPS);

  const LoginIDNew = req.user.emp_loginid;
  const MemberNameNew = req.user.emp_name === null || req.user.emp_name === undefined ? '' : String(req.user.emp_name);
  const fileName = `i-wallet-processed-top-up-request-by-user_${LoginIDNew === null || LoginIDNew === undefined ? '' : LoginIDNew}_${MemberNameNew}.xls`;
  // PORT-NOTE: path separators in the admin name/login are replaced to keep the file inside TopupRequestList.
  const safeName = fileName.replace(/[\\/]/g, '_');
  const dir = path.join(config.uploadDir, 'TopupRequestList');
  fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, safeName);
  if (ViewBag) ViewBag.ProcessedOpen = filepath;
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  let out = '';
  for (const h of ['ROWNUMBER', 'TFHID', 'REGNO', 'AMOUNT', 'DATE', 'USERNAME', 'PAYMENTMODE', 'RECEIPT', 'BANKNAME', 'BRANCHNAME',
    'REFERENCENUMBER', 'REFERENCEDATE', 'MEMBER REMARK', 'YOUR USER ID', 'YOUR REMARK', 'PAYMENT STATUS']) out += `${h} \t`;
  for (let i = 0; i < Obj.length; i += 1) {
    out += '\r\n'; // wr.WriteLine(); (empty try / catch(ErrorInsert "DownloadExcelForBulkApprovalProcessedOpen") never reached)
  }
  fs.writeFileSync(filepath, out);
  res.set('Content-Type', 'application/vnd.ms-excel');
  res.set('Content-Disposition', `attachment; filename=${safeName}`);
  res.send(out);
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? page, string fromdate, string Paymentmode, string DownloadProcessedExcel, string todate, string OrderBy, string Username, string Mobile, string minamount, string Mode, string maxamount, string IsVerifiedByAdmin, string ModeOpen, string DownloadProcessedExcelOpen, string TransactionId)
// auth ([SessionExpireCheck] => legacy redirect "~/secure-admin-login-dhiDTo5ScKAHxD9kgDRERA/logout")
// route-config: "AdminPanel/fund-management" -> Fund_Management/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/fund-management'], adminAuth, asyncHandler(async (req, res) => {
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
  const ViewBag = {};
  // [USP_FUND_TRANSFER] @MODE,@REGNO,@BYUSERREGNO,@TYPE,@AMOUNT,@REMARK,@STRRESULT OUT,@TOTALCOUNT OUT,@FROMDATE,@TODATE,@STARTROWINDEX,
  //   @MAXROWS,@TFHID,@EMAILID,@MINAMOUNT,@MAXAMOUNT,@ISVERIFIEDBYADMIN,@ORDERBYFIELD,@PaymentMode,@TransactionId,@DATE,@APROVETRANSACTIONID
  // PORT-NOTE: the legacy positional call passed @DATE/@APROVETRANSACTIONID into the 21st/22nd positions (@ACTIVITYBYUSER/@ACTIVITY_BY_EMP_ID);
  // both values are "" so they are passed here under the positional parameter names ('' for ACTIVITY_BY_EMP_ID INT => 0).
  const rows = await db.proc(DB, 'USP_FUND_TRANSFER', {
    MODE: 2, REGNO: '0', BYUSERREGNO: '0', TYPE: 'Cr', AMOUNT: '0', REMARK: Username, FROMDATE: fromdate, TODATE: todate,
    STARTROWINDEX: page, MAXROWS: MaxRows, TFHID: 0, EMAILID: Mobile, MINAMOUNT: minamount, MAXAMOUNT: maxamount,
    ISVERIFIEDBYADMIN: IsVerifiedByAdmin, ORDERBYFIELD: OrderBy, PAYMENTMODE: Paymentmode, TransactionId, ACTIVITYBYUSER: '', ACTIVITY_BY_EMP_ID: 0,
  });
  const Obj = mapRows(rows, D.FUND_MANAGEMENT_LIST1_PROPS);
  const TotalRecord = D.totalCountOf(rows, 'TotalCount', true); // Convert.ToInt32(TotalCount.Value.ToString())
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
  // int pageNumber = page ?? 1; int Noofpage = UtilityClass.GridNumbersPerPage(); (unused locals)
  // DownloadProcessedExcel / Mode / ModeOpen branches only contain commented-out calls in legacy.
  if (DownloadProcessedExcelOpen !== '') {
    await DownloadExcelForBulkApprovalProcessedOpen(req, res, fromdate, todate, Paymentmode, ViewBag);
    return undefined; // legacy Response.Redirect ended the request
  }
  return res.json({ view: '~/Views/AdminPanel/Fund_Management/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void DownloadExcelForBulkApprovalProcessedOpen(string FromDate, string ToDate, string Paymentmode)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/DownloadExcelForBulkApprovalProcessedOpen{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await DownloadExcelForBulkApprovalProcessedOpen(req, res, B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nStr(req.p.Paymentmode), null);
}));

// ---------------------------------------------------------------- JsonResult AddFunds(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth-by-check (legacy: Session null => Response.Redirect("/"))
router.all(`/admin/${C}/AddFunds{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Amount = B.reqDec(req.p.Amount, 'Amount');
  const Id = D.reqLong(req.p.Id, 'Id');
  const Username = B.nStr(req.p.Username);
  const Remark = B.nStr(req.p.Remark);
  const GAKEY = B.nStr(req.p.GAKEY);
  if (!isAdmin(req)) return res.json({ redirect: '/' });
  const EmpId = req.user.emp_id;
  let ret = '';
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  if (Amount <= 0) return res.json('Error^Amount should be a non negative number.');
  if (Id <= 0) return res.json('Error^Some error occured.Try typing username again.');
  const ga = await D.gaCheck(EmpId, GAKEY, 3); // Get_Security_Key nested 3 times in legacy
  if (ga) return res.json(ga);

  const MemberDetails = await D.memberByUserName(Username);
  const Employeeid = req.user.emp_id;
  // [Usp_Fund_Transfer] ... @AMTTOTAL out,@EID,@orderbydate,@SessionID  (TransactionalBehavior.DoNotEnsureTransaction, CommandTimeout 1000)
  const row = await db.procOne(DB, 'Usp_Fund_Transfer', {
    Mode: '1', RegNo: Id, ByUserRegNo: 0, Type: 'Cr', Amount, Remark, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100',
    TFHID: 0, EMAILID: '', MINAMOUNT: 0, MAXAMOUNT: 0, ISVERIFIEDBYADMIN: -1, ORDERBYFIELD: '', PAYMENTMODE: 0, TransactionId: '',
    ACTIVITYBYUSER: '', ACTIVITY_BY_EMP_ID: 0, TXID: '', AmountBTC: 0, DATE: '', APROVETRANSACTIONID: '', EID: Employeeid,
    orderbydate: '', SessionID: '0',
  });
  ret = B.outStr(row, 'StrResult');
  if (ret === 'success') {
    try {
      const Frommsg = await D.smsAction(1048);
      const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(Username, D.need(Frommsg).Sms_Content, '', '', 35, Id, 0, '', '', 0, Amount);
      const Creditemailmsg = await D.emailAction(1044);
      const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', D.need(Creditemailmsg).Email_Content,
        D.need(MemberDetails).Emailid, '', 38, '', '', Id, 0, '', '', 0, 0, Amount);
      D.fireSms(Frommsg, MemberDetails, Frommessg);
      D.fireEmail(Creditemailmsg, MemberDetails, DynamicMsgForCredit);
    } catch (ex) { /* swallowed like legacy */ }
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult TopupRequest(decimal Amount, string PaymentMode, string ModeName, string CommentORRemark, string ChallanImage, string BankName, string BranchName, string ReferenceDate, string ReferenceNumber, string IFSCCode, string Username)
// auth (reads Session["Admin_User"]; legacy threw NullReferenceException without a session)
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
    const msg = await D.smsAction(5);
    const emailmsg = await D.emailAction(5);
    if (Number(D.need(msg).Sms_Send_Status) === 0 && Number(D.need(emailmsg).Email_Send_Status) === 0) {
      if ((config.app.MasterCode || '') === OTPCODE) {
        sessionStore.set(req, 'SessionOTP', OTPCODE); // Session["SessionOTP"] = OTPCODE ("")
      }
    }
  }
  if (PaymentMode === '14') {
    try {
      // PORT-NOTE: TempData["TransactionId"] is never written anywhere in the admin app => always "" here.
      TransactionId = '';
      if (TransactionId === '') return res.json('error^Invalid Transaction Id.');
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'TopupRequest');
      return res.json(`error^Invalid Transaction Id.${ExpObj.message}`);
    }
  }
  if (PaymentMode === '3') TransactionId = ReferenceNumber;
  if (OTPCODE === null) OTPCODE = '0';
  const Employeeid = req.user.emp_id;
  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') {
    return res.json('error^Mandatory fields are required.');
  }
  let ImageName = ''; let FullUrlWithFolder = '';
  let RegNo = 0;
  const CurrencySymbol = (config.app.CurrencySymbol || ''); // read but unused in legacy
  void CurrencySymbol;
  let ReturnOutput = '';
  try {
    RegNo = Employeeid;
    if (req.user.emp_code === null || req.user.emp_code === undefined) throw B.nullRef(); // Emp_Code.ToString()
    const ActivityByUser = `${req.user.emp_code} (${req.user.emp_name === null || req.user.emp_name === undefined ? '' : req.user.emp_name})`;
    if (ChallanImage !== '') {
      // string.Format("{0}://{1}", uri.Scheme, uri.Authority) + "/Challen_Image/"
      FullUrlWithFolder = `${req.protocol}://${req.get('host')}/Challen_Image/`;
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    const row = await db.procOne(DB, 'Usp_Fund_History_Admin', {
      MODE: 1, REGNO: RegNo, TYPE: 'Cr', AMOUNT: Amount, REMARK: CommentORRemark, PAYMENTMODE: PaymentMode, PAYMENTMODENAME: ModeName,
      CHALLANIMAGE: FullUrlWithFolder, BANKNAME: BankName, BRANCHNAME: BranchName, REFERENCENUMBER: ReferenceNumber, REFERENCEDATE: ReferenceDate,
      FROMDATE: '', TODATE: '', STARTROWINDEX: '1', MAXROWS: '100', IFSCCODE: IFSCCode, BTCADDRESS: BTCAddress, BTCUSERID: BtcUserId,
      BTCLABELNAME: BTCLabelName, BITCOINAMOUNT: (BitCoinAmount === '' ? '0.00000000' : BitCoinAmount), TransactionId, BWAFW,
      ActivityByUser, Username,
    });
    const sr = B.outStr(row, 'StrResult');
    if (sr.toLowerCase() === 'success') {
      ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.';
      sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
    } else {
      ReturnOutput = sr;
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_Fund_Request');
    ReturnOutput = 'error^Some exception occured while making the request.';
  }
  return res.json(ReturnOutput);
}));

// ---------------------------------------------------------------- JsonResult ApproveReject(string GAKEY, long RegNo, long ID, string mode, string Remarks, string Date, string Approvetransactionid)
// auth-by-check (legacy: Session null => Response.Redirect("/"))
router.all(`/admin/${C}/ApproveReject{/:id}`, optionalAuth, asyncHandler(D.approveReject));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (PORT-NOTE: legacy had no session check; returns member e-mail and wallet balances => protected)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.json(await D.getUsernameAndEmail(req, B.nStr(req.p.memberid), true));
}));

// ---------------------------------------------------------------- JsonResult GetUserName(string prefix)
// auth (PORT-NOTE: legacy had no session check; returns member details => protected)
router.all(`/admin/${C}/GetUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const prefix = B.nStr(req.p.prefix);
  const params = {};
  if (prefix !== null) params.UserName = prefix; // null SqlParameter value => proc default
  const ObjUserName = mapRows(await db.proc(DB, 'UPS_GetDetailsUserName', params), D.STOCK_DETAILS_PROPS);
  res.json(ObjUserName);
}));

// ---------------------------------------------------------------- JsonResult GetUserdoenlinecount(string prefix)
// public (legacy had no session check; returns "" without touching the database)
router.all(`/admin/${C}/GetUserdoenlinecount{/:id}`, asyncHandler(async (req, res) => {
  const ReturnOutput = '';
  res.json(ReturnOutput);
}));

module.exports = router;
