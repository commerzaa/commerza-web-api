'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\StockistNotification.cs (class StockistNotificationController, no namespace => /admin/StockistNotification/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_StockistNotification, USP_EXCEL_DOWNLOAD_HISTORY.
// Config: DynamicPagging
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, str, cvtInt, nowStamp, excelHistory, writeXlsExport, cellStr, tab, excelLink, inlinePerms, trimS,
} = require('./_shared/batch11-common');

const router = express.Router();
const C = 'StockistNotification';

/** public class StockistNotification */
const STOCKIST_NOTIFICATION_PROPS = ['RowNumber', 'PackageName', 'PrCode', 'StockistCode', 'STATE', 'CITY', 'PINCODE', 'AVAILABLE', 'ATTRIBUTE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(string StockistCode, string packageName, string PrCode)
async function ExportReport(req, res, ViewBag, StockistCode, packageName, PrCode) {
  const userid = req.user.emp_id;
  const Filename = 'StockistNotification_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // [USP_StockistNotification] @STARTROWINDEX,@MAXROWS,@StockistCode,@PackageName,@PrCode,@TOTALCOUNT OUT
  const Obj = mapRows(await db.proc(DB, 'USP_StockistNotification', {
    STARTROWINDEX: 1, MAXROWS: 999999, StockistCode: trimS(StockistCode), PackageName: packageName, PrCode: trimS(PrCode),
  }), STOCKIST_NOTIFICATION_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'StockistNotification.xls', Filename, ViewBag, rows: Obj,
      headers: ['S.No.', 'Product Name', 'stockist Code', 'STATE', 'CITY', 'PINCODE', 'AVAILABLE'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['RowNumber', 'PackageName', 'StockistCode', 'STATE', 'CITY', 'PINCODE', 'AVAILABLE']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, int? page, string packageName, string btnexel, string PrCode,
//   int? ddlmaxrow, string StockistCode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/StockistNotification" -> StockistNotification/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/StockistNotification'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let page = nInt(req.p.page);
  let packageName = nStr(req.p.packageName);
  let btnexel = nStr(req.p.btnexel);
  let PrCode = nStr(req.p.PrCode);
  let ddlmaxrow = nInt(req.p.ddlmaxrow);
  let StockistCode = nStr(req.p.StockistCode);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = cvtInt(value === undefined ? null : value); // Convert.ToInt16(string)
  }
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const ip = await inlinePerms(Employeeid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  if (PrCode === null) PrCode = '';
  if (packageName === null) packageName = '';
  if (ddlmaxrow === null) ddlmaxrow = 100;
  if (StockistCode === null) StockistCode = '';
  const MaxRows = Number(dynamicpagging); // eslint-disable-line no-unused-vars
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_StockistNotification', {
    STARTROWINDEX: page, MAXROWS: ddlmaxrow, StockistCode: StockistCode.trim(), PackageName: packageName, PrCode: PrCode.trim(),
  });
  const Obj = mapRows(rows, STOCKIST_NOTIFICATION_PROPS);
  const tc = str(col(rows[0], 'TOTALCOUNT'));
  const TotalRecord = cvtInt(tc === '' ? '0' : tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlmaxrow;
  ViewBag.packageName = packageName;
  ViewBag.Username = StockistCode;
  ViewBag.TotalRecord = TotalRecord; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, StockistCode, packageName, PrCode);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/StockistNotification/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string StockistCode, string packageName, string PrCode)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.StockistCode), nStr(req.p.packageName), nStr(req.p.PrCode));
  if (!r.sent && !res.headersSent) res.send(''); // void action => empty response
}));

module.exports = router;
