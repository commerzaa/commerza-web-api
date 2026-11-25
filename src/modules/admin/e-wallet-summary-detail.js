'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\EWallet_Summary_Detail.cs
// (class EWallet_Summary_DetailController => /admin/EWallet_Summary_Detail/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'EWallet_Summary_Detail';

// PORT-NOTE: `private static string url, url1` are NEVER assigned in this controller => USP_EXCEL_DOWNLOAD_HISTORY @DOWNLOADEDFROM is always "".
const url = '';

/** class DailyEwallet_Summary_Detail */
const DETAIL_PROPS = ['ROWNUMBER', 'Date', 'Type', 'USERNAME', 'EMAILID', 'Amount', 'CurrentBalance', 'MOBILE', 'REGNO'];

/** [USP_EWALLET_SUMMARY_DETAIL] @STARTROWINDEX,@MAXROWINDEX,@MOBILENO,@EMAILID,@USERNAME,@FROMAMT,@TOAMT,@TOTALCOUNT out,@DATE,@TYPE (CommandTimeout 1000) */
async function summaryDetail(o) {
  return db.proc(DB, 'USP_EWALLET_SUMMARY_DETAIL', {
    STARTROWINDEX: o.Page, MAXROWINDEX: o.MaxRows, MOBILENO: o.MobileNo, EMAILID: o.EmailID, USERNAME: o.UserName,
    FROMAMT: o.FromAmt, TOAMT: o.ToAmt, DATE: o.date, TYPE: o.TYPE,
  });
}

/** Regex.Replace(x, "\t", "    ") on a string property (null => ArgumentNullException) */
function rx(v) {
  if (v === null || v === undefined) throw new Error("Value cannot be null.\r\nParameter name: input");
  return B.tab(v);
}

// ---------------------------------------------------------------- Index(int? Page, decimal? FromAmt, string SearchField, decimal? ToAmt, string myquery, string myquery1, string MobileNo, string UserName, string EmailID, int? ddlcustpage, string btnexel)
// public (legacy had no session check and never reads Session["Admin_User"]); optionalAuth so Session["TYPE"]/["DATE"] are keyed per admin
// route-config: "AdminPanel/EWallet-Summary-Detail" -> EWallet_Summary_Detail/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/EWallet-Summary-Detail'], optionalAuth, asyncHandler(async (req, res) => {
  let Page = B.nInt(req.p.Page);
  let FromAmt = B.nDec(req.p.FromAmt);
  const SearchField = B.nStr(req.p.SearchField);
  let ToAmt = B.nDec(req.p.ToAmt);
  const myquery = B.nStr(req.p.myquery);
  const myquery1 = B.nStr(req.p.myquery1);
  let MobileNo = B.nStr(req.p.MobileNo);
  let UserName = B.nStr(req.p.UserName);
  let EmailID = B.nStr(req.p.EmailID);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  const btnexel = B.nStr(req.p.btnexel);
  const ViewBag = {};

  if (FromAmt === null) FromAmt = 0;
  if (ToAmt === null) ToAmt = 0;
  if (MobileNo === null) MobileNo = '';
  if (UserName === null) UserName = '';
  if (EmailID === null) EmailID = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  let TYPE = '';
  if (SearchField !== null && SearchField !== '') {
    TYPE = SearchField;
    sessionStore.set(req, 'TYPE', '');
  } else {
    if (myquery !== null) {
      ViewBag.type = await UtilityClass.Decryptword(myquery);
      sessionStore.set(req, 'TYPE', ViewBag.type);
      TYPE = ViewBag.type;
    }
    // PORT-NOTE: legacy `Session["TYPE"] == ""` is an object/string REFERENCE comparison; it is true for the interned "" literal
    // (and String.Empty) only, so it is ported as a value comparison with ''.
    const st = sessionStore.get(req, 'TYPE');
    if (st !== undefined && st !== null && st === '') {
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
  const sd = sessionStore.get(req, 'DATE');
  if (sd !== undefined && sd !== null && sd === '') { // same reference-comparison remark as TYPE
    ViewBag.DATE = sd;
    date = ViewBag.DATE;
  }

  try {
    if (Page === null) Page = 1;
    const rows = await summaryDetail({ Page, MaxRows: ddlcustpage, MobileNo, EmailID, UserName, FromAmt, ToAmt, date, TYPE });
    const Model = mapRows(rows, DETAIL_PROPS);
    const tc = B.str(B.col(rows[0], 'totalcount'));
    const TotalRecord = B.cvtInt(tc === '' ? '0' : tc);
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = ddlcustpage;
    ViewBag.FRAMT = FromAmt;
    ViewBag.TOAmt = ToAmt;
    ViewBag.username = UserName;
    ViewBag.mobile = MobileNo;
    ViewBag.emailid = EmailID;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    if (btnexel === 'Export Excel') {
      // legacy: body commented out
    }
    return res.json({ view: '~/Views/AdminPanel/EWallet_Summary_Detail/Index.cshtml', Model, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void back()
// public (legacy had no session check; only clears Session["DATE"] / Session["TYPE"]); optionalAuth for the per-admin store
router.all(`/admin/${C}/back{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'DATE', '');
  sessionStore.set(req, 'TYPE', '');
  res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, decimal? FromAmt, decimal? ToAmt, string myquery, string myquery1, string MobileNo, string UserName, string EmailID)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Page = B.nInt(req.p.Page);
  const FromAmt = B.nDec(req.p.FromAmt);
  const ToAmt = B.nDec(req.p.ToAmt);
  const myquery = B.nStr(req.p.myquery);
  const myquery1 = B.nStr(req.p.myquery1);
  const MobileNo = B.nStr(req.p.MobileNo);
  const UserName = B.nStr(req.p.UserName);
  const EmailID = B.nStr(req.p.EmailID);
  const ViewBag = {};

  const userid = req.user.emp_id;
  const Filename = 'Ewallet_sumarry_Detail_' + userid + '_' + B.nowStamp();
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
  const st = sessionStore.get(req, 'TYPE');
  if (st !== undefined && st !== null) ViewBag.type = st;
  await B.excelHistory(userid, url, Filename);

  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  // PORT-NOTE: null FromAmt/ToAmt/MobileNo/... were sent as SqlParameter(null) (= parameter omitted -> proc default/error); passed as null here.
  const Model = mapRows(await summaryDetail({ Page, MaxRows, MobileNo, EmailID, UserName, FromAmt, ToAmt, date, TYPE }), DETAIL_PROPS);
  if (Model.length > 0) {
    const r = await B.writeXlsExport({
      req, res, ViewBag, sheet: 'Ewallet_sumarry_Detail_.xls', Filename,
      headers: ['S.No.', 'Date', 'Username', 'MOBILE', 'EMAILID', ViewBag.type === 'Dr' ? 'Debit' : 'Credit', 'Balance'],
      rows: Model,
      innerProc: 'USP_EWALLET_SUMMARY_DETAIL',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(rx(item.Date) + ' \t');
        if (item.USERNAME === null || item.USERNAME === undefined) throw B.nullRef();
        w(rx(String(item.USERNAME).trim()) + ' \t');
        w(rx(item.MOBILE) + ' \t');
        w(rx(item.EMAILID) + ' \t');
        w(rx(item.Type) + ' \t');
        if (item.Type === 'Dr') {
          w(B.tab(B.dec2(item.Amount)) + ' \t');
        } else {
          w(B.tab(B.dec2(item.Amount)) + ' \t');
        }
        w(B.tab(B.dec2(item.CurrentBalance)) + ' \t');
      },
    });
    if (r.sent) return undefined;
  }
  return res.send(''); // void action => empty response
}));

module.exports = router;
