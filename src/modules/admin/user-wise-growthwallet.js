'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserWise_Growthwallet.cs
// (namespace Common.Controllers.AdminPanel, class UserWise_GrowthwalletController => /admin/UserWise_Growthwallet/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; ExportReport (public void => routable) -> route + internal function (used by Index).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { int0Of, noSpace, viewJson, sendVoid } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'UserWise_Growthwallet';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';
// (private string regno = "" - unused instance field)

/** class EWalletSummary (Controllers/AdminPanel/EWalletSummary.cs) */
const PROPS = ['ROWNUMBER', 'Username', 'Name', 'MOBILE', 'EMAILID', 'Activation', 'Registration', 'Credited', 'Used', 'Balance', 'Requested',
  'Pending', 'Rejected', 'ADMINTRAFER'];

/** DBO.UPS_GrowthWalletSummary @UserName,@SEARCHFIELD,@SEARCHVALUE,@fromDate,@toDate,@datetype,@STARTROWINDEX,@MAXROWS,@TotalRecord out,
 *  @TotalBalance out,@orderbydate,@USED out,@CREDITED out */
function summaryProc(UserName, SearchField, SearchValue, fromDate, toDate, datetype, STARTROWINDEX, MAXROWS, orderbydate) {
  if (SearchField === null || SearchValue === null) throw B.nullRef(); // SearchField.Trim()
  return db.proc(DB, 'UPS_GrowthWalletSummary', {
    UserName, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), fromDate, toDate, datetype, STARTROWINDEX, MAXROWS, orderbydate,
  });
}

// public void ExportReport(string fromDate, string toDate, string UserName, string datetype, string orderbydate, string SearchField, string SearchValue)
async function ExportReport(req, res, ViewBag, fromDate, toDate, UserName, datetype, orderbydate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'Growth_WalletSummary_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows; // (unused, like legacy)
  const rows = await summaryProc(UserName, SearchField, SearchValue, fromDate, toDate, datetype, 1, 99999999, orderbydate);
  const objAllWalletList = mapRows(rows, PROPS);
  const TotalAllBalance = int0Of(rows, 'TotalBalance');
  const USEDAmount = int0Of(rows, 'USED');
  const TotalCREDITED = int0Of(rows, 'CREDITED');
  if (objAllWalletList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'E_WalletSummary.xls', Filename,
      headers: ['S.No.', 'Username', 'Name', 'MOBILE', 'Credited', 'Used', 'Balance'],
      rows: objAllWalletList, innerProc: 'E_WalletSummary', outerProc: 'Usp_TransferFundToUser',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'Username')) + ' \t');
        w(B.tab(noSpace(item, 'Name')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILE')) + ' \t');
        w(B.tab(B.dec2(item.Credited)) + ' \t');
        w(B.tab(B.dec2(item.Used)) + ' \t');
        w(B.tab(B.dec2(item.Balance)) + ' \t');
      },
      trailer: (w) => {
        w('\n');
        w(' \t');
        w(' \t');
        w(' \t');
        w('Total: \t');
        w(B.dec2(TotalCREDITED) + ' \t');
        w(B.dec2(USEDAmount) + ' \t');
        w(B.dec2(TotalAllBalance) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string SearchField, string SearchValue, string orderbydate, string datetype, string btnexel, string fromDate, string toDate, string UserName, int? page)
// auth (reads Session["Admin_User"] - legacy NullReference without a session)
// route-config: "AdminPanel/UserWise-Growthwallet" -> UserWise_Growthwallet/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/UserWise-Growthwallet'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const UserName = B.s0(req.p.UserName);
  const SearchField = B.s0(req.p.SearchField);
  const SearchValue = B.s0(req.p.SearchValue);
  const btnexel = B.s0(req.p.btnexel);
  const fromDate = B.s0(req.p.fromDate);
  const toDate = B.s0(req.p.toDate);
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = B.s0(req.p.orderbydate);
  const datetype = B.s0(req.p.datetype);
  let page = B.nInt(req.p.page);
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const p = await B.inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out  => Convert.ToInt32(v == "" ? "0" : v)
  const xl = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = int0Of(xl ? [xl] : [], 'isactive');

  const MaxRows = dynamicpagging;
  if (page === null) page = 1;
  const rows = await summaryProc(UserName, SearchField, SearchValue, fromDate, toDate, datetype, page, MaxRows, orderbydate);
  const objAllWalletList = mapRows(rows, PROPS);
  const TotalRecord = int0Of(rows, 'TotalRecord');
  ViewBag.TotalAllBalance = int0Of(rows, 'TotalBalance');
  ViewBag.CREDITED = int0Of(rows, 'CREDITED');
  ViewBag.USED = int0Of(rows, 'USED');
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.CurrentPage = page;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromDate, toDate, UserName, datetype, orderbydate, SearchField, SearchValue);
    if (r.sent) return undefined;
  }
  return viewJson(res, '~/Views/AdminPanel/UserWise_Growthwallet/Index.cshtml', objAllWalletList, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string UserName, string datetype, string orderbydate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('fromDate'), v('toDate'), v('UserName'), v('datetype'), v('orderbydate'), v('SearchField'),
    v('SearchValue'));
  return sendVoid(res, r);
}));

module.exports = router;
