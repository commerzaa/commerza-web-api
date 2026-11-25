'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberLoginLog.cs (class MemberLoginLogController, no namespace => /MemberLoginLog/...)
// The row class is AdminLoginLog (declared in AdminLoginLog.cs)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  LOG_PROPS, pagePermissions, excelLink, netFormatLoginDate, toNullableInt, exportTsv, col, tab,
} = require('./_shared/loginLogCommon');

const router = express.Router();
const DB = 'affiliate';
const C = 'MemberLoginLog';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

const toInt16 = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10));

async function ExportReport(req, res, fromdate, todate, SearchField, SearchValue) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  return exportTsv({
    req, res, userid, url, prefix: 'MemberLoginLog', procName: 'USP_MemberLOGINLOG_Details', fromdate, todate, SearchField, SearchValue,
    headers: ['S.No.', 'User Name', 'Email', 'IP Address', 'Country Name', 'State', 'DATE', 'Mobile', 'Password Attempt'],
    cells: async (item, w) => {
      const n = (k) => { const v = col(item, k); if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return v.toString(); };
      w(tab(n('ROWNUMBER')) + ' 	');
      w(tab(n('EMP_NAME')) + ' 	');
      w(tab(n('EMAIL')) + ' 	');
      w(tab(n('IPADDRESS')) + ' 	');
      w(tab(n('COUNTRY_NAME')) + ' 	');
      w(tab(n('STATE')) + ' 	');
      w(tab(netFormatLoginDate(col(item, 'LOGINDATETIME'))) + ' 	');
      w(tab(n('MOBILE')) + ' 	');
      // SECURITY NOTE (legacy behaviour kept): the export contains the DECRYPTED password attempts of members.
      const passs = String(await UtilityClass.Decryptword(col(item, 'PASSWORDATTEMPT')));
      w(tab(passs) + ' 	');
    },
  });
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/MemberLoginLog" -> MemberLoginLog/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MemberLoginLog'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = toNullableInt(req.p.dynamicpagging);
  let orderbydate = req.p.orderbydate === undefined || req.p.orderbydate === '' ? null : req.p.orderbydate;
  let SearchField = req.p.SearchField === undefined || req.p.SearchField === '' ? null : req.p.SearchField;
  let btnexel = req.p.btnexel === undefined || req.p.btnexel === '' ? null : req.p.btnexel;
  let SearchValue = req.p.SearchValue === undefined || req.p.SearchValue === '' ? null : req.p.SearchValue;
  let fromdate = req.p.fromdate === undefined || req.p.fromdate === '' ? null : req.p.fromdate;
  let todate = req.p.todate === undefined || req.p.todate === '' ? null : req.p.todate;
  let page = toNullableInt(req.p.page);
  let ddlcustpage = toNullableInt(req.p.ddlcustpage);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) {
    dynamicpagging = toInt16(config.app.DynamicPagging);
  }
  if (orderbydate === null) orderbydate = '';
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  // (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin") is handled by adminAuth)
  ViewBag.excelactive = await excelLink(url);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (btnexel === null) btnexel = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_MemberLOGINLOG_Details', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: String(SearchField).trim(),
      SEARCHVALUE: String(SearchValue).trim(), orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, LOG_PROPS);
    const tc = col(rows[0], 'totalcount');
    const TotalRecord = parseInt(tc === null || tc === undefined || tc === '' ? '0' : String(tc), 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, fromdate, todate, SearchField, SearchValue);
      if (r.sent) return undefined;
      Object.assign(ViewBag, r.ViewBag);
    }
    return res.json({ view: '~/Views/AdminPanel/MemberLoginLog/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ex) {
    if (res.headersSent) return undefined;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => (req.p[k] === undefined || req.p[k] === '' ? null : req.p[k]);
  // SearchField.Trim() / SearchValue.Trim() on null => NullReferenceException in legacy
  if (v('SearchField') === null || v('SearchValue') === null) throw new Error('Object reference not set to an instance of an object.');
  const r = await ExportReport(req, res, v('fromdate'), v('todate'), v('SearchField'), v('SearchValue'));
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult BindAllDetailsByLogId(int LogId)
// auth (legacy had no session check, but it returns member login-log details => admin only)
router.all(`/admin/${C}/BindAllDetailsByLogId{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const LogId = toNullableInt(req.p.LogId);
  if (LogId === null) {
    return res.status(500).json({ message: "The parameters dictionary contains a null entry for parameter 'LogId' of non-nullable type 'System.Int32'" });
  }
  const DetialsByUsername = mapRows(await db.proc(DB, 'USP_GET_ALLDETAILSBYLOGID', { LogId }), LOG_PROPS);
  return res.json(DetialsByUsername);
}));

module.exports = router;
