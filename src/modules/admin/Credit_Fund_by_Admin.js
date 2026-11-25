'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Credit_Fund_by_Admin.cs (class Credit_Fund_by_AdminController => /admin/Credit_Fund_by_Admin/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Credit_Fund_by_Admin';

// public Credit_Fund_by_AdminController() { }  (empty constructor)

const cs = (v) => (v === null || v === undefined ? '' : String(v)); // Convert.ToString

// ---------------------------------------------------------------- ActionResult Index(string memberid)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/credit-fund" -> Credit_Fund_by_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/credit-fund'], adminAuth, asyncHandler(async (req, res) => {
  const memberid = B.nStr(req.p.memberid);
  const ViewBag = {};
  ViewBag.MemberID = '';
  ViewBag.epinwallet = '0.00';
  let Name = '';
  ViewBag.Name = '';
  if (memberid !== null) {
    const row = await db.queryOne(DB, 'select regno, loginid, fname, mname, lname from member_master where loginid = @memberid limit 1', { memberid });
    if (row !== null) {
      Name = row.fname;
      if (cs(row.mname) !== '') Name = Name + ' ' + row.mname;
      if (cs(row.lname) !== '') Name = Name + ' ' + row.lname;
      ViewBag.Name = Name;
      const row2 = await db.queryOne(DB, 'select regno from member_performance where regno = @regno limit 1', { regno: row.regno });
      void row2; // if (row2 != null) { } (empty in legacy)
      ViewBag.MemberID = row.loginid;
    }
  }
  ViewBag.preUrl = '';
  const ref = req.get('referer');
  if (ref) ViewBag.preUrl = ref; // Request.UrlReferrer
  return res.json({ view: '~/Views/AdminPanel/Credit_Fund_by_Admin/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult checkWalletAmountForTransfer(decimal amount, int GetworkingandNonworking)
// auth (wallet data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/checkWalletAmountForTransfer{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const amount = B.reqDec(req.p.amount, 'amount');
  const GetworkingandNonworking = B.reqInt(req.p.GetworkingandNonworking, 'GetworkingandNonworking');
  let Regno = 0;
  const Currency = '';
  let ret = '';
  let totalpayleamt = 0;
  let getretrunvval = 0;
  try {
    // Regno = ((Member_Master_Custom)Session["member_master"]).regNo;
    // PORT-NOTE: Session["member_master"] is never set in the admin app (SESSION.md) => NullReferenceException => catch branch, as legacy.
    const mmc = sessionStore.get(req, 'member_master');
    if (mmc === null || mmc === undefined) throw B.nullRef();
    Regno = Number(mmc.regNo);
    const MP = await db.queryOne(DB, 'select totalincome from member_performance where regno = @Regno limit 1', { Regno });
    if (GetworkingandNonworking === 1) {
      if (MP === null) throw B.nullRef();
      getretrunvval = Number(MP.totalincome || 0);
    }
    totalpayleamt = Number(amount);
    ret = 'ok^Pin Amount: ' + Number(amount).toFixed(2) + ' ' + Currency;
    if (getretrunvval < totalpayleamt) ret = 'Not enough Funds in your Wallet';
    else ret = ret + ', Payble Amount: ' + totalpayleamt.toFixed(2) + ' ' + Currency;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'checkWalletAmountForTransfer');
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult GetAvailableBalance(string loginid, int GetWalletType)
// auth (member wallet balance; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/GetAvailableBalance{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const loginid = B.nStr(req.p.loginid);
  const GetWalletType = B.reqInt(req.p.GetWalletType, 'GetWalletType');
  let balance = 0;
  const MM = await db.queryOne(DB, 'select regno from member_master where loginid = @loginid limit 1', { loginid });
  if (MM === null) throw B.nullRef(); // MM.regNo
  const Regno = Number(MM.regno);
  const MP = await db.queryOne(DB, 'select currentincome from member_performance where regno = @Regno limit 1', { Regno });
  if (GetWalletType === 1) {
    if (MP === null) throw B.nullRef();
    balance = Number(MP.currentincome || 0);
  }
  return res.json(balance);
}));

// ---------------------------------------------------------------- JsonResult getMemberId(string loginid)
// auth (member data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/getMemberId{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const loginid = B.nStr(req.p.loginid);
  const regno = await UtilityClass.GetRegNoFromLoginId(loginid);
  if (Number(regno) <= 0) return res.json('invalid');
  const row = await db.queryOne(DB, 'select regno, fname, lname from member_master where username = @loginid limit 1', { loginid });
  if (row === null) throw B.nullRef();
  let Name = cs(row.fname) + '' + cs(row.lname);
  const Regno = row.regno;
  const MP = await db.queryOne(DB, 'select currentincome from member_performance where regno = @Regno limit 1', { Regno });
  if (MP === null) throw B.nullRef();
  Name = Name + '^' + Number(MP.currentincome || 0).toFixed(2);
  return res.json(Name);
}));

// ---------------------------------------------------------------- JsonResult TransferCredit(string loginid, int GetworkingandNonworking, string amount, string remark)
// auth (credits a member wallet; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/TransferCredit{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const loginid = B.nStr(req.p.loginid);
  const GetworkingandNonworking = B.reqInt(req.p.GetworkingandNonworking, 'GetworkingandNonworking');
  const regno = await UtilityClass.GetRegNoFromLoginId(loginid);
  const objutil = new DataUtility();
  const param = [
    DataUtility.SqlParameter('@RegNo', regno),
    DataUtility.SqlParameter('@Amount', B.nStr(req.p.amount)),
    DataUtility.SqlParameter('@walletType', GetworkingandNonworking),
    DataUtility.SqlParameter('@Type', 'Cr'),
    DataUtility.SqlParameter('@Remark', B.nStr(req.p.remark)),
    DataUtility.SqlParameter('@strResult', null, 'Output'),
  ];
  // PORT-NOTE: legacy called Usp_AdminFundCreditDebit with @RegNo/@Amount/@walletType/@Type/@Remark although the proc (see Cr_Dr_Fund)
  // takes @EmpCode/@Tobrid/@FromBRID/...; the mismatch is kept (SQL error => 500, like the legacy).
  const result = await objutil.ExecuteSqlSPS(param, 'Usp_AdminFundCreditDebit');
  return res.json(result);
}));

module.exports = router;
