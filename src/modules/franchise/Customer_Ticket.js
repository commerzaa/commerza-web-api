'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Customer_Ticket.cs. DB: 'shopping' */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const PROPS = ['rowNumber', 'message', 'ticketno', 'categoryname', 'lastupdate', 'date', 'subject', 'status', 'name', 'PHONE', 'fulllastUpdate', 'lastAdminReply', 'username'];
const col = (r, n) => { const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase()); if (k === undefined) throw new Error("Column '" + n + "' does not belong to table."); return r[k]; };

async function ExportReport(SearchField, SearchValue, fromDate, toDate, ddlPlan) {
  try {
    const dt = await proc(DB, 'getsupportlistfromadmin', {
      minindex: 1, maxindex: 1000000000, regno: 0, alert: 0, cat: 0, sta: 0, stname: '', uid: 0, orderby: '',
      searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    });
    const dir = path.join(config.uploadDir, 'Franchise');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'allticket.xls');
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    if (dt.length > 0) {
      const t = (v) => s(v).replace(/\t/g, '    ') + ' \t';
      let out = 'Sr No \tDate (Desc) \tTicket No \tUsername(ID) \tCategory \tSubject\tMessage\tReply Date\tStatus \t';
      for (const r of dt) {
        out += '\n' + t(col(r, 'rowNumber')) + t(col(r, 'date')) + t(col(r, 'ticketno')) + t(col(r, 'name')) + t(col(r, 'categoryname')) +
          t(col(r, 'subject')) + t(col(r, 'message')) + t(col(r, 'fulllastUpdate')) + t(col(r, 'status'));
      }
      fs.writeFileSync(filepath, out);
    }
    return String(dt.length);
  } catch (ex) { return undefined; }
}

// route-config: franchisee/Customer-Tickets
// auth
router.all(['/franchise/Customer_Ticket/Index{/:id}', '/franchise/franchisee/Customer-Tickets'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const SearchField = p.SearchField == null ? '' : s(p.SearchField);
  const SearchValue = p.SearchValue == null ? '' : s(p.SearchValue);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  const ddlPlan = p.ddlPlan == null ? '' : s(p.ddlPlan);
  const ddlcustpage = p.ddlcustpage == null || p.ddlcustpage === '' ? 50 : parseInt(p.ddlcustpage, 10);
  const status = p.status == null ? '0' : s(p.status);
  const category = p.category == null ? '0' : s(p.category);
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const MaxRows = ddlcustpage;
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_all_ticket_reseller', {
    fromdate: fromDate, todate: toDate, status, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), startrowindex: page, maxrows: MaxRows,
    fromplid: String(req.user.did), accounttype: '2', category,
  });
  const AllAgetnList = mapRows(rows, PROPS);
  const f = rows && rows[0];
  const k = f && Object.keys(f).find((x) => x.toLowerCase() === 'recordcount');
  const TotalRecord = k && s(f[k]) !== '' ? parseInt(f[k], 10) : 0;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
    status, ddlPlan, ddlcustpage,
  };
  ViewBag.ExcelData = await ExportReport(SearchField, SearchValue, fromDate, toDate, ddlPlan);
  res.json({ Model: AllAgetnList, ViewBag });
}));

module.exports = router;
