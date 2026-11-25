'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Bv_Report.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../../db');
const config = require('../../config');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const P = '/franchise/Bv_Report';
const BV_COLS = ['ROWNUMBER', 'CUSTOMERNAME', 'MOBILENO', 'DATE', 'BVPERCNTAGE', 'BV', 'ORDERID', 'ORDERNO', 'ORDERDERCYCLESTATUS', 'BENIFICARYID', 'TYPE'];
const toStr = (v) => (v === undefined || v === null ? '' : String(v).trim());

const indexHandler = asyncHandler(async (req, res) => {
  let { page, fromDate, toDate, SearchField, SearchValue, Status } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (Status == null) Status = '';
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const rows = await db.proc('shopping', 'usp_get_all_bv_report', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate, SEARCHFIELD: SearchField,
    SEARCHVALUE: String(SearchValue).trim(), DID, ORDERSTATUS: Status,
  });
  // PORT-NOTE: OUT params (@TotalCount,@TOTALMEMBER,@DATERANAGE,@TOTALBV) are read from columns of the first row
  const r0 = rows[0] || {};
  const num = (v) => (v === undefined || v === null ? 0 : Number(v));
  res.json({
    Model: mapRows(rows, BV_COLS),
    CurrentPage: page, GridPageSize: MaxRows, fromDate, toDate,
    TotalRecord: parseInt(num(r0.totalcount), 10), TotalMember: parseInt(num(r0.totalmember), 10),
    DateRanage: r0['DATERANAGE'.toLowerCase()] === undefined || r0['DATERANAGE'.toLowerCase()] === null ? '' : String(r0['DATERANAGE'.toLowerCase()]),
    TotalBV: num(r0.totalbv), NoPerPage: await UtilityClass.GridNumbersPerPage(),
  });
});

// void action: builds the club BV excel on the server (legacy used Excel Interop; errors swallowed)
async function ClubBVExcel(req, fromDate, toDate, SearchField, SearchValue, Stausid) {
  try {
    const DID = Number(req.user.did);
    const obj1 = await db.proc('shopping', 'usp_bv_club_history_resellerwise', {
      STARTROWINDEX: 1, MAXROWS: 1000000, FROMDATE: fromDate, TODATE: toDate, SEARCHFIELD: SearchField,
      SEARCHVALUE: String(SearchValue).trim(), DID, ORDERSTATUS: Stausid,
    });
    const head = ['S.No', 'Customer Name', 'Mobile No ', 'Date', 'B.V', 'Order Id', 'Beneficiary Id', 'Type'];
    const data = [];
    let FileName = '';
    for (const it of obj1) {
      data.push([toStr(it.rownumber), toStr(it.customername), toStr(it.mobile), toStr(it.date), toStr(it.bv), toStr(it.orderid), toStr(it.username), toStr(it.type)]);
      FileName = toStr(it.filename);
    }
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, FileName);
    if (FileName === '') throw new Error('empty file name');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    let ExcelJS = null;
    try { ExcelJS = require('exceljs'); } catch (_) { ExcelJS = null; } // PORT-NOTE: exceljs optional dependency
    if (ExcelJS) {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(head);
      data.forEach((r) => ws.addRow(r));
      const h = ws.getRow(1);
      h.font = { bold: true, name: 'Arial Narrow', size: 15 };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      ws.columns.forEach((c) => { c.width = 20; });
      await ws.protect('');
      await wb.xlsx.writeFile(file);
    } else {
      // fallback without exceljs: tab separated content with the same cells
      fs.writeFileSync(file, [head, ...data].map((r) => r.join('\t')).join('\n'));
    }
  } catch (ExpObj) {
    console.error(ExpObj.message); // ViewBag.filepath = ExpObj.Message
  }
}

// auth (legacy had no session check but reads Session["Plid"])
router.all(`${P}/Index{/:id}`, ...guard, indexHandler);
// route-config
router.all('/franchise/franchisee/Bv-Report', ...guard, indexHandler);

// auth
router.all(`${P}/DataProceed{/:id}`, ...guard, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate, Stausid } = req.p;
  if (SearchField == null || SearchValue == null) { SearchField = ''; SearchValue = ''; }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (Stausid == null) Stausid = '';
  await ClubBVExcel(req, fromDate, toDate, SearchField, SearchValue, Stausid);
  res.json('');
}));

// auth (void action)
router.all(`${P}/ClubBVExcel{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { fromDate, toDate, SearchField, SearchValue, Stausid } = req.p;
  await ClubBVExcel(req, fromDate, toDate, SearchField, SearchValue, Stausid);
  res.status(200).end();
}));

module.exports = router;
