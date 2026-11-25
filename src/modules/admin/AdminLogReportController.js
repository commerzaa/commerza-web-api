'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\AdminLogReportController.cs (class AdminLogReportController; namespace commented out)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nint, nstr, nre, toInt32, outStr, col, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'AdminLogReport';

/** class AdminLog */
const ADMINLOG_PROPS = ['Employee', 'Date', 'SubMenu', 'MainMenu', 'EventType', 'ROWNUMBER', 'Remark'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// public void ExportReport(string Employee, string Fromdate, string Todate, string SubMenu, string EventType, string MainMenu)
async function ExportReport(req, res, Employee, Fromdate, Todate, SubMenu, EventType, MainMenu, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'AdminLog_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  for (const v of [Employee, Fromdate, Todate, SubMenu, EventType]) if (v === null) throw nre();
  const rows = await db.proc(DB, 'USP_ADMINlOG_REPORT', {
    StartRowIndex: 1, MaxRows: 9999999, Employee: Employee.trim(), FromDate: Fromdate.trim(), Todate: Todate.trim(), SubMain: SubMenu.trim(),
    EventType: EventType.trim(), Main_Menu: MainMenu,
  });
  const list = mapRows(rows, ADMINLOG_PROPS);
  if (list.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'AdminLog.xls', Filename,
      headers: ['S.No.', 'Employee', 'Date', 'Main Menu', 'Sub Menu', 'Event Type'],
      rows: list,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.Employee)) + ' \t');
        w(tab(cs(item.Date)) + ' \t');
        w(tab(cs(item.MainMenu)) + ' \t');
        w(tab(cs(item.SubMenu)) + ' \t');
        w(tab(cs(item.EventType)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string Employee, string Fromdate, string btnexel, string Todate, string MainMenu, string SubMenu, string EventType, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/AdminLogReport" -> AdminLogReport/Index
// Config: DynamicPagging
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/AdminLogReport'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let Employee = nstr(req.p.Employee);
  let Fromdate = nstr(req.p.Fromdate);
  let btnexel = nstr(req.p.btnexel);
  let Todate = nstr(req.p.Todate);
  let MainMenu = nstr(req.p.MainMenu);
  let SubMenu = nstr(req.p.SubMenu);
  let EventType = nstr(req.p.EventType);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = toInt32(value === undefined || value === '' ? null : value); // Convert.ToInt16(null) => 0
  }
  if (orderbydate === null) orderbydate = '';
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (Employee === null) Employee = '';
  if (btnexel === null) btnexel = '';
  if (Fromdate === null) Fromdate = '';
  if (Todate === null) Todate = '';
  if (MainMenu === null) MainMenu = '';
  if (SubMenu === null) SubMenu = '';
  if (EventType === null) EventType = '';
  const MaxRows = toInt32(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_ADMINlOG_REPORT', {
    StartRowIndex: page, MaxRows, Employee: Employee.trim(), FromDate: Fromdate.trim(), Todate: Todate.trim(), SubMain: SubMenu.trim(),
    EventType: EventType.trim(), Main_Menu: MainMenu, orderbydate,
  });
  const AllEPinRequestsList = mapRows(rows, ADMINLOG_PROPS);
  const tc = outStr(col(rows[0], 'totalcount'));
  ViewBag.CurrentPage = page;
  ViewBag.SubMenu = SubMenu;
  ViewBag.EventType = EventType;
  ViewBag.MainMenu = MainMenu;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, Employee, Fromdate, Todate, SubMenu, EventType, MainMenu, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/AdminLogReport/Index.cshtml', AllEPinRequestsList, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nstr(req.p[k]);
  const r = await ExportReport(req, res, v('Employee'), v('Fromdate'), v('Todate'), v('SubMenu'), v('EventType'), v('MainMenu'), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
