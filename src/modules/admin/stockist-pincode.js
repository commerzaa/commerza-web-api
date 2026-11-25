'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\StockistPincode.cs (class StockistPincodeController, no namespace => /admin/StockistPincode/...)
// Database: affiliate (Db_Affiliate). Proc USP_StockistPincode.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, nStr, col, str, cvtInt, outOf } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'StockistPincode';

/** public class StockistPincode */
const STOCKIST_PINCODE_PROPS = ['ROWNUMBER', 'FRID', 'PINCODE', 'AsignFrom', 'Mobile', 'FRCode', 'FRNADDRESS'];

// ---------------------------------------------------------------- ActionResult Index(string StockistCode, int? page, int? ddlcustpage, string Stockist)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/StockistPincode" -> StockistPincode/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/StockistPincode'], adminAuth, asyncHandler(async (req, res) => {
  let StockistCode = nStr(req.p.StockistCode);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  const Stockist = nStr(req.p.Stockist);
  const ViewBag = {};
  if (Stockist !== '' && Stockist !== null) StockistCode = await UtilityClass.Decryptword(Stockist);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (StockistCode === '' || StockistCode === null || StockistCode === undefined) {
    StockistCode = '0';
    ViewBag.Code = 1;
    ViewBag.StockistCode = '';
  } else {
    ViewBag.StockistCode = StockistCode;
  }
  if (page === null) page = 1;
  // int Empid = ((Employee_Master)Session["Admin_User"]).Emp_ID;  (unused)
  // dbo.USP_StockistPincode @STARTROWINDEX,@MAXROWS,@StockistCode,@TOTALCOUNT out,@PLID out
  const rows = await db.proc(DB, 'USP_StockistPincode', { STARTROWINDEX: page, MAXROWS: ddlcustpage, StockistCode: String(StockistCode).trim() });
  const AllEPinRequestsList = mapRows(rows, STOCKIST_PINCODE_PROPS);
  const tc = str(col(rows[0], 'TOTALCOUNT'));
  const TotalRecord = cvtInt(tc === '' ? '0' : tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.PLID = outOf(rows, 'PLID');
  ViewBag.PCode = StockistCode;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.BasicDetails = rows.length ? mapRow(rows[0], STOCKIST_PINCODE_PROPS) : null; // .FirstOrDefault()
  return res.json({ view: '~/Views/AdminPanel/StockistPincode/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
}));

module.exports = router;
