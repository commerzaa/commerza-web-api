'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SalaryIncome.cs (class SalaryIncomeController, no namespace => /admin/SalaryIncome/...)
// Database: affiliate (Db_Affiliate). Procs USP_SALARYMASTER_GROUP_BONUS, USP_EXCEL_DOWNLOAD_HISTORY; table tbl_salarychart.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, perms, nowStamp, netFormat, excelHistory, writeXlsExport, cellStr, tab, dec2, trimNull,
} = require('./_shared/batch06-common');
const { outIntOf, reqLong } = require('./_shared/batch11-common');
const { decOutOf, moneyLiteral } = require('./_shared/batch13-05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'SalaryIncome';

/** public class SalaryIncomeList */
const SALARY_INCOME_LIST_PROPS = ['ROWNUMBER', 'INVEST_AMOUNT', 'DAILYGROWTH_RATE', 'INVEST_DATE', 'GROWTHDAYS', 'PAIDDAYS', 'CURRENTRETURN', 'KID',
  'RemainDays', 'USERNAME', 'REGNO', 'LAST_UPDATE', 'MAXRETURN', 'Name', 'Mobile'];
/** public class GetDetails1 */
const GET_DETAILS1_PROPS = ['REGNO', 'GROWTHAMOUNT', 'GROWTHDATE', 'KID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string username, string orderby, int? page, int? ddlcustpage) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, username, orderby, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'SalaryIncome' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // eslint-disable-line no-unused-vars
  if (page === null) page = 1;
  // [USP_SALARYMASTER_GROUP_BONUS] @PLID,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out,@Mode,@USERNAME,@ASCDESC
  // PORT-NOTE: the legacy EXEC is positional and skips the proc's 10th parameter @SumEarndPoind (money OUT), so @USERNAME's value landed in
  // @SumEarndPoind (varchar -> money: '' => 0, non-numeric => conversion error => 500) and @ASCDESC's value (orderby) landed in @USERNAME;
  // @ASCDESC kept its default. Reproduced: username is validated as a money literal (PG cannot pass an OUT param), USERNAME = orderby.
  moneyLiteral(username);
  const Obj = mapRows(await db.proc(DB, 'USP_SALARYMASTER_GROUP_BONUS', {
    PLID: '0', StartRowIndex: page, MaxRows: '1000000', SearchField: trimNull(SearchField), SearchValue: trimNull(SearchValue),
    fromDate: trimNull(fromdate), ToDate: trimNull(todate), Mode: '2', USERNAME: orderby,
  }), SALARY_INCOME_LIST_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'SalaryIncome.xls', Filename, ViewBag, rows: Obj,
      headers: ['S.No.', 'Name', 'Username', 'Mobile', 'InvesmentDate', 'LastCredited', 'MaxReturn', 'InvesmentAmount', 'CurrentReturn'],
      innerProc: 'GrowthBonusList', outerProc: 'USP_SALARYMASTER_GROUP_BONUS',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(netFormat(item.INVEST_DATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(netFormat(item.LAST_UPDATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(dec2(item.MAXRETURN)) + ' \t');
        w(tab(dec2(item.INVEST_AMOUNT)) + ' \t');
        w(tab(dec2(item.CURRENTRETURN)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string SearchField, string SearchValue,
//   string fromdate, string todate, string username, string orderby, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/SalaryIncome" -> SalaryIncome/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/SalaryIncome'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let username = nStr(req.p.username);
  let orderby = nStr(req.p.orderby);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // GrowthlevelUrl = Request.Url.ToString(); the whole query string (after '?') is an encrypted username.
  let GrowthlevelUrl = String(req.originalUrl || req.url || '');
  try { GrowthlevelUrl = decodeURI(GrowthlevelUrl); } catch (_) { /* Uri.ToString() unescapes; keep raw when malformed */ }
  const Growthrequesturl = GrowthlevelUrl.split('?');
  let usernameurl = '';
  if (Growthrequesturl.length >= 2) {
    usernameurl = await UtilityClass.Decryptword(String(Growthrequesturl[1]));
    username = usernameurl;
  }
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (username === null) username = '';
  if (orderby === null) orderby = '';
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
  // [USP_SALARYMASTER_GROUP_BONUS] @PLID,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out,@Mode,
  //   @SumEarndPoind out,@USERNAME,@ASCDESC,@TOTALAMOUNT out
  const rows = await db.proc(DB, 'USP_SALARYMASTER_GROUP_BONUS', {
    PLID: '0', StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromdate.trim(),
    ToDate: todate.trim(), Mode: '2', USERNAME: username, ASCDESC: orderby,
  });
  const Obj = mapRows(rows, SALARY_INCOME_LIST_PROPS);
  const TotalRecord = outIntOf(rows, 'TotalCount');
  const TOTALAMOUNTS = decOutOf(rows, 'TOTALAMOUNT');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TOTALAMOUNTS = TOTALAMOUNTS;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.orderby = orderby;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, username, orderby, page, ddlcustpage, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/SalaryIncome/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate,
//   string username, string orderby, int? page, int? ddlcustpage)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nStr(req.p.username), nStr(req.p.orderby), nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GetDetails(Int64 regno)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = reqLong(req.p.regno, 'regno');
  // SELECT ROW_NUMBER() OVER(ORDER BY REGNO) AS REGNO,GROWTHAMOUNT,CONVERT(VARCHAR(100), GROWTHDATE) AS GROWTHDATE,KID FROM TBL_SALARYCHART WHERE REGNO='<regno>'
  // PORT-NOTE: parameterised (legacy concatenated); CONVERT(VARCHAR, date) => yyyy-mm-dd, same as date::varchar.
  const Obj = mapRows(await db.query(DB, `select row_number() over (order by regno) as regno, growthamount, (growthdate)::varchar(100) as growthdate, kid
    from tbl_salarychart where regno = @regno`, { regno }), GET_DETAILS1_PROPS);
  // Obj is never null => always Json(Obj, AllowGet) (ViewBag.dataobj = Obj is not observable in a JsonResult)
  return res.json(Obj);
}));

module.exports = router;
