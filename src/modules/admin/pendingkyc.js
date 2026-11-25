'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Pendingkyc.cs (class PendingkycController => /admin/Pendingkyc/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, tab, cellStr, writeXlsExport, excelLink, inlinePerms, outIntOf, nullRef, col,
} = require('./_shared/batch11-common');

const router = express.Router();
const C = 'Pendingkyc';

// PORT-NOTE: `private static string url, url1` are static (shared by all requests), kept as module variables.
let url = '';
let url1 = '';

/** class Pendingkyc_list */
const PENDINGKYC_PROPS = ['ROWNUMBER', 'REGNO', 'NAME', 'MOBILE', 'EMAILID', 'IsFirstTimeOrAfterRejection', 'KYCDATE', 'LASTUPDATEDDATEBYUSER',
  'PROFILESTATUS', 'KYCSTATUS', 'ISIDPROOF', 'ISPHOTOGRAPH', 'ISPANCARDDETAILS', 'ISBANKPASSBOOK', 'PHOTOGRAPH', 'IDPROOF', 'PANCARDDETAILS',
  'BANKPASSBOOK', 'IDPROOFisKYCactive', 'PHOTOGRAPHisKYCactive', 'PANCARDisKYCactive', 'BANKisKYCactive', 'IDPROOFisKYCNAME',
  'PHOTOGRAPHisKYCNAME', 'PANCARDisKYCNAME', 'BANKisKYCNAME', 'BACKIDPROOF', 'BACKIDPROOFACTIVES', 'BACKIDKYCNAME', 'BACKIDPROOIMG',
  'MemberName', 'BANKNAME', 'BRANCHNAME', 'ACCOUNTNO', 'AcHolderName', 'IFSCCODE', 'PANNO', 'DOB', 'IdType', 'IdRefNo'];

/** USP_PENDINGKYC (21 args, @RECORDCOUNT out) */
function uspPendingKyc(page, MaxRows, f) {
  return db.proc(DB, 'USP_PENDINGKYC', {
    STARTROWINDEX: page, MAXROWS: MaxRows, NAME: f.UserName, MOBILE: f.Mobile, EMAIL: f.EmailID, FREEORPAID: '-1',
    FROMDATE: f.RejApprfromDate, TODATE: f.RejApprtoDate, SUBMITTEDFROMDATE: f.SubmittedfromDate, SUBMITTEDTODATE: f.SubmittedtoDate,
    ORDERBY: f.ORDERBY, IsFirstTimeOrAfterRejectionParam: f.SelectType, LASTUPDATEDDATEBYUSERFROMDATE: f.fromDate,
    LASTUPDATEDDATEBYUSERTODATE: f.toDate, PROFILESTATUSParam: f.Status, KYCSTATUSParam: f.KYCStatus, MODE: f.mode, INDEX: 0, REGNUM: 0,
    BUSINESSKYCSTATUS: -1,
  });
}

/** the "if (X == null) X = default" block shared by Index and DownloadExcelForBulkApproval */
function defaults(f) {
  if (f.ORDERBY === null) f.ORDERBY = 'desc';
  if (f.UserName === null) f.UserName = '';
  if (f.EmailID === null) f.EmailID = '';
  if (f.Mobile === null) f.Mobile = '';
  if (f.KYCStatus === null) f.KYCStatus = '2';
  if (f.SelectType === null) f.SelectType = '0';
  if (f.Status === null) f.Status = '2';
  if (f.fromDate === null) f.fromDate = '';
  if (f.UserType === null) f.UserType = '-1';
  if (f.SubmittedtoDate === null) f.SubmittedtoDate = '';
  if (f.RejApprfromDate === null) f.RejApprfromDate = '';
  if (f.toDate === null) f.toDate = '';
  if (f.SubmittedfromDate === null) f.SubmittedfromDate = '';
  if (f.RejApprtoDate === null) f.RejApprtoDate = '';
  return f;
}

const FIELDS = ['UserName', 'EmailID', 'Mobile', 'ORDERBY', 'KYCStatus', 'UserType', 'Status', 'SelectType', 'SubmittedfromDate',
  'SubmittedtoDate', 'RejApprfromDate', 'RejApprtoDate', 'fromDate', 'toDate'];
function readFields(req) {
  const f = {};
  for (const k of FIELDS) f[k] = nStr(req.p[k]);
  f.mode = nInt(req.p.mode);
  return f;
}

const isTrue = (v) => v === true || v === 1 || v === 't' || String(v).toLowerCase() === 'true';

/** public void DownloadExcelForBulkApproval(... , int? mode, int? page) */
async function DownloadExcelForBulkApproval(req, res, f, page, ViewBag) {
  const MaxRows = 5000;
  defaults(f);
  const rows = await uspPendingKyc(page, MaxRows, f); // db.CommandTimeout = 1000 (outside the try, like legacy)
  const Obj = mapRows(rows, PENDINGKYC_PROPS);
  try {
    if (Obj.length > 0) {
      return await writeXlsExport({
        req, res, sheet: 'pendingkyc.xls', rows: Obj, ViewBag,
        headers: ['S.No.', 'Username', 'Name', 'Mobile', 'Email ID', 'Last Update by Member', 'Current KYC Status', 'ID Front', 'ID Back',
          'Pan Card', 'Bank', 'KYC'],
        // per-row catch had an empty ErrorInsert region (just wr.Close()), the outer catch only set ViewBag.filepath
        cells: (item, w) => {
          w('\n');
          w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
          w(tab(cellStr(item, 'MemberName')) + ' \t');
          w(tab(cellStr(item, 'NAME')) + ' \t');
          w(tab(cellStr(item, 'MOBILE')) + ' \t');
          w(tab(cellStr(item, 'EMAILID')) + ' \t');
          w(tab(cellStr(item, 'LASTUPDATEDDATEBYUSER')) + ' \t');
          w(tab(cellStr(item, 'KYCSTATUS')) + ' \t');
          if (isTrue(col(item, 'PHOTOGRAPHisKYCactive'))) w(tab(cellStr(item, 'ISPHOTOGRAPH')) + ' \t');
          if (isTrue(col(item, 'IDPROOFisKYCactive'))) w(tab(cellStr(item, 'ISIDPROOF')) + ' \t');
          if (isTrue(col(item, 'BACKIDPROOFACTIVES'))) w(tab(cellStr(item, 'BACKIDPROOF')) + ' \t');
          if (isTrue(col(item, 'PANCARDisKYCactive'))) w(tab(cellStr(item, 'ISPANCARDDETAILS')) + ' \t');
          if (isTrue(col(item, 'BANKisKYCactive'))) w(tab(cellStr(item, 'ISBANKPASSBOOK')) + ' \t');
          w(tab(cellStr(item, 'KYCSTATUS')) + ' \t');
        },
      });
    }
    ViewBag.Message = 'There is no record in excel';
    return { sent: false };
  } catch (ExpObj) {
    if (res.headersSent) return { sent: true };
    ViewBag.filepath = ExpObj.message;
    return { sent: false };
  }
}

/** Request.QueryString["status"] (case-insensitive key) */
function queryStatus(req) {
  const k = Object.keys(req.query || {}).find((x) => x.toLowerCase() === 'status');
  const v = k === undefined ? undefined : req.query[k];
  if (v === undefined || v === null) throw nullRef(); // .ToString() on null
  return Array.isArray(v) ? v.join(',') : String(v);
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string UserName, ... , int? mode, int? page, string Excel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/pandingkyc" -> Pendingkyc/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/pandingkyc'], adminAuth, asyncHandler(async (req, res) => {
  const url2 = req.originalUrl || ''; // Request.Url.AbsoluteUri (path + query)
  url1 = legacyUrl(req).slice(1);
  if (url2.includes('status')) {
    const lastindex = url1.lastIndexOf('/');
    url1 = url1.substring(0, lastindex);
  }
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const out = {};
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  const f = readFields(req);
  if (url2.includes('status')) {
    const ID = queryStatus(req);
    f.KYCStatus = ID;
    ViewBag.val = f.KYCStatus;
    f.Status = '2';
  }
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let Excel = nStr(req.p.Excel);
  if (Excel === null) Excel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  defaults(f);
  if (f.mode === null) f.mode = 0;
  // Update Session "Admin_User_Menu" and "Admin_User"
  const Empid = req.user.emp_id;
  sessionStore.set(req, 'Admin_User_Menu', await UtilityClass.UpdateAdminMenu(Empid));
  const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
  if (emp) out.token = issueAdminToken(emp);
  const MaxRows = Number(dynamicpagging);
  let page = nInt(req.p.page);
  if (page === null) page = 1;
  const rows = await uspPendingKyc(page, MaxRows, f);
  const PendingkycList = mapRows(rows, PENDINGKYC_PROPS);
  const TotalRecord = outIntOf(rows, 'RECORDCOUNT');
  ViewBag.QUALIFICATIONlis = '';
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = '';
  ViewBag.SearchValue = '';
  ViewBag.fromDate = f.fromDate;
  ViewBag.toDate = f.toDate;
  ViewBag.UserName = f.UserName;
  ViewBag.Mobile = f.Mobile;
  ViewBag.UserType = f.UserType;
  ViewBag.EmailID = f.EmailID;
  ViewBag.SubmittedfromDate = f.SubmittedfromDate;
  ViewBag.SubmittedtoDate = f.SubmittedtoDate;
  ViewBag.RejApprfromDate = f.RejApprfromDate;
  ViewBag.RejApprtoDate = f.RejApprtoDate;
  ViewBag.ORDERBY = f.ORDERBY;
  ViewBag.Status = f.Status;
  ViewBag.KYCStatus = f.KYCStatus;
  if (Excel !== '') {
    const r = await DownloadExcelForBulkApproval(req, res, { ...f }, page, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Pendingkyc/Index.cshtml', Model: PendingkycList, ...ViewBag, ...out });
}));

// ---------------------------------------------------------------- public void DownloadExcelForBulkApproval(...)
// auth (PORT-NOTE: legacy public action had no session check; it exports member KYC data => adminAuth)
router.all(`/admin/${C}/DownloadExcelForBulkApproval{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await DownloadExcelForBulkApproval(req, res, readFields(req), nInt(req.p.page), {});
  if (!r.sent) res.send(''); // void action
}));

module.exports = router;
