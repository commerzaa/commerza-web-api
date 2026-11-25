'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Pv_Report.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
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

const P = '/franchise/Pv_Report';
const PROPS = ['ROWNUMBER', 'CUSTOMERNAME', 'MOBILENO', 'DATE', 'PVPERCNTAGE', 'PV', 'ORDERID', 'ORDERNO', 'ORDERDERCYCLESTATUS', 'BENIFICARYID', 'TYPE'];

async function Index(req, res) {
  let { fromDate, toDate, SearchField, SearchValue, Status } = req.p;
  let page = req.p.page;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (Status == null) Status = '';
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  page = toPage(page);
  const rows = await db.proc('shopping', 'usp_get_all_pv_report', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, searchfield: SearchField,
    searchvalue: String(SearchValue).trim(), did: DID, orderstatus: Status,
  });
  const _PV_REPORT = mapRows(rows, PROPS);
  // OUT params @TotalCount/@TOTALMEMBER/@DATERANAGE/@TOTALBV come back as columns of the result row
  const TotalRecord = parseInt(outv(rows, 'totalcount') === null ? 0 : outv(rows, 'totalcount'), 10);
  res.json({
    Model: _PV_REPORT, CurrentPage: page, GridPageSize: MaxRows, fromDate, toDate, TotalRecord,
    TotalMember: parseInt(outv(rows, 'totalmember') === null ? 0 : outv(rows, 'totalmember'), 10),
    DateRanage: str(outv(rows, 'dateranage')),
    TotalBV: parseFloat(outv(rows, 'totalbv') === null ? 0 : outv(rows, 'totalbv')),
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
  });
}
// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/Pv-Report
router.all('/franchise/franchisee/Pv-Report{/:id}', auth, asyncHandler(Index));

// void action: ClubPVExcel -> writes <uploadDir>/AllExcelSheets/<FILENAME>
// PORT-NOTE: Microsoft.Office.Interop.Excel (COM) is replaced by the `exceljs` package (required lazily; not installed in package.json).
async function ClubPVExcel(req, fromDate, toDate, SearchField, SearchValue, Stausid) {
  let FileName = '';
  try {
    const DID = req.user.did;
    const obj1 = await db.proc('shopping', 'usp_pv_club_history_resellerwise', {
      startrowindex: 1, maxrows: 1000000, fromdate: fromDate, todate: toDate, searchfield: SearchField,
      searchvalue: SearchValue.trim(), did: DID, orderstatus: Stausid,
    });
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.getCell(1, 1).value = 'S.No';
    worksheet.getCell(1, 2).value = 'Customer Name';
    worksheet.getCell(1, 3).value = 'Mobile No ';
    worksheet.getCell(1, 4).value = 'Date';
    worksheet.getCell(1, 5).value = 'P.V';
    worksheet.getCell(1, 6).value = 'Order Id';
    worksheet.getCell(1, 7).value = 'Beneficiary Id';
    worksheet.getCell(1, 8).value = 'Type';
    let row = 2;
    for (const Item of obj1) {
      worksheet.getCell(row, 1).value = str(Item.rownumber).trim();
      worksheet.getCell(row, 2).value = str(Item.customername).trim();
      worksheet.getCell(row, 3).value = str(Item.mobile).trim();
      worksheet.getCell(row, 4).value = str(Item.date).trim();
      worksheet.getCell(row, 5).value = str(Item.pv).trim();
      worksheet.getCell(row, 6).value = str(Item.orderid).trim();
      worksheet.getCell(row, 7).value = str(Item.username).trim();
      worksheet.getCell(row, 8).value = str(Item.type).trim();
      FileName = str(Item.filename).trim();
      row++;
    }
    const heading = worksheet.getRow(1);
    heading.font = { bold: true, name: 'Arial Narrow', size: 15 };
    heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    worksheet.columns.forEach((c) => { c.width = 18; }); // AutoFit approximation
    await worksheet.protect('');
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, FileName);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await workbook.xlsx.writeFile(p);
  } catch (ExpObj) {
    // ViewBag.filepath = ExpObj.Message (not returned by the void action)
  }
}

// auth
router.all(P + '/DataProceed{/:id}', auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate, Stausid } = req.p;
  if (SearchField == null || SearchValue == null) { SearchField = ''; SearchValue = ''; }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (Stausid == null) Stausid = '';
  await ClubPVExcel(req, fromDate, toDate, SearchField, SearchValue, Stausid);
  res.json('');
}));

// auth  (void action => EmptyResult)
router.all(P + '/ClubPVExcel{/:id}', auth, asyncHandler(async (req, res) => {
  const { fromDate, toDate, SearchField, SearchValue, Stausid } = req.p;
  // legacy: SearchValue.Trim() on a null value throws NullReferenceException (caught inside, nothing written)
  await ClubPVExcel(req, fromDate, toDate, SearchField, SearchValue === undefined ? null : SearchValue, Stausid);
  res.status(200).end();
}));

module.exports = router;
