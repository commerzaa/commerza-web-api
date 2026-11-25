'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Kyc_Request.cs (class Kyc_RequestController => /admin/Kyc_Request/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');
const { qsGet } = require('./_shared/batch08-c-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Kyc_Request';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class KycRequest */
const KYC_REQUEST_PROPS = ['ROWNUMBER1', 'username', 'Loginid', 'NAME', 'mobile', 'kyc', 'PROCESSDATE', 'PHOTOSTATUS', 'IDSTATUS', 'PANSTATUS',
  'BANKSTATUS', 'PHOTO', 'IDIMAGE', 'PANIMAGE', 'BANKIMAGE', 'IdRefNo', 'IdType', 'DOB', 'PANNO', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME',
  'BRANCHNAME', 'IFSCCODE', 'regno', 'BulkID'];

/** DBO.USP_KYCREPORT @SEARCHVALUE,@SEARCHFIELD,@KYCSTATUS,@Active,@FROMDATE,@TODATE,@MAXROWS,@STARTROWINDEX,@TOTAL_COUNT OUT,@ORDER_BY */
async function kycReport(o) {
  return db.proc(DB, 'USP_KYCREPORT', {
    SEARCHVALUE: o.searchvalue, SEARCHFIELD: o.SEARCHFIELD, KYCSTATUS: o.kycstatus, Active: o.Memberstatus, FROMDATE: o.fromDate,
    TODATE: o.toDate, MAXROWS: o.MaxRows, STARTROWINDEX: o.page, ORDER_BY: o.ORDERBY,
  });
}

/** public void KYCActiveOrDeactive() - fills ViewBag.ActivePhoto/ActiveID/ActivePan/ActiveBank (or ViewBag.filepath on error) */
async function KYCActiveOrDeactive(req, ViewBag) {
  try {
    const rows = await db.proc(DB, 'usp_InsertMemberKYCImages', { Regno: 0, ImageName: '', Mode: 14 });
    const lstimage = rows[0]; // FirstOrDefault()
    if (!lstimage) throw B.nullRef();
    ViewBag.ActivePhoto = B.col(lstimage, 'Photo');
    ViewBag.ActiveID = B.col(lstimage, 'ID');
    ViewBag.ActivePan = B.col(lstimage, 'PANCARD');
    ViewBag.ActiveBank = B.col(lstimage, 'Bank');
  } catch (ex) {
    await errorInsert(req, ex, 'usp_InsertMemberKYCImages');
    ViewBag.filepath = ex.message;
  }
}

/** public void CheckBulkIDActive() - fills ViewBag.CheckActive (or ViewBag.filepath on error) */
async function CheckBulkIDActive(req, ViewBag) {
  let CheckBulkActive = 0;
  try {
    const rows = await db.proc(DB, 'usp_InsertMemberKYCImages', { Regno: '0', ImageName: '', Mode: 21 });
    // SqlQuery<int>(...).FirstOrDefault(): first column of the first row, 0 when there is no row
    if (rows.length) {
      const v = rows[0][Object.keys(rows[0])[0]];
      if (v === null || v === undefined) throw new Error('The specified cast from a materialized \'System.DBNull\' type to the \'System.Int32\' type is not valid.');
      CheckBulkActive = Number(v);
    }
    ViewBag.CheckActive = CheckBulkActive;
  } catch (ex) {
    await errorInsert(req, ex, 'usp_InsertMemberKYCImages');
    ViewBag.filepath = ex.message;
  }
}

/** Convert.ToInt32(object) on a ViewBag value (null => 0) */
const vbInt = (v) => (v === null || v === undefined ? 0 : B.cvtInt(typeof v === 'boolean' ? (v ? 1 : 0) : v));

/** public void ExportReport(int? dynamicpagging, string kycstatus, string Memberstatus, string SEARCHFIELD, string searchvalue, string ORDERBY, string fromDate, string toDate, int? mode, int? page) */
async function ExportReport(req, res, ViewBag, userid, a) {
  let { dynamicpagging, kycstatus, Memberstatus, SEARCHFIELD, searchvalue, ORDERBY, fromDate, toDate, mode, page } = a;
  // (the legacy method repeats this block of defaults twice)
  if (kycstatus === null) kycstatus = '-1';
  if (Memberstatus === null) Memberstatus = '-1';
  if (ORDERBY === null) ORDERBY = '';
  if (SEARCHFIELD === null) SEARCHFIELD = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (searchvalue === null) searchvalue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (mode === null) mode = 0; // eslint-disable-line no-unused-vars
  if (userid === null || userid === undefined) throw B.nullRef(); // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'KYCRequest' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const PendingkycList = mapRows(await kycReport({ searchvalue, SEARCHFIELD, kycstatus, Memberstatus, fromDate, toDate, MaxRows, page, ORDERBY }), KYC_REQUEST_PROPS);
  if (PendingkycList.length > 0) {
    let bulk;
    try { bulk = vbInt(ViewBag.CheckActive) === 1; } catch (e) { bulk = null; }
    const headers = ['S.No.', 'Process Date', 'Username', 'Name'];
    if (bulk) headers.push('Bulk Approval Remark');
    headers.push('Mobile', 'Photo', 'ID', 'PAN No.', 'Bank');
    let srno = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'KYCRequest.xls', Filename, downloadName: ' KYCRequest.xls', // header was "filename= KYCRequest.xls"
      headers,
      rows: PendingkycList,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(srno)) + ' \t');
        w(B.tab(B.cellStr(item, 'PROCESSDATE')) + ' \t');
        w(B.tab(B.cellStr(item, 'username')) + ' \t');
        w(B.tab(B.cellStr(item, 'NAME')) + ' \t');
        if (vbInt(ViewBag.CheckActive) === 1) w(B.tab(B.cellStr(item, 'BulkID')) + ' \t');
        w(B.tab(B.cellStr(item, 'mobile')) + ' \t');
        w(B.tab(B.cellStr(item, 'PHOTOSTATUS')) + ' \t');
        w(B.tab(B.cellStr(item, 'IDSTATUS')) + ' \t');
        w(B.tab(B.cellStr(item, 'PANSTATUS')) + ' \t');
        w(B.tab(B.cellStr(item, 'BANKSTATUS')) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

const exportArgs = (p) => ({
  dynamicpagging: B.nInt(p.dynamicpagging), kycstatus: B.nStr(p.kycstatus), Memberstatus: B.nStr(p.Memberstatus),
  SEARCHFIELD: B.nStr(p.SEARCHFIELD), searchvalue: B.nStr(p.searchvalue), ORDERBY: B.nStr(p.ORDERBY), fromDate: B.nStr(p.fromDate),
  toDate: B.nStr(p.toDate), mode: B.nInt(p.mode), page: B.nInt(p.page),
});

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string kycstatus, string Memberstatus, string SEARCHFIELD, string searchvalue, string ORDERBY, string fromDate, string toDate, int? mode, int? page, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/KycRequest" -> Kyc_Request/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/KycRequest'], adminAuth, asyncHandler(async (req, res) => {
  const a = exportArgs(req.p);
  let { dynamicpagging, kycstatus, Memberstatus, SEARCHFIELD, searchvalue, ORDERBY, fromDate, toDate, mode, page } = a;
  const btnexel = B.nStr(req.p.btnexel);
  const ViewBag = {};
  // Request.Url.AbsoluteUri (legacy path without our '/admin' mount prefix)
  const url2 = `${req.protocol}://${req.get('host')}${req.originalUrl.replace(/^\/admin(?=\/|$)/i, '')}`;
  url1 = legacyUrl(req).slice(1);
  if (url2.includes('status')) {
    const lastindex = url1.lastIndexOf('/');
    url1 = url1.substring(0, lastindex);
  }
  url = '~' + url1;
  if (url2.includes('status')) {
    const ID = qsGet(req, 'status'); // Request.QueryString["status"].ToString() (value unused)
    if (ID === undefined || ID === null) throw B.nullRef();
  }
  if (kycstatus === null) kycstatus = '-1';
  if (Memberstatus === null) Memberstatus = '-1';
  if (Memberstatus === '') Memberstatus = '-1';
  if (ORDERBY === null) ORDERBY = '';
  if (SEARCHFIELD === null) SEARCHFIELD = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (searchvalue === null) searchvalue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (mode === null) mode = 0;
  //*  Update Session "Admin_User_Menu" and "Admin_User" *//
  const Empid = req.user.emp_id;
  sessionStore.set(req, 'Admin_User_Menu', await UtilityClass.UpdateAdminMenu(Empid));
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const EM = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = ...
  const token = EM ? issueAdminToken(EM) : undefined; // refreshed session => refreshed token
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await kycReport({ searchvalue, SEARCHFIELD, kycstatus, Memberstatus, fromDate, toDate, MaxRows, page, ORDERBY });
  const PendingkycList = mapRows(rows, KYC_REQUEST_PROPS);
  // int.Parse(RECORDCOUNT.Value.ToString() == "" ? "0" : ...) (OUT param as a result column; no row => 0)
  const tc = rows.length ? B.outStr(rows[0], 'TOTAL_COUNT') : '';
  const TotalRecord = B.cvtInt(tc === '' ? '0' : tc);
  ViewBag.QUALIFICATIONlis = '';
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = '';
  ViewBag.SearchValue = '';
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.SEARCHFIELD = searchvalue;
  ViewBag.ORDERBY = ORDERBY;
  await KYCActiveOrDeactive(req, ViewBag);
  await CheckBulkIDActive(req, ViewBag);
  if (btnexel === 'Export Excel') {
    // Session["Admin_User"] now holds the refreshed employee (null when UpdateAdminUserSession found none => NRE)
    const r = await ExportReport(req, res, ViewBag, EM ? EM.Emp_ID : null,
      { dynamicpagging, kycstatus, Memberstatus, SEARCHFIELD, searchvalue, ORDERBY, fromDate, toDate, mode, page });
    if (r.sent) return undefined;
  }
  const out = { view: '~/Views/AdminPanel/Kyc_Request/Index.cshtml', Model: PendingkycList, ...ViewBag };
  if (token) out.token = token;
  return res.json(out);
}));

// ---------------------------------------------------------------- public void KYCActiveOrDeactive()
// public (public method => routable in legacy; no session check; result only lands in ViewBag => empty response)
router.all(`/admin/${C}/KYCActiveOrDeactive{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await KYCActiveOrDeactive(req, {});
  res.send('');
}));

// ---------------------------------------------------------------- public void CheckBulkIDActive()
// public (public method => routable in legacy; no session check; result only lands in ViewBag => empty response)
router.all(`/admin/${C}/CheckBulkIDActive{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await CheckBulkIDActive(req, {});
  res.send('');
}));

// ---------------------------------------------------------------- public void ExportReport(int? dynamicpagging, ...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // standalone call: ViewBag.CheckActive is null => Convert.ToInt32(null) == 0 (no "Bulk Approval Remark" column)
  const r = await ExportReport(req, res, {}, req.user.emp_id, exportArgs(req.p));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
