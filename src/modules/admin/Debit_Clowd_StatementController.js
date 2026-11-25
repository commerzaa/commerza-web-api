'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Debit_Clowd_StatementController.cs
// (class Common.Controllers.AdminPanel.Debit_Clowd_StatementController => /Debit_Clowd_Statement/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { nInt, nStr, col, cvtInt } = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Debit_Clowd_Statement';

/** public class Debit_Clowd_Statement (model at the bottom of the C# file) */
const DEBIT_CLOWD_STATEMENT_PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance',
  'USERNAME', 'Name', 'Particular'];

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, int? page, string fromDate, string toDate,
//   string CrDrType, string TrType, string username, int? ddlcustpage, string myquery1, string myquery, string Particular, string SearchField, string SearchValue)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
// route-config: "AdminPanel/Shopping-Wallet-Statement" -> Debit_Clowd_Statement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Shopping-Wallet-Statement'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let page = nInt(req.p.page);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let CrDrType = nStr(req.p.CrDrType);
  let TrType = nStr(req.p.TrType);
  let username = nStr(req.p.username);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  const myquery1 = nStr(req.p.myquery1);
  const myquery = nStr(req.p.myquery);
  let Particular = nStr(req.p.Particular);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  const ViewBag = {};

  if (ddlcustpage === null) ddlcustpage = 100;
  if (Particular === null) Particular = '';
  ViewBag.back = 0;
  if (myquery !== null && myquery !== '') {
    CrDrType = await UtilityClass.Decryptword(myquery);
    ViewBag.back = 1;
  }
  if (myquery1 !== null && myquery1 !== '') {
    fromDate = await UtilityClass.Decryptword(myquery1);
    ViewBag.back = 1;
  }
  if (dynamicpagging === null) dynamicpagging = 100;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (username === null) username = ''; // eslint-disable-line no-unused-vars
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';

  // (legacy try/catch is commented out => exceptions are unhandled, 500)
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // [dbo].[USP_SHOPPINGSTATEMENT] @PLID,@FROMDATE,@TODATE,@STARTROWINDEX,@MAXROWS,@STRRESULT OUT,@TOTALCOUNT OUT,@CRDRTYPE,@TRTYPE,
  //   @cramount out,@dramount out,@avalibalefund out,@GrossCoinWallet Out,@UsedCoinWallet Out,@GrossCommissionWallet Out,
  //   @UsedCommissionWallet Out,@AvailableCommissionWallet Out,@mode,@Particular,@SEARCHFIELD,@SEARCHVALUE
  const rows = await db.proc(DB, 'USP_SHOPPINGSTATEMENT', {
    PLID: 0, FROMDATE: fromDate, TODATE: toDate, STARTROWINDEX: page, MAXROWS: MaxRows, CrDrType, TrType: cvtInt(TrType),
    mode: '', Particular, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue,
  });
  const Obj = mapRows(rows, DEBIT_CLOWD_STATEMENT_PROPS);

  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.CrDrType = CrDrType;
  ViewBag.TrType = TrType;
  const tc = col(rows[0], 'TOTALCOUNT');
  const TotalRecord = cvtInt(tc === null || tc === undefined || String(tc) === '' ? '0' : String(tc));
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.ddlcustpage = ddlcustpage;
  return res.json({ view: '~/Views/AdminPanel/Debit_Clowd_Statement/Index.cshtml', Model: Obj, ...ViewBag });
}));

module.exports = router;
