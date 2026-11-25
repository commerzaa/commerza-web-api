'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Ewallet_Report.cs (class Ewallet_ReportController, no namespace => /Ewallet_Report/...)
// Database: affiliate (Db_Affiliate). Procs USP_WALLERT_STATEMENT, Usp_HoldIncomeBYAdmin (via DataUtility.ExecuteSqlSP), USP_EXCEL_LINK,
// USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth, legacyUrl, isAdmin } = require('./_shared/adminSession');
const {
  nInt, nStr, nDec, reqInt, reqDec, col, str, cvtDec, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, dynPaging,
  intParse, errorView,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Ewallet_Report';

/** public class Ewallet_list */
const EWALLET_LIST_PROPS = ['ROWNUMBER', 'REGNO', 'Name', 'LOGINID', 'EmailId', 'UserName', 'Phone', 'ReferralIncome', 'LeadershipBonus',
  'GrowthReferralBonus', 'GrowthLeadershipBonus', 'GrowthBonus', 'DepositedATC', 'Payable', 'Withdrawal', 'Available', 'DirectIncome', 'PLID',
  'HoldWalletBalanceByAdmin'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** Convert.ToDecimal(x.Value.ToString()) (DBNull => "" => FormatException) */
function decParse(v) {
  const s = str(v);
  if (s === '') throw new Error('Input string was not in a correct format.');
  return cvtDec(s);
}

/** [USP_WALLERT_STATEMENT] @STARTROWINDEX,@MAXROWS,@ORDERBYFIELD,@ASC,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@MODE,@LOGINID,@ASCDESCAMOUNT,
 *  @RECORDCOUNT OUT,@TOTALREFERRAL OUT,@TOTALLEADERSHIP OUT,@TOTALGROWTHREFERRAL OUT,@TOTALPAYABLE OUT,@TOTALWITHDRAWAL OUT,@TOTALAVAILABLE OUT,
 *  @TOTALGROWTHLEADERSIP OUT,@TOTALDEPOSITEDATC OUT,@TOTALGROWTHBONUS OUT,@maxamount,@minamount,@HoldWalletBalanceByAdminSum OUT */
const walletStatement = (page, MaxRows, OrderBy, SearchField, SearchValue, maxamount, minamount) => db.proc(DB, 'USP_WALLERT_STATEMENT', {
  STARTROWINDEX: page, MAXROWS: MaxRows, ORDERBYFIELD: OrderBy, ASC: '1', SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: '', TODATE: '',
  MODE: 1, LOGINID: '', ASCDESCAMOUNT: '', maxamount, minamount,
});

/** public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy, decimal? maxamount, decimal? minamount) */
async function ExportReport(req, res, SearchField, SearchValue, page, OrderBy, maxamount, minamount, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Ewallet_Report_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  if (maxamount === null) maxamount = 0;
  if (minamount === null) minamount = 0;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const list = mapRows(await walletStatement(page, MaxRows, OrderBy, SearchField, SearchValue, maxamount, minamount), EWALLET_LIST_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Ewallet_Report.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Username', 'R.B.', 'G.R.B.', 'L.B', 'G.L.B', 'G.B', 'Withdrawal', 'Payable', 'Available', 'Hold'],
      innerProc: 'AllFreeEpinList', outerProc: 'AllFreeEpinList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'UserName')) + ' \t');
        for (const k of ['ReferralIncome', 'GrowthReferralBonus', 'LeadershipBonus', 'GrowthLeadershipBonus', 'GrowthBonus', 'Withdrawal']) {
          w(tab(dec2(item[k])) + ' \t');
        }
        w(dec2(item.Payable).replace(/\t/g, '   ') + ' \t'); // this column replaced tabs with 3 spaces
        w(tab(dec2(item.Available)) + ' \t');
        w(tab(dec2(item.HoldWalletBalanceByAdmin)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, int? page,
//   string OrderBy, decimal? maxamount, decimal? minamount, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/ewallet-report" -> Ewallet_Report/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ewallet-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let OrderBy = nStr(req.p.OrderBy);
  let maxamount = nDec(req.p.maxamount);
  let minamount = nDec(req.p.minamount);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (maxamount === null) maxamount = 0;
  if (minamount === null) minamount = 0;
  const ViewBag = {};
  const perm = await inlinePerms(req.user.emp_id, url); // USP_EXCEL_LINK + USP_GETEXCELPERMISIONSTATUS
  ViewBag.excelactive = perm.excelactive;
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  if (orderbydate === null) orderbydate = '';
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  try {
    const MaxRows = Number(dynamicpagging);
    if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
    if (OrderBy === null) OrderBy = '';
    if (page === null) page = 1;
    const rows = await walletStatement(page, MaxRows, OrderBy, SearchField, SearchValue, maxamount, minamount);
    const list = mapRows(rows, EWALLET_LIST_PROPS);
    const r0 = rows[0];
    const TotalRecord = intParse(col(r0, 'RECORDCOUNT'));
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    for (const k of ['TOTALREFERRAL', 'TOTALLEADERSHIP', 'TOTALGROWTHREFERRAL', 'TOTALPAYABLE', 'TOTALWITHDRAWAL', 'TOTALAVAILABLE', 'TOTALGROWTHLEADERSIP',
      'TOTALDEPOSITEDATC', 'TOTALGROWTHBONUS', 'HoldWalletBalanceByAdminSum']) {
      ViewBag[k] = decParse(col(r0, k));
    }
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.OrderBy = OrderBy;
    ViewBag.MaxAmount = maxamount;
    ViewBag.MinAmount = minamount;
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, SearchField, SearchValue, page, OrderBy, maxamount, minamount, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Ewallet_Report/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_WALLERT_STATEMENT');
  }
}));

// ---------------------------------------------------------------- JsonResult HoldIncome(int PLID, decimal Amount, int NoOfDays)
// auth-by-check (legacy returned Json("Session expired. Please login again.") without a session - contract kept)
router.all(`/admin/${C}/HoldIncome{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const PLID = reqInt(req.p.PLID, 'PLID');
  const Amount = reqDec(req.p.Amount, 'Amount');
  const NoOfDays = reqInt(req.p.NoOfDays, 'NoOfDays');
  let ret = '';
  if (!isAdmin(req)) return res.json('Session expired. Please login again.');
  const Emp_LoginID = req.user.emp_loginid;
  const ObjDUT = new DataUtility();
  const Param = [
    { ParameterName: '@PLID', Value: PLID },
    { ParameterName: '@Amount', Value: Amount },
    { ParameterName: '@HoldByUserId', Value: Emp_LoginID },
    { ParameterName: '@NoOfDays', Value: NoOfDays },
    { ParameterName: '@INTRESULT', Direction: 'Output' },
  ];
  const Reply = await ObjDUT.ExecuteSqlSP(Param, '[Usp_HoldIncomeBYAdmin]');
  const Result = String(Reply); // Param[4].Value.ToString()
  if (Result === '1') ret = 'Amount put on hold successfully.';
  else if (Result === '2') ret = 'Hold amount should be greater than wallet balance.';
  else if (Result === '3') ret = 'Hold Amount should be a non negative value.';
  else ret = 'Some error occured.';
  return res.json(ret);
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy,
//   decimal? maxamount, decimal? minamount)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nInt(req.p.page), nStr(req.p.OrderBy),
    nDec(req.p.maxamount), nDec(req.p.minamount), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
