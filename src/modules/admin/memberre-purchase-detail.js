'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberrePurchaseDetail.cs (class MemberrePurchaseDetailController => /MemberrePurchaseDetail/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, perms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, netFormat, dec2, outIntOf, trimS,
} = require('./_shared/batch10-common');

const router = express.Router();
const C = 'MemberrePurchaseDetail';

/** class RePurchaseDeatils */
const PROPS = ['RowNumber', 'USERNAME', 'ORDERDATE', 'ORDERNO', 'ORDERAMOUNT', 'BV', 'PV', 'CashBack', 'FNAME'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
// `private string regno` is never used.
let url = '';
let url1 = '';

/** string.Trim('^') */
const trimCaret = (s) => String(s).replace(/^\^+|\^+$/g, '');

// public void ExportReport(int? page, string SearchField, string SearchValue, string RoleMaster, string fromDate, string toDate)
async function ExportReport(req, res, page, SearchField, SearchValue, RoleMaster, fromDate, toDate, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Member_Repurchsedetail_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows (unused)
  // SP_RePurchase_Details @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@Rolename,@FROMDATE,@TODATE,@TOTALCOUNT OUT  (CommandTimeout 1000)
  const rows = await db.proc(DB, 'SP_RePurchase_Details', {
    STARTROWINDEX: page, MAXROWS: 1000000, SEARCHFIELD: trimS(SearchField), SEARCHVALUE: trimS(SearchValue), Rolename: trimS(RoleMaster),
    FROMDATE: trimS(fromDate), TODATE: trimS(toDate),
  });
  const AllFreeEpinList = mapRows(rows, PROPS);
  if (AllFreeEpinList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Member_Repurchsedetail.xls', Filename,
      headers: ['S.NO.', 'USERNAME', 'NAME', 'ORDERDATE', 'ORDERNO', 'ORDERAMOUNT', 'BV', 'REDEEMABLE CASHBACK', 'RECEIVABLE CASHBACK'],
      rows: AllFreeEpinList, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'FNAME')) + ' \t');
        w(tab(netFormat(col(item, 'ORDERDATE'), 'dd-MMM-yyyy')) + ' \t');
        w(tab(cellStr(item, 'ORDERNO')) + ' \t');
        w(tab(dec2(col(item, 'ORDERAMOUNT'))) + ' \t');
        w(tab(dec2(col(item, 'BV'))) + ' \t');
        w(tab(dec2(col(item, 'PV'))) + ' \t');
        w(tab(dec2(col(item, 'CashBack'))) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string RoleMaster, string fromDate, string toDate, int? page,
//   int? ddlcustpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/member-repurchase-detail" -> MemberrePurchaseDetail/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-repurchase-detail'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  let SearchField = nStr(req.p.SearchField); if (SearchField === null) SearchField = '';
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  let RoleMaster = nStr(req.p.RoleMaster);
  if (RoleMaster === null) RoleMaster = ''; else RoleMaster = trimCaret(RoleMaster);
  let fromDate = nStr(req.p.fromDate); if (fromDate === null) fromDate = '';
  let toDate = nStr(req.p.toDate); if (toDate === null) toDate = '';
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let page = nInt(req.p.page);
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  // USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(spOutput.Value) (overwrites ViewBag.isactive; DBNull => InvalidCastException)
  const lk = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ia = col(lk, 'isactive');
  if (ia === null || ia === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  ViewBag.isactive = Number(ia);
  // (try/catch commented out in legacy: errors surface as 500)
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'SP_RePurchase_Details', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), Rolename: RoleMaster.trim(),
    FROMDATE: fromDate.trim(), TODATE: toDate.trim(),
  });
  const AllFreeEpinList = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue,
    fromDate, toDate, ddlcustpage,
  });
  await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, page, SearchField, SearchValue, RoleMaster, fromDate, toDate, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/MemberrePurchaseDetail/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(int? page, string SearchField, string SearchValue, string RoleMaster,
//   string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, nInt(req.p.page), v('SearchField'), v('SearchValue'), v('RoleMaster'), v('fromDate'), v('toDate'), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
