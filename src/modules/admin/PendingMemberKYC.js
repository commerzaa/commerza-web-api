'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\PendingMemberKYC.cs (class PendingMemberKYCController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken, errorInsert } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, tab, cellStr, nowStamp, excelHistory, writeXlsExport, excelLink, inlinePerms, outOf,
} = require('./_shared/batch11_common');

const router = express.Router();
const C = 'PendingMemberKYC';

// PORT-NOTE: `private static string url, url1` are static (shared by all requests), kept as module variables.
let url = '';
let url1 = '';

/** class Pending_MemberKYC */
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REGDATE', 'SPONSER', 'MOBILE', 'EMAILID'];

/** int.Parse(SpOutputCount.Value.ToString() == "" ? "0" : ...) */
function totalCount(rows) {
  const s = outOf(rows, 'TOTALCOUNT');
  const n = parseInt(s === '' ? '0' : s, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

/** DBO.USP_PENDINGMEMBERKYC @FROMDATE,@TODATE,@ORDER_BY,@MAXROWS,@TOTALCOUNT out,@STARTROWINDEX,@SEARCHVALUE,@SEARCHFIELD */
function uspPendingMemberKyc(FromDate, ToDate, orderbydate, MaxRows, Page, SearchValue, SearchField) {
  return db.proc(DB, 'USP_PENDINGMEMBERKYC', {
    FROMDATE: FromDate, TODATE: ToDate, ORDER_BY: orderbydate, MAXROWS: MaxRows, STARTROWINDEX: Page, SEARCHVALUE: SearchValue,
    SEARCHFIELD: SearchField,
  });
}

/** public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue) */
async function ExportReport(req, res, Page, FromDate, ToDate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = `Pending_Member_KYC${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  const rows = await uspPendingMemberKyc(FromDate, ToDate, '', MaxRows, Page, SearchValue, SearchField);
  const Pending_Kyc = mapRows(rows, PROPS);
  return writeXlsExport({
    req, res, sheet: 'Pending_Member_KYC.xls', rows: Pending_Kyc, ViewBag, Filename,
    rawHeaders: 'S.No. \tDate \tUsername \tName\t \tSponser \tMobile \tEmailId \t',
    innerProc: 'AllEPinRequestsList', outerProc: 'USP_PENDINGMEMBERKYC',
    cells: (item, w) => {
      w('\n');
      w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
      w(tab(cellStr(item, 'REGDATE')) + ' \t');
      w(tab(cellStr(item, 'USERNAME')) + ' \t');
      w(tab(cellStr(item, 'NAME')) + ' \t');
      w(tab(cellStr(item, 'SPONSER')) + ' \t');
      w(tab(cellStr(item, 'MOBILE')) + ' \t');
      w(tab(cellStr(item, 'EMAILID')) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Pending-Member-KYC" -> PendingMemberKYC/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Pending-Member-KYC'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
  const FromDate = d('FromDate');
  const ToDate = d('ToDate');
  const SearchField = d('SearchField');
  const SearchValue = d('SearchValue');
  let dynamicpagging = nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = d('orderbydate');
  const btnexel = d('btnexel');
  let Page = nInt(req.p.Page);
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const out = {};
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  try {
    const Empid = req.user.emp_id;
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = ...
    if (emp) out.token = issueAdminToken(emp);
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await uspPendingMemberKyc(FromDate, ToDate, orderbydate, MaxRows, Page, SearchValue, SearchField);
    const Pending_Kyc = mapRows(rows, PROPS);
    const TotalRecord = totalCount(rows);
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = FromDate;
    ViewBag.toDate = ToDate;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, Page, FromDate, ToDate, SearchField, SearchValue, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/PendingMemberKYC/Index.cshtml', Model: Pending_Kyc, ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/PendingMemberKYC/Index.cshtml', Model: null, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable; reads Session["Admin_User"], returns member data)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const r = await ExportReport(req, res, nInt(req.p.Page), nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField),
    nStr(req.p.SearchValue), ViewBag);
  if (!r.sent) res.send(''); // void action
}));

module.exports = router;
