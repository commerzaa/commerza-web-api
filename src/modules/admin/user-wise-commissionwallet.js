'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserWise_Commissionwallet.cs
//   (namespace Common.Controllers.AdminPanel, class UserWise_CommissionwalletController => /admin/UserWise_Commissionwallet/...)
// Database: affiliate (Db_Affiliate). Procs UPS_CommissionWalletSummary, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, str, cvtInt, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2,
} = require('./_shared/batch11-common');

const router = express.Router();
const C = 'UserWise_Commissionwallet';

/** EWalletSummary.cs class EWalletSummary */
const EWALLET_SUMMARY_PROPS = ['ROWNUMBER', 'Username', 'Name', 'MOBILE', 'EMAILID', 'Activation', 'Registration', 'Credited', 'Used', 'Balance',
  'Requested', 'Pending', 'Rejected', 'ADMINTRAFER'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** Convert.ToInt32(x.Value.ToString() == "" ? "0" : x.Value.ToString()) on an OUT column */
const outInt0 = (rows, name) => {
  const s = str(col(rows[0], name));
  return cvtInt(s === '' ? '0' : s);
};

/**
 * PORT-NOTE: the legacy export EXEC passes its arguments positionally and omits @SEARCHFIELD/@SEARCHVALUE:
 *   "UPS_CommissionWalletSummary @UserName, @fromDate, @toDate ,@datetype,@STARTROWINDEX,@MAXROWS,@TotalRecord out,..."
 * so the 7th argument "@TotalRecord out" lands on the proc's 7th parameter @STARTROWINDEX, which is not an OUTPUT parameter.
 * SQL Server rejects the call (Msg 8162) and, as nothing catches it, the request fails (500). That failure is reproduced; the
 * remaining export code is kept below for completeness but is unreachable, exactly like in the legacy app.
 */
const LEGACY_EXPORT_EXEC_FAILS = true;

/** public void ExportReport(string fromDate, string toDate, string UserName, string datetype) */
async function ExportReport(req, res, fromDate, toDate, UserName, datetype, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Commission_WalletSummary_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  if (LEGACY_EXPORT_EXEC_FAILS) {
    const e = new Error('The formal parameter "@STARTROWINDEX" was not declared as an OUTPUT parameter, but the actual parameter passed in requested output.');
    e.status = 500;
    throw e;
  }
  // (unreachable) positional mapping as SQL Server would bind it
  const rows = await db.proc(DB, 'UPS_CommissionWalletSummary', {
    UserName, SEARCHFIELD: fromDate, SEARCHVALUE: toDate, fromDate: datetype, Todate: 1, datetype: 9999999, orderbydate: '',
  });
  const objAllWalletList = mapRows(rows, EWALLET_SUMMARY_PROPS);
  const TotalAllBalance = outInt0(rows, 'TotalBalance');
  const USEDAmount = outInt0(rows, 'USED');
  const TotalCREDITED = outInt0(rows, 'CREDITED');
  if (objAllWalletList.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'E_WalletSummary.xls', Filename, ViewBag, rows: objAllWalletList,
      headers: ['S.No.', 'Username', 'Name', 'MOBILE', 'Credited', 'Used', 'Balance'],
      innerProc: 'E_WalletSummary', outerProc: 'Usp_TransferFundToUser',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'Username')) + ' \t');
        const name = cellStr(item, 'Name');
        const Fname = name.split(' ').join('');
        w(tab(Fname) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(dec2(item.Credited)) + ' \t');
        w(tab(dec2(item.Used)) + ' \t');
        w(tab(dec2(item.Balance)) + ' \t');
      },
      trailer: (w) => {
        w('\n');
        w(tab('') + ' \t');
        w(tab('') + ' \t');
        w(tab('') + ' \t');
        w(tab('Total:') + ' \t');
        w(tab(dec2(TotalCREDITED)) + ' \t');
        w(tab(dec2(USEDAmount)) + ' \t');
        w(tab(dec2(TotalAllBalance)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   string datetype, string btnexel, string fromDate, string toDate, string UserName, int? page)
// auth (legacy had no explicit check but casts Session["Admin_User"] => NullReferenceException without a session)
// route-config: "AdminPanel/UserWise-Commissionwallet" -> UserWise_Commissionwallet/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/UserWise-Commissionwallet'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let datetype = nStr(req.p.datetype);
  let btnexel = nStr(req.p.btnexel);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let UserName = nStr(req.p.UserName);
  let page = nInt(req.p.page);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (UserName === null) UserName = '';
  if (btnexel === null) btnexel = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (datetype === null) datetype = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  const MaxRows = cvtInt(dynamicpagging);
  if (page === null) page = 1;
  // DBO.UPS_CommissionWalletSummary @UserName,@SEARCHFIELD,@SEARCHVALUE,@fromDate,@toDate,@datetype,@STARTROWINDEX,@MAXROWS,@TotalRecord out,
  //   @TotalBalance out,@orderbydate,@USED out,@CREDITED out
  const rows = await db.proc(DB, 'UPS_CommissionWalletSummary', {
    UserName: UserName.trim(), SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), fromDate, Todate: toDate, datetype,
    STARTROWINDEX: page, MAXROWS: MaxRows, orderbydate,
  });
  const objAllWalletList = mapRows(rows, EWALLET_SUMMARY_PROPS);
  const TotalRecord = outInt0(rows, 'TotalRecord');
  const TotalAllBalance = outInt0(rows, 'TotalBalance');
  ViewBag.TotalAllBalance = TotalAllBalance;
  const USEDAmount = outInt0(rows, 'USED');
  ViewBag.USED = USEDAmount;
  const TotalCREDITED = outInt0(rows, 'CREDITED');
  ViewBag.CREDITED = TotalCREDITED;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.CurrentPage = page;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, fromDate, toDate, UserName, datetype, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/UserWise_Commissionwallet/Index.cshtml', Model: objAllWalletList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string UserName, string datetype)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.UserName), nStr(req.p.datetype), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
