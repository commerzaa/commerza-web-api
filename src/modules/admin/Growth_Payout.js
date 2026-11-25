'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Growth_Payout.cs (class Growth_PayoutController, no namespace => /Growth_Payout/...)
// Database: affiliate (Db_Affiliate). Proc: Usp_Member_Growth_Payout. The file also declares the model Growth_Payout (=> GROWTH_PAYOUT_PROPS).
// PORT-NOTE: this is a Member-panel controller copied into the admin app. It reads Session["member_master"], which is NEVER set in the
// admin app (SESSION.md): Index always takes the RedirectToAction("Index","Home") branch and ExportReport always throws
// NullReferenceException (500). The remaining logic is ported anyway (sessionStore 'member_master', always undefined).
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const sessionStore = require('../../utils/sessionStore');
const { DB, nInt, nStr, cvtInt, nullRef, mapPath } = require('./_shared/batch08_common');
const { outVal } = require('./_shared/batch08D2_common');
const { errorInsert, adminAuth } = require('./_shared/adminSession');

const router = express.Router();
const C = 'Growth_Payout';

/** class Growth_Payout */
const GROWTH_PAYOUT_PROPS = ['rowNumber', 'date', 'GPayid', 'TotalIncome', 'AdminCharge', 'Tds', 'PaybleAmount', 'status', 'PayDate', 'PaidRemark',
  'AccountName', 'AccountNo', 'IFSCCode', 'FName', 'LName', 'regNo', 'Payout_Mode', 'TransNo', 'GMPID', 'mobile', 'LoginId'];

const trimNR = (v) => { if (v === null || v === undefined) throw nullRef(); return String(v).trim(); }; // string.Trim() on null => NRE
const intParse = (s) => cvtInt(s === '' ? 'x' : s); // int.Parse(Value.ToString()) (DBNull / decimal text => FormatException)

/** ((Member_Master_Custom)Session["member_master"]).regNo (null session => NullReferenceException) */
function sessionRegNo(req) {
  const mmc = sessionStore.get(req, 'member_master');
  if (mmc === null || mmc === undefined) throw nullRef();
  return mmc.regNo;
}

/** [Usp_Member_Growth_Payout] @Regno,...,@TotalCount out,@TotalIncome out,@Tds out,@AdminCharge out,@PaybleAmount out */
async function growthPayout(Regno, page, MaxRows, SearchField, SearchValue, payid) {
  return db.proc(DB, 'Usp_Member_Growth_Payout', {
    Regno, StartRowIndex: page, MaxRows, SearchField: trimNR(SearchField), SearchValue: trimNR(SearchValue), fromDate: '', ToDate: '',
    withdrawaltype: ' ', statusType: '', wdid: '', GPayid: payid, payoutperiod: 0,
  });
  // ("TotalAmount" OUT parameter object is created in legacy but never passed to the proc)
}

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page, int? payid)
async function ExportReport(req, ViewBag, SearchField, SearchValue, page, payid) {
  const Regno = sessionRegNo(req);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await growthPayout(Regno, page, MaxRows, SearchField, SearchValue, payid);
  const AllFreeList = mapRows(rows, GROWTH_PAYOUT_PROPS);
  try {
    const filepath = mapPath('~/adpointpayout.xls');
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    let out = 'SrNo \tDATE \tSTATUS \tNEFT NO \tPAY DATE \tAMOUNT \tTDS \tADMIN CH \tNET AMOUNT \t';
    // foreach (var item in AllFreeList) { try { /* empty */ } catch { ErrorInsert("Growth_Payout"); wr.Close(); } } => nothing is written
    for (const item of AllFreeList) { void item; }
    fs.writeFileSync(filepath, out);
    out = null;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_Member_Growth_Payout');
    ViewBag.filepath = ExpObj.message;
  }
}

// ---------------------------------------------------------------- ActionResult Index(string SearchField, string SearchValue, int? page, int? payid)
// public (legacy had no Admin_User check; it only checks Session["member_master"], never set in the admin app => always redirects)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let payid = nInt(req.p.payid);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (payid === null) payid = 0;
  const mmc = sessionStore.get(req, 'member_master');
  if (mmc === null || mmc === undefined) {
    return res.json({ redirect: '/Home/Index' }); // RedirectToAction("Index", "Home")
  }
  const Regno = mmc.regNo;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await growthPayout(Regno, page, MaxRows, SearchField, SearchValue, payid);
  const AllFreeList = mapRows(rows, GROWTH_PAYOUT_PROPS);
  const TotalRecord = intParse(outVal(rows, 'TotalCount'));
  intParse(outVal(rows, 'TotalIncome')); // netTotalIncome (unused)
  intParse(outVal(rows, 'Tds')); // netTds (unused)
  intParse(outVal(rows, 'AdminCharge')); // netAdminCharge (unused)
  intParse(outVal(rows, 'PaybleAmount')); // netPaybleAmount (unused)
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  await ExportReport(req, ViewBag, SearchField, SearchValue, page, payid); // always called (no btnexel check in legacy)
  return res.json({ view: '~/Views/MemberPanel/Growth_Payout/Index.cshtml', Model: AllFreeList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// public (legacy had no Admin_User check; Session["member_master"] is never set => NullReferenceException => 500)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nInt(req.p.page), nInt(req.p.payid));
  res.send(''); // void action => empty response
}));

module.exports = router;
