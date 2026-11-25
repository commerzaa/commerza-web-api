'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Wallet_status.cs (class Wallet_statusController => /admin/Wallet_status/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'Wallet_status';

/** class WalletStatus */
const WALLET_STATUS_PROPS = ['ROWNUMBER', 'UserName', 'Mobile', 'EmailId', 'Working_Wallet', 'Cashback', 'I_Wallet', 'ShoppingWallet'];
/** class Dynamic_wallet (Dashboard.cs) */
const DYNAMIC_WALLET_PROPS = ['TITLE', 'MID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

// PORT-NOTE: the export's batch text "DBO.USP_Wallet_Status ...,@ShoppingWallet,@orderbydate,@SearchValue" references @orderbydate,
// but that SqlParameter was never added (the `new SqlParameter("@orderbydate", ...)` statement after the call is discarded), so
// SQL Server always failed with "Must declare the scalar variable "@orderbydate"." (uncaught => 500 for ExportReport and for Index with
// btnexel = "Export Excel"). Reproduced after the excel-history insert; the writer below is kept for completeness.
const LEGACY_EXPORT_QUERY_THROWS = true;

/** dbo.USP_WALLETLIST @EMPID */
const walletList = async (EMPID) => mapRows(await db.proc(DB, 'USP_WALLETLIST', { EMPID }), DYNAMIC_WALLET_PROPS);

// public void ExportReport(string orderbydate, string SearchField, string SearchValue, string fromAmt, string toAmt, string UserName, int? page, string EmailID, string Mobile)
async function ExportReport(req, res, ViewBag, orderbydate, SearchField, SearchValue, fromAmt, toAmt, UserName, page, EmailID, Mobile) {
  void orderbydate; void fromAmt; void toAmt;
  const userid = req.user.emp_id;
  const Filename = 'WalletStatus_' + userid + '_' + B.nowStamp();
  const Employeeid = req.user.emp_id;
  await B.excelHistory(userid, url, Filename);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (UserName === null) UserName = '';
  if (EmailID === null) EmailID = '';
  if (Mobile === null) Mobile = '';
  if (page === null) page = 1;
  const MaxRows = 1000000;
  if (LEGACY_EXPORT_QUERY_THROWS) throw new Error('Must declare the scalar variable "@orderbydate".');
  // (unreachable in legacy) OUT params passed without the OUT keyword => their values stay DBNull
  const rows = await db.proc(DB, 'USP_Wallet_Status', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, FROMAmt: '', TOAmt: '', UserName, Mobile, EmailID, SearchValue,
  });
  const Obj = mapRows(rows, WALLET_STATUS_PROPS);
  // Convert.ToDecimal(TOTAWorking.Value.ToString()): OUT values without the OUT keyword stay DBNull => "" => FormatException
  const sumworking = B.decOutStrict([{ TOTAWorking: '' }], 'TOTAWorking');
  const sumcashback = B.decOutStrict(rows, 'TOTACashback');
  const sumIwallet = B.decOutStrict(rows, 'TOTAIWallet');
  const Shopping_Wallet = B.decOutStrict(rows, 'ShoppingWallet');
  ViewBag.CurrentPage = page;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  const Dynamic_wallet = await walletList(Employeeid);
  let Ewallet = 0; let growth = 0; let commission = 0; let shopping = 0;
  if (Obj.length > 0) {
    let hdr = 'S.No. \tUsername \tMobileNo. \tEmailId. \t';
    for (const item of Dynamic_wallet) {
      const nm = () => { if (item.TITLE === null || item.TITLE === undefined) throw B.nullRef(); return String(item.TITLE).split(' ').join(''); };
      if (Number(item.MID) === 47) { hdr += nm() + ' \t'; Ewallet = 1; }
      if (Number(item.MID) === 48) { hdr += nm() + ' \t'; growth = 1; }
      if (Number(item.MID) === 50) { hdr += nm() + ' \t'; commission = 1; }
      if (Number(item.MID) === 63) { hdr += nm() + ' \t'; shopping = 1; }
    }
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'WalletStatus.xls', Filename, rawHeaders: hdr,
      rows: Obj, innerProc: 'AllFreeEpinList', outerProc: 'USP_Wallet_Status',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'UserName')) + ' \t');
        w(B.tab(B.cellStr(item, 'Mobile')) + ' \t');
        w(B.tab(B.cellStr(item, 'EmailId')) + ' \t');
        if (Ewallet === 1) w(B.tab(B.dec2(item.I_Wallet)) + ' \t');
        if (growth === 1) w(B.tab(B.dec2(item.Cashback)) + ' \t');
        if (commission === 1) w(B.tab(B.dec2(item.Working_Wallet)) + ' \t');
        if (shopping === 1) w(B.tab(B.dec2(item.ShoppingWallet)) + ' \t');
      },
      trailer: (w) => {
        w('\n');
        w(' \t'); w(' \t'); w(' \t');
        w('Total: \t');
        if (Ewallet === 1) w(B.dec2(sumIwallet) + ' \t');
        if (growth === 1) w(B.dec2(sumcashback) + ' \t');
        if (commission === 1) w(B.dec2(sumworking) + ' \t');
        if (shopping === 1) w(B.dec2(Shopping_Wallet) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string SearchField, string SearchValue, string fromAmt, string toAmt, string UserName, int? page, int? ddlcustpage, string EmailID, string Mobile, string btnexel, string orderbydate)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Wallet-Status" -> Wallet_status/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Wallet-Status'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromAmt = B.nStr(req.p.fromAmt);
  let toAmt = B.nStr(req.p.toAmt);
  let UserName = B.nStr(req.p.UserName);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let EmailID = B.nStr(req.p.EmailID);
  let Mobile = B.nStr(req.p.Mobile);
  let btnexel = B.nStr(req.p.btnexel);
  let orderbydate = B.nStr(req.p.orderbydate);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (orderbydate === null) orderbydate = 'desc';
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) dynamicpagging = B.dynPaging();
  const ViewBag = {};
  const p = await B.perms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  ViewBag.Dynamic_wallet = await walletList(Employeeid);

  const MaxRows = B.cvtInt(dynamicpagging);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromAmt === null) fromAmt = '';
  if (toAmt === null) toAmt = '';
  if (UserName === null) UserName = '';
  if (EmailID === null) EmailID = '';
  if (Mobile === null) Mobile = '';
  if (page === null) page = 1;
  if (btnexel === null) btnexel = '';
  // DBO.USP_Wallet_Status @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@FROMAmt,@TOAmt,@UserName,@Mobile,@EmailID,@TOTALCOUNT,@TOTAWorking,
  //   @TOTAIWallet,@TOTACashback,@ShoppingWallet,@orderbydate,@SearchValue
  // PORT-NOTE: the OUT parameters are named in the batch text WITHOUT the OUT keyword, so SQL Server never copied their values back:
  // TotalRecord and the four sums were always DBNull => "" => 0. Reproduced (the PG OUT columns are ignored).
  const rows = await db.proc(DB, 'USP_Wallet_Status', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, FROMAmt: '', TOAmt: '', UserName, Mobile: '', EmailID,
    orderbydate, SearchValue,
  });
  const Obj = mapRows(rows, WALLET_STATUS_PROPS);
  const TotalRecord = 0;
  const sumworking = 0; const sumcashback = 0; const sumIwallet = 0; const Shopping_Wallet = 0;
  ViewBag.TOTAIWallet = B.dec2(sumIwallet);
  ViewBag.TOTAWorking = B.dec2(sumworking);
  ViewBag.TOTACashback = B.dec2(sumcashback);
  ViewBag.Shopping_Wallet = B.dec2(Shopping_Wallet);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.orderbydate = orderbydate;
  ViewBag.fromDate = fromAmt;
  ViewBag.toDate = toAmt;
  ViewBag.SearchValue = SearchValue;
  ViewBag.ByStatus = EmailID;
  ViewBag.OrderBy = Mobile;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, orderbydate, SearchField, SearchValue, fromAmt, toAmt, UserName, page, EmailID, Mobile);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Wallet_status/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string orderbydate, string SearchField, string SearchValue, string fromAmt, string toAmt, string UserName, int? page, string EmailID, string Mobile)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.orderbydate), B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue),
    B.nStr(req.p.fromAmt), B.nStr(req.p.toAmt), B.nStr(req.p.UserName), B.nInt(req.p.page), B.nStr(req.p.EmailID), B.nStr(req.p.Mobile));
  if (!r.sent) res.send('');
}));

module.exports = router;
