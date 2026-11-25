'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Stock_LedgerController.cs (class Stock_LedgerController, no namespace => /admin/Stock_Ledger/...)
// Database: affiliate (Db_Affiliate). Proc USP_STOCKLEDGER. Session["MySession"] => sessionStore 'MySession'.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, nStr, col, str, cvtInt, outOf, nullRef, trimS } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'Stock_Ledger';

/** public class StockLedger */
const STOCK_LEDGER_PROPS = ['ROWNUMBER', 'DATEDON', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Emp_Name', 'PrCode', 'REMARK', 'NAME'];

// ---------------------------------------------------------------- ActionResult Index(string fromDate, string toDate, string remark, string StockType, string ProductCode,
//   int? page, string URL, string FRID)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Stock-Ledger" -> Stock_Ledger/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Stock-Ledger'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let remark = nStr(req.p.remark);
  let StockType = nStr(req.p.StockType);
  let ProductCode = nStr(req.p.ProductCode);
  let page = nInt(req.p.page);
  let URL = nStr(req.p.URL);
  let FRID = nStr(req.p.FRID);
  const ViewBag = {};
  if (FRID === null) FRID = '0';
  const MaxRows = 1000;
  if (ProductCode === null) {
    ProductCode = '';
    ViewBag.Code = 1;
  } else {
    if (URL !== '' && URL !== null) ProductCode = await UtilityClass.Decryptword(ProductCode);
    sessionStore.set(req, 'MySession', ProductCode);
  }
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (remark === null) remark = '';
  if (StockType === null) {
    StockType = '';
  } else {
    ViewBag.Code = 2;
    const ms = sessionStore.get(req, 'MySession');
    if (ms === null || ms === undefined) throw nullRef(); // Session["MySession"].ToString()
    ProductCode = String(ms);
  }
  if (page === null) page = 1;
  if (URL !== null) {
    URL = await UtilityClass.Decryptword(URL);
    ViewBag.url = URL;
  }
  // int Empid = ((Employee_Master)Session["Admin_User"]).Emp_ID;  (unused)
  // dbo.USP_STOCKLEDGER @StockType,@fromDate,@toDate,@remark,@STARTROWINDEX,@MAXROWS,@ProductCode,@Mode,@TOTALCOUNT out,@IN out,@OUT out,
  //   @TotalAvailable out,@FRID,@PUCNAME out,@TRANSFERED OUT
  const rows = await db.proc(DB, 'USP_STOCKLEDGER', {
    StockType, fromDate, toDate, remark, STARTROWINDEX: page, MAXROWS: MaxRows, Mode: 2, ProductCode, FRID,
  });
  const AllEPinRequestsList = mapRows(rows, STOCK_LEDGER_PROPS);
  const tc = str(col(rows[0], 'TOTALCOUNT'));
  const TotalRecord = cvtInt(tc === '' ? '0' : tc);
  ViewBag.IN = outOf(rows, 'IN');
  ViewBag.OUT = outOf(rows, 'OUT');
  ViewBag.TotalAvailable = outOf(rows, 'TotalAvailable');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.PCode = ProductCode;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.StockType = StockType;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.remark = remark;
  ViewBag.BasicDetails = rows.length ? mapRow(rows[0], STOCK_LEDGER_PROPS) : null; // .FirstOrDefault()
  ViewBag.PUCNAME = outOf(rows, 'PUCNAME');
  ViewBag.TRANSFERED = outOf(rows, 'TRANSFERED');
  ViewBag.FRID = await UtilityClass.Encryptword(FRID);
  return res.json({ view: '~/Views/AdminPanel/Stock_Ledger/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult get_Product(string Prefix)
// auth (PORT-NOTE: legacy had no session check; admin stock data => adminAuth)
router.all(`/admin/${C}/get_Product{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Prefix = nStr(req.p.Prefix);
  // dbo.USP_STOCKLEDGER @StockType,@fromDate,@toDate,@remark,@STARTROWINDEX,@MAXROWS,@ProductCode,@Mode,@TOTALCOUNT out
  const AllStock = mapRows(await db.proc(DB, 'USP_STOCKLEDGER', {
    StockType: '', fromDate: '', toDate: '', remark: '', STARTROWINDEX: 1, MAXROWS: 1, Mode: 1, ProductCode: trimS(Prefix),
  }), STOCK_LEDGER_PROPS);
  return res.json(AllStock);
}));

module.exports = router;
