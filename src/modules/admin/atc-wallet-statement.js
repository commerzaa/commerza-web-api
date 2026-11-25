'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Atc_Wallet_StatementController.cs
// (namespace Common.Controllers.AdminPanel, class Atc_Wallet_StatementController => /Atc_Wallet_Statement/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, toInt32, toStr, nullRef, tab, nowStamp, excelLink, pagePermissions, tsvExport } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Atc_Wallet_Statement';

/** class Atc_Wallet_Statement */
const PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'USERNAME', 'Name', 'Particular'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state). (`private string regno` unused.)
let url = '';
let url1 = '';

/** public void ExportReport(string CrDrType, string fromDate, string toDate, string Particular) */
async function ExportReport(req, res, ViewBag, CrDrType, fromDate, toDate, Particular) {
  const userid = req.user.emp_id;
  const Filename = `Atc_Wallet_Statement_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // eslint-disable-next-line no-unused-vars
  const MaxRows = await UtilityClass.GridPageSize();
  // [Usp_TransactionHistory] (19 params here: no @SEARCHFIELD/@SEARCHVALUE; @orderbydate = "")
  const Obj = mapRows(await db.proc(DB, 'Usp_TransactionHistory', {
    PLID: 0, FromDate: fromDate, ToDate: toDate, StartRowIndex: 1, MaxRows: 10000000, CrDrType, TrType: 6,
    GrossCoinWallet: '0', UsedCoinWallet: '0', GrossCommissionWallet: '0', UsedCommissionWallet: '0', AvailableCommissionWallet: '0',
    orderbydate: '', Particular,
  }), PROPS);
  if (Obj.length > 0) {
    let Rownumber = 1;
    return tsvExport({
      req, res, ViewBag, sheet: 'Atc_Wallet_Statement.xls', filename: Filename, rows: Obj, innerProc: 'Atc_Wallet_Statement', outerProc: 'Usp_TransferFundToUser',
      headers: ['S.No. \t', 'Date \t', 'Username \t', 'Name \t', 'Type \t', 'Amount \t', 'Balance \t', 'Particulars \t'],
      cells: (item, w) => {
        w(tab(String(Rownumber)) + ' \t');
        w(tab(toStr(item.ProcessDate)) + ' \t');
        w(tab(toStr(item.USERNAME)) + ' \t');
        w(tab(toStr(item.Name)) + ' \t');
        if (Number(item.Dr_Amount) > 0) w(tab('Dr.') + ' \t');
        else w(tab('Cr.') + ' \t');
        w(tab(toStr(item.Dr_Amount)) + ' \t');
        if (item.Cr_Amount === null || item.Cr_Amount === undefined) nullRef();
        w(tab(Number(item.Cr_Amount).toFixed(2)) + ' \t'); // ToString("0.00")
        w(tab(toStr(item.Particular)) + ' \t');
        Rownumber += 1;
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? page, string btnexel, string fromDate, string toDate, string CrDrType, string TrType, string username, int? ddlcustpage, string myquery1, string myquery, string Particular, string SearchField, string SearchValue)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Coin-Wallet-Statement" -> Atc_Wallet_Statement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Coin-Wallet-Statement'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let page = nint(req.p.page);
  let btnexel = sv(req.p.btnexel);
  let fromDate = sv(req.p.fromDate);
  let toDate = sv(req.p.toDate);
  let CrDrType = sv(req.p.CrDrType);
  let TrType = sv(req.p.TrType);
  let username = sv(req.p.username);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const myquery1 = sv(req.p.myquery1);
  const myquery = sv(req.p.myquery);
  let Particular = sv(req.p.Particular);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (btnexel === null) btnexel = '';
  if (Particular === null) Particular = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  ViewBag.back = 0;
  if (myquery !== null && myquery !== '') {
    CrDrType = await UtilityClass.Decryptword(myquery);
    ViewBag.back = 1;
  }
  if (myquery1 !== null && myquery1 !== '') {
    fromDate = await UtilityClass.Decryptword(myquery1);
    ViewBag.back = 1;
  }
  if (fromDate === null) fromDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (username === null) username = '';
  const Empid = req.user.emp_id;
  const perm1 = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm1._opIsDownloadAllowed;
  ViewBag.isedit = perm1._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  ViewBag.excelactive = await excelLink(url);
  const perm = await pagePermissions(Empid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  let Obj = [];
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // select REGNO from MEMBER_MASTER where username='<username>'  (result unused; parameterised)
    // eslint-disable-next-line no-unused-vars
    const Regno = (await db.scalar(DB, 'select regno from member_master where username = @username limit 1', { username })) || 0;
    const rows = await db.proc(DB, 'Usp_TransactionHistory', {
      PLID: 0, FromDate: fromDate, ToDate: toDate, StartRowIndex: page, MaxRows, CrDrType, TrType: 6,
      GrossCoinWallet: '0', UsedCoinWallet: '0', GrossCommissionWallet: '0', UsedCommissionWallet: '0', AvailableCommissionWallet: '0',
      orderbydate, Particular, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    });
    Obj = mapRows(rows, PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.toDate = toDate; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x'); // Convert.ToInt32(DBNull.ToString()) => FormatException
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_TransactionHistory');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, CrDrType, fromDate, toDate, Particular)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Atc_Wallet_Statement/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string CrDrType, string fromDate, string toDate, string Particular)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.CrDrType), sv(req.p.fromDate), sv(req.p.toDate), sv(req.p.Particular));
  if (!sent) res.send('');
}));

module.exports = router;
