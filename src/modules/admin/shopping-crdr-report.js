'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ShoppingCRDRReport.cs
// (class Common.Controllers.AdminPanel.ShoppingCRDRReportController => /admin/ShoppingCRDRReport/...). Database: affiliate (Db_Affiliate).
// Coverage: Index -> route ; ExportReport (public void => routable) -> route + internal function.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'ShoppingCRDRReport';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/**
 * [USP_SHOPPINGSTATEMENT_CRDRREPORT] @PLID,@SEARCHFIELD,@SEARCHVALUE,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@StrResult OUT,@TotalCount OUT,
 *   @CrDrType,@TrType,@cramount out,@dramount out,@avalibalefund out,'','','','','',@mode
 * PORT-NOTE: the five positional '' values went to the OUT params @GrossCoinWallet..@AvailableCommissionWallet as inputs (never read);
 * PostgreSQL OUT params are not passed (they come back as result columns, ignored like legacy).
 */
function crdr(p) {
  B.need(p);
  return db.proc(DB, 'USP_SHOPPINGSTATEMENT_CRDRREPORT', p);
}

/** public void ExportReport(string fromDate, int? page, string orderbydate, string toDate, string CrDrType, string TrType, string username, string Particular, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, fromDate, page, orderbydate, toDate, CrDrType, TrType, username, Particular, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'ShoppingCRDRReport' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  if (page === null) page = 1;
  if (orderbydate === null) orderbydate = '';
  // select REGNO from MEMBER_MASTER with(nolock) where username='<username>' (parameterised; result unused, like legacy)
  const Regno = await db.scalar(DB, 'select regno from member_master where username = @u limit 1', { u: username === null ? '' : username });
  void Regno;
  const Obj = mapRows(await crdr({
    PLID: 0, SEARCHFIELD: B.trimS(SearchField), SEARCHVALUE: B.trimS(SearchValue), FromDate: fromDate, TrType: B.cvtInt(TrType),
    StartRowIndex: page, MaxRows: 99999999, ToDate: toDate, CrDrType, mode: '',
  }), B.DEBIT_CLOWD_STATEMENT_PROPS);
  let RowNumber = 1;
  return B.writeXlsExport({
    req, res, ViewBag, sheet: 'ShoppingCRDRReport.xls', Filename,
    headers: ['S.No.', 'Date', 'Username', 'Name', 'Type', 'Amount', 'Balance', 'Remark'],
    rows: Obj, innerProc: 'Working_statement', outerProc: 'Usp_TransferFundToUser',
    cells: (item, w) => {
      w('\n');
      w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
      w(B.tab(B.cellStr(item, 'ProcessDate')) + ' \t'); // DateTime.ToString()
      w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
      w(B.tab(B.cellStr(item, 'Name')) + ' \t');
      w(B.tab(B.cellStr(item, 'Name')) + ' \t'); // legacy wrote Name twice (Type column)
      const dr = Number(item.Dr_Amount); const cr = Number(item.Cr_Amount);
      if (dr > 0) w(B.tab('Dr.') + ' \t');
      else if (cr > 0) w(B.tab('Cr.') + ' \t');
      if (dr > 0) w(B.tab(B.dec2(item.Dr_Amount)) + ' \t');
      else if (cr > 0) w(B.tab(B.dec2(item.Cr_Amount)) + ' \t');
      w(B.tab(B.dec2(item.Balance)) + ' \t');
      if (item.Remark !== null && item.Remark !== undefined) w(B.tab(String(item.Remark)) + ' \t');
      else w(B.tab('') + ' \t');
      RowNumber += 1;
    },
  });
}

// ---------------------------------------------------------------- Index(int? page, string fromDate, string orderbydate, string Particular, string SearchField, string SearchValue, string toDate, string CrDrType, string TrType, string username, string btnexel, int? ddlcustpage)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Shopping-CRDRReport" -> ShoppingCRDRReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Shopping-CRDRReport'], adminAuth, asyncHandler(async (req, res) => {
  let page = B.nInt(req.p.page);
  let fromDate = B.nStr(req.p.fromDate);
  let orderbydate = B.nStr(req.p.orderbydate);
  let Particular = B.nStr(req.p.Particular);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let toDate = B.nStr(req.p.toDate);
  let CrDrType = B.nStr(req.p.CrDrType);
  let TrType = B.nStr(req.p.TrType);
  let username = B.nStr(req.p.username);
  const btnexel = B.nStr(req.p.btnexel);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (Particular === null) Particular = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (orderbydate === null) orderbydate = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (username === null) username = '';
  const ViewBag = {};
  let Obj = [];
  try {
    url1 = legacyUrl(req).slice(1);
    url = '~' + url1;
    ViewBag.excelactive = await B.excelLink(url); // inline USP_EXCEL_LINK
    const Employeeid = req.user.emp_id;
    const Empid = req.user.emp_id;
    const perm = await B.perms(Empid, url); // CheckPermissions
    ViewBag.isactive = perm.isactive;
    ViewBag.isedit = perm.isedit;
    ViewBag.excelactive = perm.excelactive;
    const ip = await B.inlinePerms(Employeeid, url); // inline USP_GETEXCELPERMISIONSTATUS (overrides isactive/isedit)
    ViewBag.isactive = ip.isactive;
    ViewBag.isedit = ip.isedit;
    const MaxRows = Number(ddlcustpage);
    if (page === null) page = 1;
    const rows = await crdr({
      PLID: 0, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FromDate: fromDate, TrType: B.cvtInt(TrType),
      StartRowIndex: page, MaxRows, ToDate: toDate, CrDrType, mode: '',
    });
    Obj = mapRows(rows, B.DEBIT_CLOWD_STATEMENT_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = B.outIntOf(rows, 'TotalCount');
    // Convert.ToInt32(dramount.Value.ToString()) - decimal OUT without scale comes back rounded; DBNull => FormatException (=> catch)
    const TotalDrAmt = B.decOutIntOf(rows, 'dramount');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalDrAmt = TotalDrAmt;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect ends the request
  }
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromDate, page, orderbydate, toDate, CrDrType, TrType, username, Particular, SearchField, SearchValue);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/ShoppingCRDRReport/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('fromDate'), B.nInt(req.p.page), v('orderbydate'), v('toDate'), v('CrDrType'), v('TrType'),
    v('username'), v('Particular'), v('SearchField'), v('SearchValue'));
  if (!r.sent) res.send('');
}));

module.exports = router;
