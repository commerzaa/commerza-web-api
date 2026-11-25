'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_Ticket.cs (class Member_TicketController => /Member_Ticket/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nInt, nStr, s0, outIntOf, trimS, col, str, tab } = require('./_shared/batch10-common');
const { writeXlsFile } = require('./_shared/batch10-a-common');

const router = express.Router();
const C = 'Member_Ticket';

/** class MemberTicket */
const PROPS = ['rowNumber', 'date', 'ticketno', 'name', 'username', 'categoryname', 'subject', 'message', 'lastupdate', 'status', 'ticketurl',
  'lastAdminReply', 'fulllastUpdate'];

// private double UD; (instance field, never assigned => 0)
const UD = 0;

// public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan)
async function ExportReport(req, SearchField, SearchValue, fromDate, toDate, ddlPlan, ViewBag) { // eslint-disable-line no-unused-vars
  try {
    const objdut = new DataUtility();
    const param = [
      DataUtility.SqlParameter('@minindex', 1),
      DataUtility.SqlParameter('@maxindex', 1000000000),
      DataUtility.SqlParameter('@cat', 0),
      DataUtility.SqlParameter('@sta', 0),
      DataUtility.SqlParameter('@stname', ''),
      DataUtility.SqlParameter('@uid', Math.round(UD)),
      DataUtility.SqlParameter('@orderby', ''),
      DataUtility.SqlParameter('@SearchField', trimS(SearchField)),
      DataUtility.SqlParameter('@SearchValue', trimS(SearchValue)),
    ];
    const dt = await objdut.GetDataTableSP(param, 'usp_memRepliedTickets');
    ViewBag.ExcelData = String(dt.length);
    // PORT-NOTE: legacy wrote ~/memberreplyticket.xls (site root) and never sent it to the client (no Response.Redirect); kept as a file write only.
    if (dt.length > 0) {
      await writeXlsFile({
        req, file: '~/memberreplyticket.xls',
        rawHeaders: 'Sr. No\tDate (Desc) \tTicket No \tUsername(ID) \tCategory \tSubject\tMessage\tReply Date\tStatus \t',
        rows: dt,
        cells: (r, w) => {
          w('\n');
          for (const k of ['rowNumber', 'date', 'ticketno', 'name', 'categoryname', 'subject', 'message', 'fulllastUpdate', 'status']) {
            const v = col(r, k);
            if (v === undefined) throw new Error(`Column '${k}' does not belong to table .`);
            w(tab(str(v)) + ' \t');
          }
        },
      });
    } else {
      // (File.Exists => delete) happens even when there are no rows
      const fs = require('fs');
      const { mapPath } = require('./_shared/batch10-common');
      const fp = mapPath('~/memberreplyticket.xls');
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'ExportReport');
  }
}

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const fromDate = s0(req.p.fromDate);
  const toDate = s0(req.p.toDate);
  const ddlPlan = s0(req.p.ddlPlan);
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 50;
  const MaxRows = ddlcustpage;
  let page = nInt(req.p.page); if (page === null) page = 1;
  const ud = 0; // int UD = 0;
  const rows = await db.proc(DB, 'usp_memRepliedTickets', {
    minindex: page, maxindex: MaxRows, cat: 0, sta: 0, stname: '', uid: ud, orderby: '', SearchField: SearchField.trim(),
    SearchValue: SearchValue.trim(),
  });
  const AllAgetnList = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue,
    fromDate, toDate, ddlPlan, ddlcustpage,
  };
  await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
  await ExportReport(req, SearchField, SearchValue, fromDate, toDate, ddlPlan, ViewBag);
  return res.json({ view: '~/Views/AdminPanel/Member_Ticket/Index.cshtml', Model: AllAgetnList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; admin data export)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.ddlPlan), {});
  res.send('');
}));

module.exports = router;
