'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Merchant_DownloadTemplate.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const CategoryDAL = require('../../lib/franchise/CategoryDal');
const ProductDal = require('../../lib/franchise/ProductDal');

const router = express.Router();
const P = '/franchise/Merchant_DownloadTemplate';

const str = (v) => (v === undefined || v === null ? '' : String(v));
const IDCOLS = ['Sno', 'MCID', 'CID', 'SCID'];

function GetTimestamp(value) { // yyyyMMddHHmmssffff
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${value.getFullYear()}${p(value.getMonth() + 1)}${p(value.getDate())}${p(value.getHours())}${p(value.getMinutes())}${p(value.getSeconds())}${p(value.getMilliseconds() * 10, 4)}`;
}

// DataSet (ported as table array / {Tables} / keyed object) -> array of tables (arrays of row objects)
function dsTables(ds) {
  if (!ds) return [];
  if (Array.isArray(ds)) return Array.isArray(ds[0]) ? ds : [ds];
  if (Array.isArray(ds.Tables)) return ds.Tables;
  return Object.values(ds).filter(Array.isArray);
}

// PORT-NOTE: Microsoft.Office.Interop.Excel (COM) is replaced by the `exceljs` package (required lazily; not in package.json).
// exceljs writes OOXML, so the file keeps the legacy ".xls" name/URL but has xlsx content.
async function WriteDataIntoExcelWithFormats(req, tables) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  const p_dtData = tables[0].length > 0 ? tables[0] : null;
  if (p_dtData === null) throw new TypeError('Object reference not set to an instance of an object.');
  const cols = Object.keys(p_dtData[0]);
  for (let rowIndex = 0; rowIndex < p_dtData.length; rowIndex++) {
    for (let colIndex = 0; colIndex < cols.length; colIndex++) {
      const CellValue = p_dtData[rowIndex][cols[colIndex]];
      const CellData = str(CellValue);
      if (rowIndex === 0) {
        const HeaderName = cols[colIndex];
        const c = colIndex + 1;
        worksheet.getCell(1, c).value = HeaderName;
        if (IDCOLS.includes(HeaderName)) {
          for (let J = 2; J <= 200; J++) {
            worksheet.getCell(J, c).dataValidation = { type: 'whole', operator: 'equal', allowBlank: false, showErrorMessage: false, showInputMessage: true, formulae: [Number(CellValue)] };
          }
        }
        worksheet.getColumn(c).width = HeaderName.length + 5;
        for (let J = 2; J <= 200; J++) {
          if (IDCOLS.includes(HeaderName)) {
            if (HeaderName === 'Sno') worksheet.getCell(J, c).value = '' + J;
            else worksheet.getCell(J, c).value = '' + CellData.trim();
          }
          if (J === 2) {
            if (!CellData.trim().includes(',')) {
              worksheet.getCell(J, c).value = '' + CellData.trim();
            }
            worksheet.getCell(J, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA9A9A9' } }; // DarkGray
            worksheet.getCell(J, c).font = { color: { argb: 'FF000000' } };
          }
          if (CellData.trim().includes(',')) {
            const list = CellData.trim().split(',').map((x) => x.trim());
            const FlatList = list.join(',');
            worksheet.getCell(J, c).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + FlatList + '"'] };
          }
        }
      }
    }
  }
  const heading = worksheet.getRow(1);
  for (let c = 1; c <= cols.length; c++) {
    const cell = heading.getCell(c);
    cell.font = { bold: true, name: 'Arial Narrow', size: 15 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  }
  worksheet.views = [{ state: 'frozen', xSplit: 7, ySplit: 2 }];
  const CorrectTimeStamp = GetTimestamp(new Date());
  const rel = 'Product_Bulk_Upload_Format' + req.user.loginid + '_' + req.user.username + '' + CorrectTimeStamp + '.xls';
  const dir = path.join(config.uploadDir, 'ProductTemplateExcel');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, rel);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  await workbook.xlsx.writeFile(p);
  return '/ProductTemplateExcel/' + rel;
}

// [SessionExpireCheck] -> auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const BranchId = Number(req.user.did);
  let objModel = { BranchId };
  const dal = new CategoryDAL();
  objModel = await dal.GetSelectedCategory(objModel.BranchId);
  res.json({ Model: objModel, Plid: BranchId });
}));

// auth
router.all(P + '/DownloadFormat{/:id}', auth, asyncHandler(async (req, res) => {
  const MainCatId = parseInt(req.p.MainCatId, 10);
  const CatId = parseInt(req.p.CatId, 10);
  const SubCatId = parseInt(req.p.SubCatId, 10);
  if (req.user == null) return res.json('Session Expired. Please login again');
  let ret = 'Failed';
  const BranchId = Number(req.user.did);
  const objProductdal = new ProductDal();
  await objProductdal.CategoryAttribute_List(MainCatId, CatId, SubCatId); // CategoryAttribute (result unused in legacy)
  const objDs = await objProductdal.CategoryAttribute_DataSet(MainCatId, CatId, SubCatId, BranchId);
  const tables = dsTables(objDs);
  if (tables.length > 0) {
    ret = await WriteDataIntoExcelWithFormats(req, tables);
  }
  res.json(String(ret));
}));

// NOTE: WriteDataIntoExcelWithFormats(DataSet) is a public helper (takes a DataSet, not bindable from HTTP) -> not exposed as a route.

module.exports = router;
