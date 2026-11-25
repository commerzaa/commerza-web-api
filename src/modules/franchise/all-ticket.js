'use strict';
// Ported from Franchise\Controllers\All_Ticket.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const str = (v) => (v === undefined || v === null ? '' : String(v));
const outv = (rows, name) => (rows && rows.length && rows[0][name.toLowerCase()] !== undefined ? rows[0][name.toLowerCase()] : null);
const toPage = (v) => (v === undefined || v === null || v === '' ? 1 : parseInt(v, 10));

const P = '/franchise/All_Ticket';
const ALLTICKET = ['TMID', 'rowNumber', 'message', 'ticketno', 'categoryname', 'lastupdate', 'date', 'subject', 'status', 'name', 'PHONE', 'fulllastUpdate', 'lastAdminReply', 'username', 'FromRegNo'];

// ExportReport: writes tab separated "allticket.xls" under the web root (config.uploadDir); returns dt.Rows.Count (ViewBag.ExcelData) or undefined on failure
async function ExportReport(SearchField, SearchValue, fromDate, toDate, ddlPlan) {
  let ExcelData;
  try {
    // DataUtility.GetDataTableSP(param, "getSupportListFromAdmin")
    const dt = await db.proc('shopping', 'getsupportlistfromadmin', {
      minindex: 1, maxindex: 1000000000, regno: 0, alert: 0, cat: 0, sta: 0, stname: '', uid: 0, orderby: '',
      searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    });
    ExcelData = String(dt.length);
    const filepath = path.join(config.uploadDir, 'allticket.xls');
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    if (dt.length > 0) {
      const t = (v) => str(v).replace(/\t/g, '    ');
      let out = '';
      out += 'Sr No \t';
      out += 'Date (Desc) \t';
      out += 'Ticket No \t';
      out += 'Username(ID) \t';
      out += 'Category \t';
      out += 'Subject\t';
      out += 'Message\t';
      out += 'Reply Date\t';
      out += 'Status \t';
      for (let i = 0; i < dt.length; i++) {
        const r = dt[i];
        out += '\n';
        out += t(r.rownumber) + ' \t';
        out += t(r.date) + ' \t';
        out += t(r.ticketno) + ' \t';
        out += t(r.name) + ' \t';
        out += t(r.categoryname) + ' \t';
        out += t(r.subject) + ' \t';
        out += t(r.message) + ' \t';
        out += t(r.fulllastupdate) + ' \t';
        out += t(r.status) + ' \t';
      }
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, out);
    }
  } catch (ex) { /* swallowed in legacy */ }
  return ExcelData;
}

async function Index(req, res) {
  // Session["Plid"] == null -> auth middleware
  let { SearchField, SearchValue, fromDate, toDate, ddlPlan, status } = req.p;
  let page = req.p.page;
  let ddlcustpage = req.p.ddlcustpage;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (ddlPlan == null) ddlPlan = '';
  ddlcustpage = (ddlcustpage === undefined || ddlcustpage === null || ddlcustpage === '') ? 50 : parseInt(ddlcustpage, 10);
  if (status == null) status = '0';
  const MaxRows = ddlcustpage;
  page = toPage(page);
  const rows = await db.proc('shopping', 'usp_all_ticket', {
    fromdate: fromDate, todate: toDate, status, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    startrowindex: page, maxrows: MaxRows, fromplid: '', accounttype: '1', did: String(req.user.did),
  });
  const AllAgetnList = mapRows(rows, ALLTICKET);
  const rc = outv(rows, 'recordcount');
  const TotalRecord = str(rc) === '' ? 0 : parseInt(rc, 10);
  const ExcelData = await ExportReport(SearchField, SearchValue, fromDate, toDate, ddlPlan);
  res.json({
    Model: AllAgetnList, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate, status, ddlPlan,
    ddlcustpage, ExcelData,
  });
}
// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/All-Ticket
router.all('/franchise/franchisee/All-Ticket{/:id}', auth, asyncHandler(Index));

// auth  (void action => EmptyResult)
router.all(P + '/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const { SearchField, SearchValue, fromDate, toDate, ddlPlan } = req.p;
  // legacy: SearchField.Trim() on null throws inside the try (swallowed)
  await ExportReport(SearchField === undefined ? null : SearchField, SearchValue === undefined ? null : SearchValue, fromDate, toDate, ddlPlan);
  res.status(200).end();
}));

module.exports = router;
