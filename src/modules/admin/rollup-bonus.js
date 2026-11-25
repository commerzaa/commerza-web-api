'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\RollupBonus.cs (class RollupBonusController, no namespace => /admin/RollupBonus/...)
// Database: affiliate (Db_Affiliate). Procs USP_DIRECTINCOME_REPORT (@INCOMETYPE 2), USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, col, str, cvtDec, perms, nowStamp, netFormat, excelHistory, writeXlsExport, cellStr, tab, dec2, trimNull,
} = require('./_shared/batch06-common');
const { outIntOf } = require('./_shared/batch11-common');
const { copyToDownloaded } = require('./_shared/batch13-05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'RollupBonus';

/** ReferralBonus.cs class GetReferalIncome */
const GET_REFERAL_INCOME_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT',
  'ADMIN_AMT', 'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'TOTALAMOUNT', 'SystemProcessPer', 'SystemProcessAmount', 'Net', 'ISSKIP',
  'FROMNAME', 'TONAME'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** if (X.Value.ToString() != "") v = Convert.ToDecimal(X.Value.ToString()); (else 0) */
function optDec(rows, name) {
  const s = str(col(rows && rows[0], name));
  return s !== '' ? cvtDec(s) : 0;
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag) { // eslint-disable-line no-unused-vars
  const userid = req.user.emp_id;
  const Filename = 'Rollup_Bonus_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  if (page === null) page = 1;
  // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT out,@TOTALAdminc out,
  //   @TOTALTDS out,@TOTALINCOME out,@TOTALAmount out,@TOTALAMOUNTS out,@ISHOLD
  const list = mapRows(await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
    STARTROWINDEX: page, MAXROWS: 10000000, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: trimNull(SearchField),
    SEARCHVALUE: trimNull(SearchValue), INCOMETYPE: 2, ISHOLD: '0',
  }), GET_REFERAL_INCOME_PROPS);
  if (list.length > 0) {
    const x = await writeXlsExport({
      req, res, sheet: 'Rollup_Bonus.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Date', 'From Username', 'To Username', 'commission', 'Earned', 'TDS', 'Admin Charge', 'Payble Amount\t', 'Level'],
      innerProc: 'GetReferalIncome', outerProc: 'USP_DIRECTINCOME_REPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(cellStr(item, 'FROMUSERNAME')) + ' \t');
        w(tab(cellStr(item, 'TOUSERNAME')) + ' \t');
        w(tab(dec2(item.AMOUNT)) + ' \t');
        w(tab(dec2(item.COMM_PER)) + ' \t');
        w(tab(dec2(item.TOTALAMOUNT)) + ' \t');
        w(tab(dec2(item.TDS_AMT)) + ' \t');
        w(tab(dec2(item.ADMIN_AMT)) + ' \t');
        w(tab(dec2(item.INCOME)) + ' \t');
        w(tab(dec2(item.LEVEL)) + ' \t');
      },
    });
    // Unlike its siblings this export does File.Copy(filepath, filepath1) BEFORE Response.Redirect, so the copy did happen.
    if (x.sent) await copyToDownloaded(req, 'Rollup_Bonus.xls', Filename, 'USP_DIRECTINCOME_REPORT');
    return x;
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField,
//   string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel, string Date)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Rollup-bonus-report" -> RollupBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Rollup-bonus-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  const Date = nStr(req.p.Date);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (Date !== null) fromdate = await UtilityClass.Decryptword(Date);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  // (no try/catch in the legacy action: exceptions => 500)
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // [USP_DIRECTINCOME_REPORT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@INCOMETYPE,@TOTALCOUNT out,@TOTALAdminc out,
  //   @TOTALTDS out,@TOTALINCOME out,@TOTALAmount out,@TOTALAMOUNTS out,@ISHOLD,@orderbydate
  const rows = await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    INCOMETYPE: 2, ISHOLD: '0', orderbydate,
  });
  const AllFreeEpinList = mapRows(rows, GET_REFERAL_INCOME_PROPS);
  const TotalRecord = outIntOf(rows, 'TOTALCOUNT');
  const TOTALAdminCharge = optDec(rows, 'TOTALAdminc');
  const TOTALTDSCharge = optDec(rows, 'TOTALTDS');
  const TOTALINCOMES = optDec(rows, 'TOTALINCOME');
  const TOTALAmounts = optDec(rows, 'TOTALAmount');
  const TOTALAMOUNT = optDec(rows, 'TOTALAMOUNTS');
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TOTALAdminCharge = TOTALAdminCharge;
  ViewBag.TOTALTDSCharge = TOTALTDSCharge;
  ViewBag.TOTALINCOMES = TOTALINCOMES;
  ViewBag.TOTALAmounts = TOTALAmounts;
  ViewBag.TOTALAMOUNT = TOTALAMOUNT;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, page, ddlcustpage, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/RollupBonus/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
