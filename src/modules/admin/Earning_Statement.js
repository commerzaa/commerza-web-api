'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Earning_Statement.cs (class Earning_StatementController, no namespace => /Earning_Statement/...)
// Database: affiliate (Db_Affiliate). Procs Usp_Daily_Liability, USP_EXCEL_DOWNLOAD_HISTORY, usp_GetMemberDetails.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  nInt, nStr, nDec, col, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dec2, errorView, dynPaging, intParse,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Earning_Statement';

/** public class Earning_Statement */
const EARNING_STATEMENT_PROPS = ['RowNumber', 'DATE', 'BINARYINCOME', 'BinaryLevelIncome', 'DIRECTINCOME', 'LEVELINCOME', 'ROI', 'ROI_GROWTHLEVEL',
  'PAYID', 'TotalPayement'];
/** All_Member_List.cs class MemberDetails */
const MEMBER_DETAILS_PROPS = ['regNo', 'LoginId', 'Password', 'FName', 'MName', 'LName', 'mobile', 'Emailid', 'dob', 'gender', 'pincode', 'address',
  'ctid', 'cityname', 'Panno', 'spounserId', 'RespounserName', 'Regdate', 'name', 'relation', 'Accountno', 'Bankname', 'branchName', 'IfscCode',
  'addres', 'gpv', 'status', 'Kycstatus', 'Active', 'DTHCustomerId', 'Application_FormNo', 'BitCoinWalletAddress', 'AcHolderName', 'PaypalEmail',
  'MoneygarmName', 'MoneygarmAddress', 'HighestQualification', 'USERNAME', 'Title', 'GaKeyStatus', 'SID', 'parentid', 'CID', 'Atc_WalletAddress'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** Convert.ToDecimal(object) of an OUT value (DBNull => InvalidCastException) */
function toDecimalObj(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  return Number(v);
}

/** public void ExportReport(string fromDate, string toDate, int? page) */
async function ExportReport(req, res, fromDate, toDate, page, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Earning_Statement_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // [Usp_Daily_Liability] @StartRowIndex,@MaxRowIndex,@FROM,@TO,@TotalCount out,@TotalBI out,@TotalBRI out,@TotalRI out,@TotalLI out,@TotalGI out,@TotalGRI out
  const Obj = mapRows(await db.proc(DB, 'Usp_Daily_Liability', { StartRowIndex: page, MaxRowIndex: MaxRows, FROM: fromDate, TO: toDate }),
    EARNING_STATEMENT_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Earning_Statement.xls', Filename, ViewBag, rows: Obj,
      rawHeaders: 'S.No. \tDate \tBinary Income\tBinary Referral Income \tReferral Income \tLevel Income \tGrowth Income \tGrowth Referral Income \t',
      innerProc: 'Earning_Statement', outerProc: 'USP_EARNING_REPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'DATE')) + ' \t');
        for (const k of ['BINARYINCOME', 'BinaryLevelIncome', 'DIRECTINCOME', 'LEVELINCOME', 'ROI', 'ROI_GROWTHLEVEL']) w(tab(dec2(item[k])) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string fromDate,
//   string toDate, int? page, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/earning-statements" -> Earning_Statement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/earning-statements'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let page = nInt(req.p.page);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  if (orderbydate === null) orderbydate = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // [Usp_Daily_Liability] @StartRowIndex,@MaxRowIndex,@FROM,@TO,@TotalCount out,@TotalBI out,@TotalBRI out,@TotalRI out,@TotalLI out,
    //   @TotalGI out,@TotalGRI out,@TotalPayable out,@orderbydate
    const rows = await db.proc(DB, 'Usp_Daily_Liability', { StartRowIndex: page, MaxRowIndex: MaxRows, FROM: fromDate, TO: toDate, orderbydate });
    const Obj = mapRows(rows, EARNING_STATEMENT_PROPS);
    const r0 = rows[0];
    const TotalRecord = intParse(col(r0, 'TotalCount'));
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.toDate = toDate;
    ViewBag.TotalBI = toDecimalObj(col(r0, 'TotalBI'));
    ViewBag.TotalBRI = toDecimalObj(col(r0, 'TotalBRI'));
    ViewBag.TotalRI = toDecimalObj(col(r0, 'TotalRI'));
    ViewBag.TotalLI = toDecimalObj(col(r0, 'TotalLI'));
    ViewBag.TotalGI = toDecimalObj(col(r0, 'TotalGI'));
    ViewBag.TotalGRI = toDecimalObj(col(r0, 'TotalGRI'));
    ViewBag.TotalPayble = toDecimalObj(col(r0, 'TotalPayable'));
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, fromDate, toDate, page, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Earning_Statement/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_EARNING_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, int? page)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nInt(req.p.page), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GetMemeberDetails(double regno)
// auth (PORT-NOTE: legacy had no session check; returns member personal/bank data => adminAuth)
router.all(`/admin/${C}/GetMemeberDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = nDec(req.p.regno);
  if (regno === null) {
    const e = new Error("The parameters dictionary contains a null entry for parameter 'regno' of non-nullable type 'System.Double'");
    e.status = 500;
    throw e;
  }
  const r = await db.procOne(DB, 'usp_GetMemberDetails', { regno });
  const AllMemberDetailsReturns = r ? mapRow(r, MEMBER_DETAILS_PROPS) : null;
  if (AllMemberDetailsReturns === null) return res.type('application/json').send(''); // Json(null) writes an empty body
  return res.json(AllMemberDetailsReturns);
}));

module.exports = router;
