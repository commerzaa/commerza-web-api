'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Bfx_CoinTopup.cs (class Bfx_CoinTopupController => /Bfx_CoinTopup/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toInt32, toStr, nullRef, tab, nowStamp, excelLink, pagePermissions, tsvExport } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Bfx_CoinTopup';

/** class BfxCoinTopup */
const PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILE', 'EMAILID', 'AMOUNT', 'PAYBLECOIN', 'GENRATEDDATE', 'BFXADDRESS', 'ISBLOCKCLEAR'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue, string status) */
async function ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField, SearchValue, status) {
  const userid = req.user.emp_id;
  const Filename = `Bfx_Coin_Topup_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // [Usp_BFXCOINTOPUP] (9 params here, no @orderbydate)
  const list = mapRows(await db.proc(DB, 'Usp_BFXCOINTOPUP', {
    STARTROWINDEX: 1, MAXROWS: 9999999, FROMDATE: FromDate, TODATE: ToDate, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, status,
  }), PROPS);
  if (list.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Bfx_Coin_Topup.xls', filename: Filename, rows: list, innerProc: 'Reversetransactionlist',
      outerProc: 'USP_REVERSETRANSACTIONLIST_EWallet',
      headers: ['S.No. \t', 'Username \t', 'Mobile No. \t', 'Date \t', 'Amount(INR) \t', 'BFX Coin \t', 'BFX Address \t', 'BLOCK STATUS \t'],
      cells: (item, w) => {
        w(tab(toStr(item.ROWNUMBER)) + ' \t');
        w(tab(toStr(item.USERNAME)) + ' \t');
        w(tab(toStr(item.MOBILE)) + ' \t');
        w(tab(toStr(item.GENRATEDDATE)) + ' \t');
        if (item.AMOUNT === null || item.AMOUNT === undefined) nullRef();
        w(tab(Number(item.AMOUNT).toFixed(2)) + ' \t');
        w(tab(toStr(item.PAYBLECOIN)) + ' \t');
        // (legacy wrote no BFXADDRESS cell although the header has "BFX Address")
        w(tab(toStr(item.ISBLOCKCLEAR)) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string btnexel, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string Bfxaddress, string status)
// auth
// route-config: "AdminPanel/Bfx-CoinTopup" -> Bfx_CoinTopup/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Bfx-CoinTopup'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let btnexel = sv(req.p.btnexel);
  let Page = nint(req.p.Page);
  let FromDate = sv(req.p.FromDate);
  let ToDate = sv(req.p.ToDate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let Bfxaddress = sv(req.p.Bfxaddress); // eslint-disable-line no-unused-vars
  let status = sv(req.p.status);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const perm = await pagePermissions(req.user.emp_id, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (status === null) status = '-1';
  if (status === '') status = '-1';
  if (FromDate === null) FromDate = '';
  if (Bfxaddress === null) Bfxaddress = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  try {
    // Select PLID From Portal_login Where UserName='<SearchValue>'  (result unused; parameterised)
    // eslint-disable-next-line no-unused-vars
    const Plid = (await db.scalar(DB, 'select plid from portal_login where username = @SearchValue limit 1', { SearchValue })) || 0;
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await db.proc(DB, 'Usp_BFXCOINTOPUP', {
      STARTROWINDEX: Page, MAXROWS: MaxRows, FROMDATE: FromDate, TODATE: ToDate, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, status, orderbydate,
    });
    const list = mapRows(rows, PROPS);
    const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x'); // Convert.ToInt32(DBNull.ToString()) => FormatException
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ToDate = ToDate;
    ViewBag.FromDate = FromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.status = status;
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField, SearchValue, status)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Bfx_CoinTopup/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'StoreIndex');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue, string status)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.FromDate), sv(req.p.ToDate), sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.status));
  if (!sent) res.send('');
}));

module.exports = router;
