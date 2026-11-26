'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Merchant_DownloadTemplate.cs (Merchant_DownloadTemplateController; DB access inside libs)
// The portal C# differs from the Merchant Panel one (different WriteDataIntoExcelWithFormats, extra DataSetsToExcel, Sheets/ folder,
// fixed file name ATCShopping_TemplateBulkUpload.xlsx), so this module is ported from the portal C# directly.
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const CategoryDAL = require('../../lib/portal/CategoryDal');
const ProductDal = require('../../lib/portal/ProductDal');

const router = express.Router();
const P = '/portal/Merchant_DownloadTemplate';
// EntireColumn validations/formats are applied to this many rows (exceljs has no whole-column validation)
const COLUMN_ROWS = 1000;

/** DataSet (lib shape { Tables: [rows[]] } / array) -> array of tables */
function dsTables(ds) {
  if (!ds) return [];
  if (Array.isArray(ds)) return Array.isArray(ds[0]) ? ds : [ds];
  if (Array.isArray(ds.Tables)) return ds.Tables;
  return Object.values(ds).filter(Array.isArray);
}

/**
 * PORT-NOTE: PostgreSQL rows carry no .NET column DataType; it is inferred from the first non-null value of the column:
 * JS number -> Int32 (integer) / Decimal, Date -> DateTime, boolean -> Boolean, other -> String.
 */
function columnType(rows, col) {
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (v instanceof Date) return 'DateTime';
    if (typeof v === 'boolean') return 'Boolean';
    if (typeof v === 'number') return Number.isInteger(v) ? 'Int32' : 'Decimal';
    return 'String';
  }
  return 'String';
}

const ARGB = { LightGray: 'FFD3D3D3', Khaki: 'FFF0E68C', Red: 'FFFF0000', Black: 'FF000000' };

/**
 * public string WriteDataIntoExcelWithFormats(DataSet ds)
 * PORT-NOTE: Microsoft.Office.Interop.Excel (COM automation) is replaced by `exceljs` (lazy require; not installed by default).
 * Whole-column validations/wrap are applied to the first COLUMN_ROWS rows. Sheet protection password: config.app.TemplateSheetPassword.
 */
async function WriteDataIntoExcelWithFormats(ds) {
  let ret = 'Failed';
  let ExcelSheet = null;
  try {
    const ExcelJS = require('exceljs');
    const ExcelWorkBook = new ExcelJS.Workbook();
    const tables = dsTables(ds);
    if (!ds) throw c.NRE();
    const SheetNames = ['ProuductsUpload'];
    // Worksheets.Add() for every non-empty table (+ the default sheet of Workbooks.Add)
    const sheets = [];
    for (let i = 0; i < tables.length; i++) if (tables[i].length > 0) sheets.push(null);
    let maxRows = 0;
    for (let i = 0; i < tables.length; i++) {
      let p_dtData = null;
      if (tables[i].length > 0) {
        p_dtData = tables[i];
        ExcelSheet = ExcelWorkBook.addWorksheet('Sheet' + (i + 1));
      } else {
        continue;
      }
      const cols = Object.keys(p_dtData[0]);
      const types = cols.map((k) => columnType(p_dtData, k));
      const isNum = (ci) => types[ci] === 'Int32' || types[ci] === 'Decimal';
      const colValidation = (ci, dv) => { for (let r = 1; r <= COLUMN_ROWS; r++) ExcelSheet.getCell(r, ci + 1).dataValidation = dv; };

      if (p_dtData.length > 500) maxRows = 500;
      else maxRows = p_dtData.length;

      for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
        for (let colIndex = 0; colIndex < cols.length; colIndex++) {
          let CellValue = p_dtData[rowIndex][cols[colIndex]];
          const CellData = c.isNull(CellValue) ? '' : String(CellValue);
          if (rowIndex === 0) {
            const HeaderName = cols[colIndex];
            ExcelSheet.getCell(rowIndex + 1, colIndex + 1).value = HeaderName;
            // Range[Cells[1,col], Cells[rows, cols]].ColumnWidth = HeaderName.Length + 5 (later headers overwrite the following columns)
            for (let k = colIndex + 1; k <= cols.length; k++) ExcelSheet.getColumn(k).width = HeaderName.length + 5;
            if (HeaderName === 'MCID' || HeaderName === 'CID' || HeaderName === 'SCID') {
              if (types[colIndex] === 'Int32') {
                colValidation(colIndex, { type: 'whole', operator: 'equal', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: [Number(CellValue)] });
              }
            } else if (HeaderName === 'Vat' || HeaderName === 'Deal' || HeaderName === 'GroupName') {
              if (CellData === '') CellValue = ' ';
              colValidation(colIndex, { type: 'list', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: ['"' + String(CellValue) + '"'] });
            } else if (HeaderName === 'UnitQty' || HeaderName === 'StockIn' || HeaderName === 'WarrInfo') {
              if (isNum(colIndex)) {
                colValidation(colIndex, { type: 'whole', operator: 'greaterThanOrEqual', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: [1] });
              }
            } else if (HeaderName === 'Weight_kg' || HeaderName === 'Length_cms' || HeaderName === 'Breadth_cms' || HeaderName === 'Height_cms') {
              if (isNum(colIndex)) {
                colValidation(colIndex, { type: 'whole', operator: 'greaterThanOrEqual', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: [0] });
              }
            } else if (HeaderName === 'MRP' || HeaderName === 'DAP' || HeaderName === 'Discount' || HeaderName === 'ShippCharge') {
              if (isNum(colIndex)) {
                colValidation(colIndex, { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: [0.0] });
                if (HeaderName === 'MRP') ExcelSheet.getCell(rowIndex + 3, colIndex + 1).value = 100;
                if (HeaderName === 'DAP') ExcelSheet.getCell(rowIndex + 3, colIndex + 1).value = 80;
                if (HeaderName === 'Discount') ExcelSheet.getCell(rowIndex + 3, colIndex + 1).value = 20;
              }
            } else if (CellData !== '') {
              if (CellData.split(',').length > 1) {
                colValidation(colIndex, { type: 'list', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: ['"' + String(CellValue) + '"'] });
              }
            }
          }

          // Write row value into Excel cell
          if (CellData !== '') {
            if (CellData.split(',').length === 1) {
              ExcelSheet.getCell(rowIndex + 2, colIndex + 1).value = CellValue;
            }
          }
          const cell = ExcelSheet.getCell(rowIndex + 2, colIndex + 1);
          if (cols[colIndex] === 'mobile') {
            // no formatting
          } else if (types[colIndex] === 'DateTime') {
            cell.numFmt = 'mm-d-yy ';
          } else if (types[colIndex] === 'String') {
            cell.font = { ...(cell.font || {}), name: 'Arial Narrow', size: 11 };
          }
          // (System.Single "0.00%" format: no float4 type detectable here)
          ExcelSheet.getColumn(colIndex + 1).alignment = { wrapText: true };
        }
      }
      // ExcelSheet.Cells.Font.Color = Black
      ExcelSheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cl) => { cl.font = { ...(cl.font || {}), color: { argb: ARGB.Black } }; }));

      // header row: LightGray, bold, size 15
      for (let k = 1; k <= cols.length; k++) {
        const h = ExcelSheet.getCell(1, k);
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.LightGray } };
        h.font = { ...(h.font || {}), bold: true, size: 15 };
        const d = ExcelSheet.getCell(2, k);
        d.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.Khaki } };
        d.font = { ...(d.font || {}), color: { argb: ARGB.Red } };
      }
      // Cells.Locked = false; rows 1 (header) and 2 (demo data) locked
      for (let k = 1; k <= cols.length; k++) ExcelSheet.getColumn(k).protection = { locked: false };
      ExcelSheet.getRow(1).protection = { locked: true };
      ExcelSheet.getRow(2).protection = { locked: true };

      if (i >= SheetNames.length) throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
      if (SheetNames[i] === 'ProuductsUpload') {
        ExcelSheet.views = [{ state: 'frozen', xSplit: 5, ySplit: 0 }];
      }
      ExcelSheet.name = SheetNames[i];
    }
    void sheets;

    if (!ExcelSheet) throw c.NRE(); // ExcelSheet.Protect(...) on null
    await ExcelSheet.protect(String(config.app.TemplateSheetPassword || ''), {});

    let p = c.mapPath('~/Sheets/');
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    const filename = 'ATCShopping_TemplateBulkUpload.xlsx';
    p = path.join(p, filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await ExcelWorkBook.xlsx.writeFile(p);
    ret = filename;
  } catch (ex) {
    ret = ex.message;
  } finally {
    ExcelSheet = null;
  }
  return ret;
}

/**
 * public void DataSetsToExcel(List<DataSet> dataSets, string fileName)  (Excel Interop export, one sheet per DataSet)
 * PORT-NOTE: exceljs instead of Excel Interop; the default worksheet is not created so nothing is deleted.
 */
async function DataSetsToExcel(dataSets, fileName) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  if (!dataSets) throw c.NRE();
  for (const dataSet of dataSets) {
    const dataTable = dsTables(dataSet)[0];
    if (!dataTable) throw new RangeError('Cannot find table 0.');
    const cols = dataTable.length ? Object.keys(dataTable[0]) : [];
    // Sheets.Add(Before: Sheets[1]) => newest dataset first
    const ws = wb.addWorksheet(String(dataSet.DataSetName || 'NewDataSet'));
    wb.worksheets.unshift(wb.worksheets.pop());
    cols.forEach((k, i) => { ws.getCell(1, i + 1).value = k; });
    dataTable.forEach((r, ri) => cols.forEach((k, ci) => { ws.getCell(ri + 2, ci + 1).value = r[k]; }));
    cols.forEach((k, ci) => {
      const t = columnType(dataTable, k);
      let format = '@';
      if (t === 'DateTime') format = 'dd/mm/yyyy';
      else if (t === 'Decimal') format = '$* #,##0.00;[Red]-$* #,##0.00';
      else if (t === 'Int32') format = '0';
      else if (t === 'Boolean') format = '@';
      for (let r = 2; r <= dataTable.length + 1; r++) ws.getCell(r, ci + 1).numFmt = format;
    });
  }
  await wb.xlsx.writeFile(fileName);
}

// auth ([SessionExpireCheck])
// route-config: merchant/download-template -> Merchant_DownloadTemplate/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/download-template'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const BranchId = Number(req.user.plid);
  let objModel = { BranchId: Number(req.user.plid) };
  const dal = new CategoryDAL();
  objModel = await dal.GetSelectedCategory(objModel.BranchId);
  return c.viewJson(res, '~/Views/CustomerPanel/Merchant_DownloadTemplate/Index.cshtml', objModel, { Plid: BranchId });
}));

// auth ([SessionExpireCheck]; the inner Session["Plid"] == null check is unreachable but kept)
router.all(`${P}/DownloadFormat{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const MainCatId = c.bindInt(req, 'MainCatId');
  const CatId = c.bindInt(req, 'CatId');
  const SubCatId = c.bindInt(req, 'SubCatId');
  if (!ps.isCustomer(req)) return res.json('Session Expired. Please login again');
  let ret = 'Failed';
  const BranchId = Number(req.user.plid);
  const dal = new ProductDal();
  const ds = await dal.CategoryAttribute_DataSet(MainCatId, CatId, SubCatId, BranchId);
  if (dsTables(ds).length > 0) {
    ret = await WriteDataIntoExcelWithFormats(ds);
    // if (ret != "Failed") { /* Download_File("~\\Sheets\\" + ret); commented out in legacy */ }
  }
  return res.json(String(ret));
}));

// auth (public string action in legacy, no session check; the model binder supplies an empty DataSet => ExcelSheet.Protect on null
// => the caught message is returned as content). Protected: it writes the shared template file.
router.all(`${P}/WriteDataIntoExcelWithFormats{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const ret = await WriteDataIntoExcelWithFormats({ Tables: [] });
  res.type('text/html').send(ret);
}));

// auth (public void action in legacy, no session check; List<DataSet> cannot be bound from a request => NullReferenceException).
// Protected: the legacy wrote to an arbitrary fileName.
router.all(`${P}/DataSetsToExcel{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  await DataSetsToExcel(null, req.p.fileName);
  res.end();
}));

// private void Download_File(string FilePath) - private, only referenced from commented-out code => not routed.

module.exports = router;
