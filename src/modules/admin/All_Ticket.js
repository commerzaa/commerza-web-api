'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_Ticket.cs (class All_TicketController => /All_Ticket/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toStr, tab, nowStamp, excelLink, pagePermissions, tsvExport } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'All_Ticket';

/** class AllTicket */
const PROPS = ['rowNumber', 'message', 'ticketno', 'categoryname', 'lastupdate', 'date', 'subject', 'status', 'name', 'PHONE',
  'fulllastUpdate', 'lastAdminReply', 'username', 'ISREADADMIN', 'ISREADMEM'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public void ExportReport(SearchField, SearchValue, fromDate, toDate, ddlPlan, status) => true when the download was sent */
async function ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, ddlPlan, status) {
  const userid = req.user.emp_id;
  const Filename = `All_Ticket_${userid}_${nowStamp()}`;
  try {
    if (SearchField === null || SearchValue === null) throw new Error('Object reference not set to an instance of an object.');
    // USP_ALLTICKET (9 params here, no @orderbydate)
    const AllAgetnList = mapRows(await db.proc(DB, 'USP_ALLTICKET', {
      FROMDATE: fromDate, TODATE: toDate, STATUS: status, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
      STARTROWINDEX: 1, MAXROWS: 999999, FROMPLID: '',
    }), PROPS);
    if (AllAgetnList.length > 0) {
      return await tsvExport({
        req, res, sheet: 'All_Ticket_List.xls', filename: Filename, rows: AllAgetnList, innerProc: 'AllEPinRequestsList', outerProc: 'ExportReport',
        headers: ['Sr No \t', 'Date (Desc) \t', 'Ticket No \t', 'Username(ID) \t', 'Mobile \t', 'Category \t', 'Subject\t', 'Message\t', 'Reply Date\t', 'Status \t'],
        cells: (item, w) => {
          for (const k of ['rowNumber', 'date', 'ticketno', 'name', 'PHONE', 'categoryname', 'subject', 'message', 'fulllastUpdate', 'status']) {
            w(tab(toStr(item[k])) + ' \t');
          }
        },
      });
    }
  } catch (ExpObj) {
    if (res.headersSent) return true;
    await errorInsert(req, ExpObj, 'ExportReport');
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan, int? page, int? ddlcustpage, string status, string btnexel)
// auth
// route-config: "AdminPanel/All-Ticket" -> All_Ticket/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/All-Ticket'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromDate = sv(req.p.fromDate);
  let toDate = sv(req.p.toDate);
  let ddlPlan = sv(req.p.ddlPlan);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let status = sv(req.p.status);
  let btnexel = sv(req.p.btnexel);
  const ViewBag = {};

  const url2 = req.originalUrl; // Request.Url.AbsoluteUri (path + query)
  url1 = legacyUrl(req).slice(1);
  if (url2.includes('status')) {
    const lastindex = url1.lastIndexOf('/');
    url1 = url1.substring(0, lastindex);
  }
  url = '~' + url1;
  if (SearchField === null) SearchField = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  if (toDate === null) toDate = '';
  if (ddlPlan === null) ddlPlan = '';
  if (ddlcustpage === null) ddlcustpage = 50;
  if (status === null) status = '0';
  ViewBag.excelactive = await excelLink(url);
  const Employeeid = req.user.emp_id;
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;

  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_ALLTICKET', {
    FROMDATE: fromDate, TODATE: toDate, STATUS: status, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    STARTROWINDEX: page, MAXROWS: MaxRows, FROMPLID: '', orderbydate,
  });
  const AllAgetnList = mapRows(rows, PROPS);
  const rc = str(col(rows[0], 'recordcount'));
  const TotalRecord = rc === '' ? 0 : parseInt(rc, 10);
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.status = status;
  ViewBag.ddlPlan = ddlPlan;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, ddlPlan, status)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/All_Ticket/Index.cshtml', Model: AllAgetnList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan, string status)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.fromDate), sv(req.p.toDate),
    sv(req.p.ddlPlan), sv(req.p.status));
  if (!sent) res.send(''); // void action => empty response
}));

module.exports = router;
