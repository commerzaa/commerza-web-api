'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Credit_Clowd_History.cs
// (namespace Common.Controllers.AdminPanel, class Credit_Clowd_HistoryController => /admin/Credit_Clowd_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Credit_Clowd_History';

/** class Credit_Clowd_History */
const CCH_PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'USERNAME'];

/** Convert.ToInt32(<decimal OUT param>.Value.ToString()) - scale-0 decimal => rounded integer string; DBNull => FormatException */
function decOutToInt(row, name) {
  const v = B.col(row, name);
  if (v === null || v === undefined || v === '') throw new Error('Input string was not in a correct format.');
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return Math.round(n);
}

// ---------------------------------------------------------------- ActionResult Index(int? page, string fromDate, string toDate, string CrDrType, string TrType, string username, int? ddlcustpage)
// auth (admin report; legacy had no session check - PORT-NOTE: protected with adminAuth)
// route-config: "AdminPanel/Shopping-Wallet-History" -> Credit_Clowd_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Shopping-Wallet-History'], adminAuth, asyncHandler(async (req, res) => {
  let page = B.nInt(req.p.page);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let CrDrType = B.nStr(req.p.CrDrType);
  let TrType = B.nStr(req.p.TrType);
  let username = B.nStr(req.p.username);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (username === null) username = '';
  let Obj = [];
  const ViewBag = {};
  try {
    const MaxRows = Number(ddlcustpage);
    if (page === null) page = 1;
    // PORT-NOTE: legacy concatenated username into the SQL (injection); parameterised. Regno is unused.
    const Regno = await db.scalar(DB, 'select regno from member_master where username = @username limit 1', { username }); void Regno;
    // [USP_SHOPPINGSTATEMENT] ... ,'','','','','',@mode : the five '' literals were passed into OUT parameters
    // (@GrossCoinWallet..@AvailableCommissionWallet) and are not inputs of the PostgreSQL function - omitted.
    const rows = await db.proc(DB, 'USP_SHOPPINGSTATEMENT', {
      PLID: 0, FromDate: fromDate, ToDate: toDate, StartRowIndex: page, MaxRows, CrDrType, TrType: B.cvtInt(TrType), mode: '',
    });
    Obj = mapRows(rows, CCH_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    // PORT-NOTE: OUT params @TotalCount / @cramount read from the first result row; no row => 0.
    const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
    const TotalCrAmt = rows.length ? decOutToInt(rows[0], 'cramount') : 0;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalCrAmt = TotalCrAmt;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_COMMISSION_STATEMENT');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  return res.json({ view: '~/Views/AdminPanel/Credit_Clowd_History/Index.cshtml', Model: Obj, ...ViewBag });
}));

module.exports = router;
