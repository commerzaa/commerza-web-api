'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Credit_Voucher.cs (class Credit_VoucherController => /admin/Credit_Voucher/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Credit_Voucher';

// `private static string url, url1` - declared, never assigned in this controller.

/** class CreditVoucherList */
const CV_PROPS = ['RowNumber', 'TFHID', 'RegNo', 'Mobile', 'Type', 'Amount', 'Date', 'ByUser', 'Remark'];

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? page, string fromdate, string DownloadProcessedExcel, string todate, string OrderBy, string Username, string Mobile, string minamount, string Mode, string maxamount, string IsVerifiedByAdmin, string ModeOpen, string DownloadProcessedExcelOpen, string TransactionId)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Credit-Voucher" -> Credit_Voucher/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Credit-Voucher'], adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  let page = B.nInt(req.p.page);
  let fromdate = s('fromdate'); let DownloadProcessedExcel = s('DownloadProcessedExcel'); let todate = s('todate'); let OrderBy = s('OrderBy');
  let Username = s('Username'); let Mobile = s('Mobile'); let minamount = s('minamount'); let Mode = s('Mode'); let maxamount = s('maxamount');
  let IsVerifiedByAdmin = s('IsVerifiedByAdmin'); let ModeOpen = s('ModeOpen'); let DownloadProcessedExcelOpen = s('DownloadProcessedExcelOpen');
  let TransactionId = s('TransactionId');
  if (OrderBy === null) OrderBy = '';
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
  // PORT-NOTE: CommandTimeout = 1000 s - pg pool timeout applies. Proc name is literally "dbo_usp_showCredit".
  const Obj = mapRows(await db.proc(DB, 'dbo_usp_showCredit', { Mode: 2 }), CV_PROPS);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.OrderBy = OrderBy;
  ViewBag.Username = Username;
  ViewBag.minamount = minamount === '0' ? '' : minamount;
  ViewBag.maxamount = maxamount === '0' ? '' : maxamount;
  ViewBag.IsVerifiedByAdmin = IsVerifiedByAdmin;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  // if (DownloadProcessedExcel != "") {} / if (Mode != "") {} / if (DownloadProcessedExcelOpen != "") {} / if (ModeOpen != "") {} - empty in legacy
  void fromdate; void todate; void Mobile; void TransactionId; void DownloadProcessedExcel; void Mode; void DownloadProcessedExcelOpen; void ModeOpen;
  return res.json({ view: '~/Views/AdminPanel/Credit_Voucher/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult AddFunds(string Username, int NofVoucher, string Remark)
// auth-by-check (legacy: Session null => Response.Redirect("/") which ended the response)
router.all(`/admin/${C}/AddFunds{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const NofVoucher = B.reqInt(req.p.NofVoucher, 'NofVoucher');
  const Username = B.nStr(req.p.Username);
  const Remark = B.nStr(req.p.Remark);
  if (!isAdmin(req)) return res.json({ redirect: '/' });
  const Emp_ID = req.user.emp_id;
  let ret = '';
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  const ip = await GetIP.GetLocalIP(req);
  const gaObj = await new Admin_Security_Key().Get_Security_Key(Emp_ID); void gaObj; // fetched, unused (legacy)
  const MemberDetails = await db.queryOne(DB, 'select regno from member_master where username = @Username limit 1', { Username }); void MemberDetails;
  const Employeeid = req.user.emp_id;
  if (Username === null) throw B.nullRef(); // Username.Trim()
  const row = await db.procOne(DB, 'Usp_Credit_Voucher', {
    username: Username.trim(), Noofvoucher: NofVoucher, Remarks: Remark, IP: ip, EMPID: Employeeid,
  });
  ret = B.outStr(row, 'strresult');
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (member personal data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberid = B.nStr(req.p.memberid);
  let getval = 'Invalid';
  try {
    // PORT-NOTE: legacy concatenated memberid into the SQL (injection); parameterised. Decimals cast to text to keep their scale.
    const dr = await db.queryOne(DB, `select mm.regno, coalesce(mm.fname,'') || ' ' || coalesce(mm.mname,'') || ' ' || coalesce(mm.lname,'') as mmbername, mm.emailid,
        (coalesce(mp.availablecommissionwallet,0))::text as availablecommissionwallet, (coalesce(availablecoinwallet,0))::text as availablecoinwallet,
        (coalesce(available_fund,0))::text as available_fund
      from member_master mm inner join member_performance mp on mp.regno = mm.regno where mm.username = @memberid limit 1`, { memberid });
    if (dr) {
      getval = B.str(dr.regno) + '^' + B.str(dr.mmbername) + '^' + B.str(dr.emailid) + '^' + B.str(dr.availablecommissionwallet) + '^'
        + B.str(dr.availablecoinwallet) + '^' + B.str(dr.available_fund);
    } else {
      getval = 'Invalid';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
  }
  return res.json(getval);
}));

module.exports = router;
