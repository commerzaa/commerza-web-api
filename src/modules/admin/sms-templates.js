'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SMS_Templates.cs (class SMS_TemplatesController, no namespace => /admin/SMS_Templates/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_SMSTEMPLATEMASTER, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, col, str, nowStamp, excelHistory, writeXlsExport, cellStr, tab, excelLink, inlinePerms, outOf,
} = require('./_shared/batch11-common');

const router = express.Router();
const C = 'SMS_Templates';
const VIEW = '~/Views/AdminPanel/SMS_Templates/Index.cshtml';

/** public class SmsTemplates */
const SMS_TEMPLATES_PROPS = ['STID', 'TITLE', 'MESSAGE', 'UPDATEDON', 'UPDATEDBY', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate)
async function ExportReport(req, res, ViewBag, fromDate, toDate) {
  const userid = req.user.emp_id;
  const Filename = 'SMS Templates' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  // [USP_SMSTEMPLATEMASTER] @MODE,@TEMPLATETITLE,@SMS,@UPDATEDBY,@STID,@STATUS,@STRRESULT OUT,@FROMDATE,@TODATE,@STARTROWINDEX,@MAXROWS
  const _ObjFlyerManagement = mapRows(await db.proc(DB, 'USP_SMSTEMPLATEMASTER', {
    MODE: 1, TEMPLATETITLE: '', SMS: '', UPDATEDBY: 0, STID: 0, STATUS: 1, FROMDATE: fromDate, TODATE: toDate, STARTROWINDEX: 1, MAXROWS: 999999,
  }), SMS_TEMPLATES_PROPS);
  if (_ObjFlyerManagement.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'SMS Templates.xls', downloadName: ' SMS Templates.xls', Filename, ViewBag, rows: _ObjFlyerManagement,
      rawHeaders: 'S.No. \tTemplate Name\tMessage \tDate \t', // "Template Name\t" had no space in the legacy header
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        for (const k of ['STID', 'TITLE', 'MESSAGE', 'UPDATEDON']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string fromDate, string toDate, int? page, int? ddlcustpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/SMS-Templates" -> SMS_Templates/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/SMS-Templates'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const ip = await inlinePerms(Employeeid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  // USP_EXCEL_LINK @url,@ISACTIVE out
  ViewBag.excelactive = await excelLink(url);
  const MaxRows = Number(ddlcustpage);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_SMSTEMPLATEMASTER', {
    MODE: 1, TEMPLATETITLE: '', SMS: '', UPDATEDBY: 0, STID: 0, STATUS: 1, FROMDATE: fromDate, TODATE: toDate, STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  const _ObjFlyerManagement = mapRows(rows, SMS_TEMPLATES_PROPS);
  ViewBag.message = outOf(rows, 'STRRESULT');
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromDate, toDate);
    if (r.sent) return undefined;
  }
  return res.json({ view: VIEW, Model: _ObjFlyerManagement, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.fromDate), nStr(req.p.toDate));
  if (!r.sent && !res.headersSent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult addTemplate(string Massage, string tname)
// auth (PORT-NOTE: legacy had no session check; admin settings => adminAuth)
router.all(`/admin/${C}/addTemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Massage = nStr(req.p.Massage);
  const tname = nStr(req.p.tname);
  // [USP_SMSTEMPLATEMASTER] @MODE,@TEMPLATETITLE,@SMS,@UPDATEDBY,@STID,@STATUS,@STRRESULT OUT
  const row = await db.procOne(DB, 'USP_SMSTEMPLATEMASTER', { MODE: 3, TEMPLATETITLE: tname, SMS: Massage, UPDATEDBY: 0, STID: 0, STATUS: 1 });
  const result = str(col(row, 'STRRESULT'));
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult updateTemplate(string Massage, string tname, int Tid)
// auth (PORT-NOTE: legacy had no session check; admin settings => adminAuth)
router.all(`/admin/${C}/updateTemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Massage = nStr(req.p.Massage);
  const tname = nStr(req.p.tname);
  const Tid = reqInt(req.p.Tid, 'Tid');
  const row = await db.procOne(DB, 'USP_SMSTEMPLATEMASTER', { MODE: 2, TEMPLATETITLE: tname, SMS: Massage, UPDATEDBY: 0, STID: Tid, STATUS: 1 });
  const result = str(col(row, 'STRRESULT'));
  return res.json(result);
}));

module.exports = router;
