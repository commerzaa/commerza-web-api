'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Alert_Ticket.cs (class Alert_TicketController)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nint, nstr, nre, toInt32, outStr, col, view, tab, mapRows } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Alert_Ticket';

/** class AlertTicket */
const ALERTTICKET_PROPS = ['rowNumber', 'date', 'ticketno', 'name', 'categoryname', 'subject', 'message', 'lastupdate', 'status', 'ticketurl',
  'lastAdminReply', 'fulllastUpdate'];

// private double UD;  (instance field, never assigned => 0)
const UD = 0;

/** DataRow[x].ToString(): DBNull => "", DateTime => default format */
const dr = (row, k) => {
  const v = col(row, k);
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return require('./_shared/batch02-common').netDateStr(v);
  return String(v);
};

// public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan)
async function ExportReport(req, SearchField, SearchValue, fromDate, toDate, ddlPlan, ViewBag) {
  try {
    if (SearchField === null || SearchValue === null) throw nre();
    // DataUtility.GetDataTableSP(param, "getSupportListFromAdmin")
    const dt = await db.proc(DB, 'getSupportListFromAdmin', {
      minindex: 1, maxindex: 1000000000, regNo: 0, alert: 1, cat: 0, sta: 0, stname: '', uid: toInt32(UD), orderby: '',
      SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    });
    ViewBag.ExcelData = String(dt.length);
    const filepath = path.join(config.uploadDir, 'alertticket.xls'); // HostingEnvironment.MapPath("~/alertticket.xls")
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    if (dt.length > 0) {
      let out = 'Sr No \tDate (Desc) \tTicket No \tUsername(ID) \tCategory \tSubject\tMessage\tReply Date\tStatus \t';
      for (let i = 0; i < dt.length; i++) {
        out += '\n';
        for (const k of ['rowNumber', 'date', 'ticketno', 'name', 'categoryname', 'subject', 'message', 'fulllastUpdate', 'status']) {
          out += tab(dr(dt[i], k)) + ' \t';
        }
      }
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, out); // written to disk only (no download in legacy)
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'ExportReport');
  }
}

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  let ddlPlan = nstr(req.p.ddlPlan);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ddlPlan === null) ddlPlan = '';
  if (ddlcustpage === null) ddlcustpage = 50;
  try {
    const MaxRows = toInt32(ddlcustpage);
    if (page === null) page = 1;
    const UDl = 0; // int UD = 0 (local)
    const rows = await db.proc(DB, 'getSupportListFromAdmin', {
      minindex: page, maxindex: MaxRows, regNo: 0, alert: 1, cat: 0, sta: 0, stname: '', uid: UDl, orderby: '',
      SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    });
    const AllAgetnList = mapRows(rows, ALERTTICKET_PROPS);
    const TotalRecord = toInt32(outStr(col(rows[0], 'totalcount')) || 'x'); // int.Parse(DBNull => "") => FormatException => catch
    const ViewBag = {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue,
      fromDate, toDate, ddlPlan, ddlcustpage,
    };
    await ExportReport(req, SearchField, SearchValue, fromDate, toDate, ddlPlan, ViewBag); // always called (legacy)
    return view(res, '~/Views/AdminPanel/Alert_Ticket/Index.cshtml', AllAgetnList, ViewBag);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'getSupportListFromAdmin');
    return view(res, '~/Views/PageNotFound/Index.cshtml');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; writes a server file => adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, nstr(req.p.SearchField), nstr(req.p.SearchValue), nstr(req.p.fromDate), nstr(req.p.toDate), nstr(req.p.ddlPlan), {});
  res.send('');
}));

module.exports = router;
