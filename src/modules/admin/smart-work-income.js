'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Smart_Work_IncomeController.cs (class Smart_Work_IncomeController => /admin/Smart_Work_Income/...)
// Database: affiliate (Db_Affiliate).
// Coverage: Index ([SessionExpireCheck]) -> route ; ExportReport (public void => routable) -> route + internal function.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'Smart_Work_Income';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests. (`private object AllFreeList` unused.)
let url = '';
let url1 = '';

/** class Smart_Work_Income */
const PROPS = ['ROWNUMBER', 'USERNAME', 'Name', 'MOBILE', 'DATE', 'ADMINCHARGE', 'TDS', 'NetIncome', 'MatchCount', 'TotalIncome'];

/** [USP_SMARTWORKINCOME] @STARTROWINDEX,@MAXROWS,@REGNO,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@TOTALINCOME OUT,@TOTALNETINCOME OUT */
function smartWork(p) {
  B.need(p);
  return db.proc(DB, 'USP_SMARTWORKINCOME', p);
}

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'Smart_Work_Income' + userid + '_' + B.netFormat(new Date(), 'ddMMyyyy');
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const AllFreeList = mapRows(await smartWork({
    STARTROWINDEX: page, MAXROWS: MaxRows, REGNO: 0, SEARCHFIELD: B.trimS(SearchField), SEARCHVALUE: B.trimS(SearchValue),
    FROMDATE: B.trimS(fromdate), TODATE: B.trimS(todate),
  }), PROPS);
  if (AllFreeList.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Smart_Work_Income.xls', Filename,
      headers: ['S.No.', 'UserName', 'Name', 'MobileNo', 'Date', 'MatchCount', 'TotalIncome', 'AdminCharge', 'TDS', 'NetIncome'],
      rows: AllFreeList, innerProc: 'USP_AUTO_PURCHASEINCOME', outerProc: 'USP_AUTO_PURCHASEINCOME',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'Name')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILE')) + ' \t');
        w(B.tab(B.cellStr(item, 'DATE')) + ' \t'); // DateTime.ToString()
        w(B.tab(B.cellStr(item, 'MatchCount')) + ' \t');
        w(B.tab(B.dec2(item.TotalIncome)) + ' \t');
        w(B.tab(B.dec2(item.ADMINCHARGE)) + ' \t');
        w(B.tab(B.dec2(item.TDS)) + ' \t');
        w(B.tab(B.dec2(item.NetIncome)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/smart-work-income" -> Smart_Work_Income/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/smart-work-income'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const perm = await B.perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // (no try/catch in legacy: errors => 500)
  const rows = await smartWork({
    STARTROWINDEX: page, MAXROWS: MaxRows, REGNO: 0, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromdate.trim(), TODATE: todate.trim(),
  });
  const AllFreeList = mapRows(rows, PROPS);
  const tc = B.outOf(rows, 'TOTALCOUNT');
  // int.Parse(v == "" ? "0" : v) on a BigInt OUT param (the proc declares DECIMAL(18,8); converted to an integer by ADO.NET)
  const TotalRecord = tc === '' ? 0 : Math.trunc(B.decParse(tc));
  const TOTALNETINCOMES = B.outDecOf(rows, 'TOTALNETINCOME');
  const TOTALINCOMES = B.outDecOf(rows, 'TOTALINCOME');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TOTALINCOMES = TOTALINCOMES;
  ViewBag.TOTALNETINCOMES = TOTALNETINCOMES;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, page, ddlcustpage);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Smart_Work_Income/Index.cshtml', Model: AllFreeList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('SearchField'), v('SearchValue'), v('fromdate'), v('todate'), B.nInt(req.p.page), B.nInt(req.p.ddlcustpage));
  if (!r.sent) res.send('');
}));

module.exports = router;
