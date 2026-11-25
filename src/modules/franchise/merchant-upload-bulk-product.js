'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\Merchant_UploadBulkProduct.cs (Merchant_UploadBulkProductController) */
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const ProductDal = require('../../lib/franchise/ProductDal');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const P = '/franchise/Merchant_UploadBulkProduct';

// Reads the first row as column names (ExcelDataReader IsFirstRowAsColumnNames) -> DataSet-like { Tables:[{Columns:[],Rows:[{}]}] }
function readWorkbook(buffer) {
  // PORT-NOTE: requires npm package "xlsx" (replaces ExcelDataReader); not installed by default.
  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return wb.SheetNames.map((n) => {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true });
    const Columns = (aoa[0] || []).map((c) => String(c));
    const Rows = aoa.slice(1).map((r) => { const o = {}; Columns.forEach((c, i) => { o[c] = r[i] === undefined ? '' : r[i]; }); return o; });
    return { Columns, Rows };
  });
}
const S = (v) => (v === undefined || v === null ? '' : String(v));

function GenerateXMLProductList(tables, SellerCode) {
  const t0 = tables[0];
  let Str = '<Product>';
  for (let i = 1; i < t0.Rows.length; i++) {
    const r = t0.Rows[i];
    if (S(r.MCID) !== '') {
      const cash = S(r.COD) === 'Available' ? '1' : '0';
      Str += '<Tr>';
      Str += '<SNo>' + S(r.SNo) + '</SNo>';
      Str += '<MCID>' + S(r.MCID) + '</MCID>';
      Str += '<CID>' + S(r.CID) + '</CID>';
      Str += '<SCID>' + S(r.SCID) + '</SCID>';
      Str += '<Vat>' + S(r.Vat) + '</Vat>';
      Str += '<Code>' + S(r.Code) + '</Code>';
      Str += '<Title>' + S(r.Title) + '</Title>';
      Str += '<ShortDesc>' + S(r.ShortDesc) + '</ShortDesc>';
      Str += '<FullDesc>' + S(r.FullDesc) + '</FullDesc>';
      Str += '<KeyFeatures>' + S(r.KeyFeatures) + '</KeyFeatures>';
      Str += '<UnitQty>' + S(r.UnitQty) + '</UnitQty>';
      Str += '<Unit>' + S(r.Unit) + '</Unit>';
      Str += '<StockIn>' + S(r.StockIn) + '</StockIn>';
      Str += '<Images>';
      let NewImages = '';
      for (const Img of S(r.Images).split('^')) NewImages += SellerCode + '_' + Img + '^';
      Str += NewImages.replace(/\^+$/, '');
      Str += '</Images>';
      Str += '<MRP>' + S(r.MRP) + '</MRP>';
      Str += '<DAP>' + S(r.DAP) + '</DAP>';
      Str += '<Discount>' + S(r.Discount) + '</Discount>';
      Str += '<Deal>' + S(r.Deal) + '</Deal>';
      Str += '<GroupName>' + S(r.GroupName) + '</GroupName>';
      Str += '<Replacement>' + S(r.Replacement) + '</Replacement>';
      Str += '<ProcSLA>' + S(r.ProcSLA) + '</ProcSLA>';
      Str += '<COD>' + cash + '</COD>';
      Str += '<ShippCharge>' + S(r.ShippCharge) + '</ShippCharge>';
      Str += '<Weight_kg>' + S(r.Weight_kg) + '</Weight_kg>';
      Str += '<Length_cms>' + S(r.Length_cms) + '</Length_cms>';
      Str += '<Breadth_cms>' + S(r.Breadth_cms) + '</Breadth_cms>';
      Str += '<Height_cms>' + S(r.Height_cms) + '</Height_cms>';
      Str += '<WarrInfo>' + S(r.WarrInfo) + '</WarrInfo>';
      Str += '<AllAttributes>';
      let Attribute = '';
      for (let j = 28; j < t0.Columns.length; j++) {
        const ColumnName = t0.Columns[j];
        if (ColumnName !== 'ErrorReason') Attribute += ColumnName + '~' + S(r[ColumnName]) + '^';
      }
      Str += Attribute + '</AllAttributes>';
      Str += '<ErrorReason>' + S(r.ErrorReason) + '</ErrorReason>';
      Str += '</Tr>';
    }
  }
  Str += '</Product>';
  return Str;
}

// auth ([SessionExpireCheck])
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  // action only returned the view; parameters PrCode, search, filtercategory, page, ddlstatus were unused
  res.json({ view: 'Merchant_UploadBulkProduct/Index' });
}));

// auth ([SessionExpireCheck] [HttpPost] [ValidateAntiForgeryToken])
router.post(`${P}/Upload{/:id}`, auth, upload.single('upload'), asyncHandler(async (req, res) => {
  const file = req.file;
  const ModelState = {};
  if (file && file.size > 0) {
    const fname = file.originalname || '';
    if (!(fname.endsWith('.xls') || fname.endsWith('.xlsx'))) {
      ModelState.File = 'This File Format Is Not Supported';
      return res.json({ status: false, ModelState });
    }
    let tables = readWorkbook(file.buffer);
    const BranchId = req.user.did;
    const SellerCode = String(BranchId);
    const xmllist = GenerateXMLProductList(tables, SellerCode);
    const dal = new ProductDal();
    const result = await dal.InsertBulkProduct(BranchId, xmllist);
    const Tables = Array.isArray(result) ? result : ((result && (result.Tables || result.tables)) || []);
    if (Tables.length > 0) {
      const t1 = (Tables[1] && (Tables[1].Rows || Tables[1])[0]) || {};
      const out = {
        TotalColumnCount: S(t1.TotalColumnCount),
        TotalRowsCount: S(t1.TotalRowsCount),
        TotalErrorCount: S(t1.TotalErrorCount),
        TotalSuccessCount: S(t1.TotalSuccessCount),
        TotalRepeatCount: S(t1.TotalRepeatCount),
      };
      sessionStore.set(req, 'DataSet', Tables); // TempData["DataSet"]
      return res.json({ ...out, Model: Tables[0].Rows || Tables[0] });
    }
    ModelState.File = 'Some error occured while uploading.';
    return res.json({ status: false, ModelState });
  }
  ModelState.File = 'Please Upload Your File';
  res.json({ status: false, ModelState });
}));

// auth ([SessionExpireCheck])
router.all(`${P}/ExportExcel{/:id}`, auth, asyncHandler(async (req, res) => {
  let ret = 'Failed';
  const ds = sessionStore.get(req, 'DataSet');
  if (ds && ds.length > 0) {
    sessionStore.set(req, 'DataSet', ds);
    ret = await ExportExcelForReporting(ds);
  }
  res.json(String(ret));
}));

const rowsOf = (t) => (Array.isArray(t) ? t : (t.Rows || t.rows || []));
const colsOf = (t) => (t.Columns || t.columns || Object.keys(rowsOf(t)[0] || {}));

async function ExportExcelForReporting(ds) {
  let ret = 'Failed';
  try {
    // PORT-NOTE: Excel Interop replaced by npm package "exceljs" (not installed by default); data validations approximated.
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const SheetNames = ['ProuductsUpload', 'TotalCount', 'ErrorCodeList'];
    let lastSheet = null;
    for (let i = 0; i < ds.length; i++) {
      const rows = rowsOf(ds[i]);
      if (rows.length <= 0) continue;
      const cols = colsOf(ds[i]).map((c) => (typeof c === 'string' ? c : c.ColumnName));
      const sheet = wb.addWorksheet(SheetNames[i] || ('Sheet' + (i + 1)));
      lastSheet = sheet;
      const maxRows = Math.min(rows.length, 500);
      for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
        cols.forEach((HeaderName, colIndex) => {
          let CellValue = rows[rowIndex][HeaderName];
          const CellData = S(CellValue);
          if (rowIndex === 0) {
            sheet.getCell(1, colIndex + 1).value = HeaderName;
            sheet.getColumn(colIndex + 1).width = HeaderName.length + 5;
            const isNum = typeof CellValue === 'number';
            if (['MCID', 'CID', 'SCID'].includes(HeaderName)) {
              // whole-number validation not reproduced (PORT-NOTE)
            } else if (['Vat', 'Deal', 'GroupName'].includes(HeaderName)) {
              if (CellData === '') CellValue = ' ';
            } else if (['MRP', 'DAP', 'Discount'].includes(HeaderName) && isNum) {
              const v = HeaderName === 'MRP' ? 100 : HeaderName === 'DAP' ? 80 : 20;
              sheet.getCell(3, colIndex + 1).value = v;
            }
          }
          if (CellData !== '' && CellData.split(',').length === 1) sheet.getCell(rowIndex + 2, colIndex + 1).value = rows[rowIndex][HeaderName];
          if (typeof rows[rowIndex][HeaderName] === 'string') sheet.getCell(rowIndex + 2, colIndex + 1).font = { name: 'Arial Narrow', size: 11, color: { argb: 'FF000000' } };
          sheet.getColumn(colIndex + 1).alignment = { wrapText: true };
        });
      }
      const hdr = sheet.getRow(1);
      hdr.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }; c.font = { bold: true, size: 15 }; });
      sheet.getRow(2).eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E68C' } }; c.font = { color: { argb: 'FFFF0000' } }; });
      if (SheetNames[i] === 'ProuductsUpload') sheet.views = [{ state: 'frozen', xSplit: 5 }];
    }
    if (lastSheet) await lastSheet.protect('123Password', {});
    const dir = path.join(config.uploadDir || path.join(process.cwd(), 'uploads'), 'Sheets');
    fs.mkdirSync(dir, { recursive: true });
    const filename = 'MaayasUploadProduct.xlsx';
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await wb.xlsx.writeFile(p);
    ret = filename;
  } catch (ex) {
    ret = 'Failed';
  }
  return ret;
}

module.exports = router;
