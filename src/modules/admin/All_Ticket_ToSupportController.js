'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_Ticket_ToSupportController.cs (class All_Ticket_ToSupportController => /All_Ticket_ToSupport/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { DB, col, str, sv, nint } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'All_Ticket_ToSupport';

/** class AllTicket111 (classes ParameterAPiRequest / RootObject are only used by commented-out code) */
const PROPS = ['ROWNUMBER', 'MESSAGE', 'TICKETNO', 'CATEGORYNAME', 'LASTUPDATE', 'DATE', 'SUBJECT', 'status', 'FULLLASTUPDATE', 'FULLDATE', 'TMID'];

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromDate, string toDate, string ddlPlan, int? page, int? ddlcustpage, string status)
// auth
// route-config: "AdminPanel/Ticket-List-Techinal-Support" -> All_Ticket_ToSupport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ticket-List-Techinal-Support'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromDate = sv(req.p.fromDate);
  let toDate = sv(req.p.toDate);
  let ddlPlan = sv(req.p.ddlPlan);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let status = sv(req.p.status);
  const ViewBag = {};
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ddlPlan === null) ddlPlan = '';
  if (ddlcustpage === null) ddlcustpage = 50;
  if (status === null) status = '0';
  let MaxRows = Number(ddlcustpage);
  // SELECT CONVERT(INT,LIMITS) AS CLIENTREGNO FROM SETTINGS WHERE CAPTION='CLIENTDETAILSFORTICKET' (value only used by commented-out API call)
  // eslint-disable-next-line no-unused-vars
  const CLIENTREGNO = await db.scalar(DB, "select (limits)::int as clientregno from settings where caption = 'CLIENTDETAILSFORTICKET' limit 1", {});
  if (page === null) page = 1;

  MaxRows = Number(ddlcustpage);
  // USP_ALLTICKET with 8 params (@FROMDATE/@TODATE passed as "")
  const rows = await db.proc(DB, 'USP_ALLTICKET', {
    FROMDATE: '', TODATE: '', STATUS: status, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  // eslint-disable-next-line no-unused-vars
  const AllAgetnList = mapRows(rows, PROPS);
  const rc = str(col(rows[0], 'recordcount'));
  const TotalRecord = rc === '' ? 0 : parseInt(rc, 10);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.ddlPlan = ddlPlan;
  ViewBag.ddlcustpage = ddlcustpage;
  // PORT-NOTE: legacy returned View(...) WITHOUT the model (the ticket list was queried but not passed) => Model: null.
  return res.json({ view: '~/Views/AdminPanel/All_Ticket_ToSupport/Index.cshtml', Model: null, ...ViewBag });
}));

module.exports = router;
