'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ManageLimit.cs (class ManageLimitController => /ManageLimit/...)
// Database: affiliate (Db_Affiliate). Procs: USP_EmployeeLedgerDetails, USP_CREATEAMOUNT, USP_EXCEL_LINK.
// Config: DynamicPagging.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, s0, reqInt, cvtInt, cvtDec, perms, excelLink, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outStr, outIntOf, nullRef,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'ManageLimit';

/** class EmployeeDetails */
const PROPS = ['RowNumber', 'empId', 'empName', 'usedAmount', 'availableAmount', 'maxLimit', 'created_date'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string fromDate, string toDate, string EmpName)
async function ExportReport(req, res, fromDate, toDate, EmpName, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'ManageLimit_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows; // (unused: 99999999 is passed)
  const empId = req.user.emp_id;
  ViewBag.EmpId = empId;
  if (EmpName === null) throw nullRef();
  // [DBO].[USP_EmployeeLedgerDetails] @EmpName,@StartRowIndex,@MaxRows,@fromDate,@ToDate,@SEARCHFIELD,@SEARCHVALUE,@TotalCount out,@TotalUsed out,
  //   @TotalAvailable out,@TotalMaxLimit out   (no @orderbydate here)
  const rows = await db.proc(DB, 'USP_EmployeeLedgerDetails', {
    EmpName: EmpName.trim(), StartRowIndex: 1, MaxRows: 99999999, fromDate, ToDate: toDate, SEARCHFIELD: toDate, SEARCHVALUE: toDate,
  });
  const Obj = mapRows(rows, PROPS);
  const TotalAllUsed = outIntOf(rows, 'totalused');
  const TotalAvailabl = outIntOf(rows, 'totalavailable');
  const TotalLimit = outIntOf(rows, 'totalmaxlimit');
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'ManageLimit.xls', Filename,
      headers: ['S.No.', 'Employee', 'CreatedDate', 'Used', 'Available', 'MaxLimit'],
      rows: Obj, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        const Name = cellStr(item, 'empName');
        const From_Username = Name.split(' ').join('');
        w(tab(From_Username) + ' \t');
        w(tab(cellStr(item, 'created_date')) + ' \t');
        w(tab(cellStr(item, 'usedAmount')) + ' \t');
        w(tab(cellStr(item, 'availableAmount')) + ' \t');
        w(tab(cellStr(item, 'maxLimit')) + ' \t');
      },
      trailer: (w) => {
        w('\n');
        w(tab('') + ' \t');
        w(tab('') + ' \t');
        w(tab('TotalAmount') + ' \t');
        w(tab(String(TotalAllUsed)) + ' \t');
        w(tab(String(TotalAvailabl)) + ' \t');
        w(tab(String(TotalLimit)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string EmpName, string btnexel,
//   string fromDate, string toDate, int? page)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/manage-limit" -> ManageLimit/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/manage-limit'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await perms(Empid, url));
  let dynamicpagging = nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = cvtInt(value === undefined || value === '' ? null : value); // Convert.ToInt16(string) (null => 0)
  }
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  ViewBag.excelactive = await excelLink(url);
  let Obj = [];
  let EmpName = nStr(req.p.EmpName);
  let btnexel = nStr(req.p.btnexel);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let page = nInt(req.p.page);
  try {
    if (EmpName === null) EmpName = '';
    if (btnexel === null) btnexel = '';
    if (fromDate === null) fromDate = '';
    if (toDate === null) toDate = '';
    if (page === null) page = 1;
    const MaxRows = dynamicpagging;
    const empId = req.user.emp_id;
    ViewBag.EmpId = empId;
    const rows = await db.proc(DB, 'USP_EmployeeLedgerDetails', {
      EmpName: EmpName.trim(), StartRowIndex: page, MaxRows, fromDate, ToDate: toDate, SEARCHFIELD: toDate, SEARCHVALUE: toDate, orderbydate,
    });
    Obj = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    const TotalAllUsed = outIntOf(rows, 'totalused');
    const TotalAvailabl = outIntOf(rows, 'totalavailable');
    const TotalLimit = outIntOf(rows, 'totalmaxlimit');
    Object.assign(ViewBag, {
      TotalAllUsed, TotalAvailabl, TotalLimit, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate, orderbydate, dynamicpagging, toDate, EmpName,
    });
  } catch (Exp) {
    // PORT-NOTE: legacy called Response.Redirect("/page-not-found") FIRST (ThreadAbortException), so its ErrorInsert block never ran.
    console.error('[admin] ManageLimit/Index:', Exp.message);
    return res.json({ redirect: '/page-not-found' });
  }
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, fromDate, toDate, EmpName, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/ManageLimit/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string EmpName)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.EmpName), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult insertAmount(string Id, string Amount, int mode)
// auth (PORT-NOTE: legacy had no session check on this admin limit write - protected)
router.all(`/admin/${C}/insertAmount{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const mode = reqInt(req.p.mode, 'mode');
  const EmpId = cvtInt(nStr(req.p.Id));
  const AvalaibleAmount = cvtDec(nStr(req.p.Amount));
  // DBO.USP_CREATEAMOUNT @EID,@Amount,@Mode,@StrResult OUT
  const row = await db.procOne(DB, 'USP_CREATEAMOUNT', { EID: EmpId, Amount: AvalaibleAmount, Mode: mode });
  return res.json(outStr(row, 'strresult'));
}));

module.exports = router;
