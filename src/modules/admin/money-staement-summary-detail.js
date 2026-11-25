'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MoneyStaement_Summary_Detail.cs (class MoneyStaement_Summary_DetailController => /MoneyStaement_Summary_Detail/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nDec, nStr, excelHistory, nowStamp, writeXlsExport, tab, cellStr, dec2, col, outIntOf, nullRef,
} = require('./_shared/batch10-common');

const router = express.Router();
const C = 'MoneyStaement_Summary_Detail';

/** class MoneyStaementSummaryDetail */
const PROPS = ['ROWNUMBER', 'processDate', 'CrDrType', 'USERNAME', 'EMAILID', 'Dr_amount', 'Cr_amount', 'Balance', 'MOBILE'];

// PORT-NOTE: `private static string url, url1` are never assigned in this controller, so ExportReport logs the download with
// DOWNLOADEDFROM = "" (kept).
const url = '';

const notEmpty = (v) => v !== undefined && v !== null && v !== '';

// ---------------------------------------------------------------- Index(int? Page, decimal? FromAmt, string SearchField, decimal? ToAmt, string myquery,
//   string myquery1, string MobileNo, string UserName, string EmailID, int? ddlcustpage, string btnexel)
// auth (legacy had no session check, but it is an admin report and keeps Session["TYPE"/"DATE"] per admin => adminAuth)
// route-config: "AdminPanel/Money-Statement-Summary-Detail" -> MoneyStaement_Summary_Detail/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Money-Statement-Summary-Detail'], adminAuth, asyncHandler(async (req, res) => {
  let Page = nInt(req.p.Page);
  let FromAmt = nDec(req.p.FromAmt); if (FromAmt === null) FromAmt = 0;
  let ToAmt = nDec(req.p.ToAmt); if (ToAmt === null) ToAmt = 0;
  let MobileNo = nStr(req.p.MobileNo); if (MobileNo === null) MobileNo = '';
  let UserName = nStr(req.p.UserName); if (UserName === null) UserName = '';
  let EmailID = nStr(req.p.EmailID); if (EmailID === null) EmailID = '';
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  const myquery = nStr(req.p.myquery);
  const myquery1 = nStr(req.p.myquery1);
  const btnexel = nStr(req.p.btnexel);
  const ViewBag = {};
  let TYPE = '';
  const SearchField = TYPE; // PORT-NOTE: legacy overwrote the SearchField parameter with "" => the first branch never runs (kept)
  if (SearchField !== null && SearchField !== '') {
    TYPE = SearchField;
    sessionStore.set(req, 'TYPE', '');
  } else {
    if (myquery !== null) {
      ViewBag.type = await UtilityClass.Decryptword(myquery);
      sessionStore.set(req, 'TYPE', ViewBag.type);
      TYPE = ViewBag.type;
    }
    const st = sessionStore.get(req, 'TYPE');
    if (notEmpty(st)) {
      ViewBag.type = st;
      TYPE = ViewBag.type;
    }
  }
  let date = '';
  if (myquery1 !== null) {
    ViewBag.DATE = await UtilityClass.Decryptword(myquery1);
    sessionStore.set(req, 'DATE', ViewBag.DATE);
    date = ViewBag.DATE;
  }
  try {
    if (Page === null) Page = 1;
    // [USP_Money_SUMMARY_DETAIL] @STARTROWINDEX,@MAXROWINDEX,@MOBILENO,@EMAILID,@USERNAME,@FROMAMT,@TOAMT,@TOTALCOUNT out,@DATE,@TYPE
    const rows = await db.proc(DB, 'USP_Money_SUMMARY_DETAIL', {
      STARTROWINDEX: Page, MAXROWINDEX: ddlcustpage, MOBILENO: MobileNo, EMAILID: EmailID, USERNAME: UserName, FROMAMT: FromAmt,
      TOAMT: ToAmt, DATE: date, TYPE,
    });
    const list = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: Page, GridPageSize: ddlcustpage, FromAmt, ToAmt, username: UserName, UserName: MobileNo, EmailID, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
    });
    if (btnexel === 'Export Excel') {
      // (ExportReport call commented out in legacy)
    }
    return res.json({ view: '~/Views/AdminPanel/MoneyStaement_Summary_Detail/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void back()
// auth (clears the per-admin Session["DATE"] / Session["TYPE"])
router.all(`/admin/${C}/back{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'DATE', '');
  sessionStore.set(req, 'TYPE', '');
  res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, decimal? FromAmt, decimal? ToAmt, string myquery,
//   string myquery1, string MobileNo, string UserName, string EmailID)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Page = nInt(req.p.Page);
  const FromAmt = nDec(req.p.FromAmt);
  const ToAmt = nDec(req.p.ToAmt);
  const myquery = nStr(req.p.myquery);
  const myquery1 = nStr(req.p.myquery1);
  const MobileNo = nStr(req.p.MobileNo);
  const UserName = nStr(req.p.UserName);
  const EmailID = nStr(req.p.EmailID);
  const ViewBag = {};
  const userid = req.user.emp_id;
  const Filename = 'Ewallet_sumarry_Detail_' + userid + '_' + nowStamp();
  let TYPE = '';
  let date = '';
  if (myquery1 !== null) {
    ViewBag.DATE = await UtilityClass.Decryptword(myquery1);
    sessionStore.set(req, 'DATE', ViewBag.DATE);
    date = ViewBag.DATE;
  }
  const sd = sessionStore.get(req, 'DATE');
  if (sd !== undefined && sd !== null) ViewBag.DATE = sd;
  if (myquery !== null) {
    ViewBag.type = await UtilityClass.Decryptword(myquery);
    sessionStore.set(req, 'TYPE', ViewBag.type);
    TYPE = ViewBag.type;
  }
  const stp = sessionStore.get(req, 'TYPE');
  if (stp !== undefined && stp !== null) ViewBag.type = stp;
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  // [USP_EWALLET_SUMMARY_DETAIL] @STARTROWINDEX,@MAXROWINDEX,@MOBILENO,@EMAILID,@USERNAME,@FROMAMT,@TOAMT,@TOTALCOUNT out,@DATE,@TYPE
  const rows = await db.proc(DB, 'USP_EWALLET_SUMMARY_DETAIL', {
    STARTROWINDEX: Page, MAXROWINDEX: MaxRows, MOBILENO: MobileNo, EMAILID: EmailID, USERNAME: UserName, FROMAMT: FromAmt, TOAMT: ToAmt,
    DATE: date, TYPE,
  });
  const list = mapRows(rows, PROPS);
  const reqStr = (item, k) => { const v = col(item, k); if (v === null || v === undefined) throw nullRef(); return String(v); };
  if (list.length > 0) {
    const r = await writeXlsExport({
      req, res, ViewBag, sheet: 'Ewallet_sumarry_Detail_.xls', Filename,
      headers: ['S.No.', 'Date', 'Username', 'MOBILE', 'EMAILID', ViewBag.type === 'Dr' ? 'Debit' : 'Credit', 'Balance'],
      rows: list, innerProc: 'USP_EWALLET_SUMMARY_DETAIL', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'processDate')) + ' \t');
        w(tab(reqStr(item, 'USERNAME').trim()) + ' \t');
        w(tab(reqStr(item, 'MOBILE')) + ' \t');
        w(tab(reqStr(item, 'EMAILID')) + ' \t');
        w(tab(reqStr(item, 'CrDrType')) + ' \t');
        if (col(item, 'CrDrType') === 'Dr') w(tab(dec2(col(item, 'Dr_amount'))) + ' \t');
        else w(tab(dec2(col(item, 'Cr_amount'))) + ' \t');
        w(tab(dec2(col(item, 'Balance'))) + ' \t');
      },
    });
    if (r.sent) return undefined;
  }
  return res.send('');
}));

module.exports = router;
