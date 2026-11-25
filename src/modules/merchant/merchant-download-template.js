'use strict';
// Port of Merchant Panel Controllers/CustomerPanel/Merchant_DownloadTemplate.cs (Merchant_DownloadTemplateController)
// Actions: Index, DownloadFormat, WriteDataIntoExcelWithFormats (public helper, not HTTP-bindable), GetTimestamp (static helper). DB access is inside libs.
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const CategoryDAL = require('../../lib/merchant/CategoryDal');
const ProductDal = require('../../lib/merchant/ProductDal');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const P = '/merchant/Merchant_DownloadTemplate';

const str = (v) => (v === undefined || v === null ? '' : String(v));
const IDCOLS = ['Sno', 'MCID', 'CID', 'SCID'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

/** DateTime.ToString("yyyyMMddHHmmssffff") */
function GetTimestamp(value) {
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
// exceljs writes OOXML, so the file keeps the legacy ".xls" name but has xlsx content. Cell/row "Locked" flags (no sheet protection in legacy),
// AutoFit and the COM-object TrackError string dumps have no equivalent and are omitted.
async function WriteDataIntoExcelWithFormats(req, tables) {
  const CorrectTimeStamp = GetTimestamp(new Date());
  const relName = 'Product_Bulk_Upload_Format' + str(req.user.loginid) + '_' + str(req.user.username) + '' + CorrectTimeStamp + '.xls';
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ProductDetails');
    const worksheetsecond = workbook.addWorksheet('AttributeDetails');
    workbook.addWorksheet('ProductPreview');

    const colName = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    // range A1:ZZ1 (702 columns)
    for (let c = 1; c <= 702; c++) {
      const cell = worksheet.getCell(1, c);
      cell.font = { bold: true, name: 'Arial Narrow', size: 15 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow
      const cell2 = worksheetsecond.getCell(1, c);
      cell2.font = { bold: true, name: 'Arial Narrow', size: 15, color: { argb: 'FFFFFFFF' } }; // White
      cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0000FF' } }; // Blue
    }
    void colName;

    let SecondExcelCount = 1;
    let p_dtData = null;
    if (tables[0].length > 0) p_dtData = tables[0];
    if (p_dtData === null) throw NRE();
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
            const n = Number(CellValue);
            if (CellValue === null || CellValue === undefined || CellValue === '' || Number.isNaN(n)) throw new Error('Validation formula is not numeric.');
            // EntireColumn.Validation: whole number, equal CellValue, IgnoreBlank=false, InCellDropdown=false, ShowInput=true, ShowError=false
            for (let r = 1; r <= 200; r++) {
              worksheet.getCell(r, c).dataValidation = { type: 'whole', operator: 'equal', allowBlank: false, showErrorMessage: false, showInputMessage: true, formulae: [n] };
            }
          }
          worksheet.getColumn(c).width = HeaderName.length + 1;
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
              if (CellData.trim().length < 250) {
                const list = CellData.trim().split(',').map((x) => x.trim());
                const FlatList = list.join(',');
                worksheet.getCell(J, c).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: true, showInputMessage: true, formulae: ['"' + FlatList + '"'] };
              } else if (J === 2) {
                worksheet.getCell(J, c).value = 'Go to the Attribute Details sheet to get Allowed values';
                worksheetsecond.getCell(1, SecondExcelCount).value = HeaderName;
                let RowCount = 2;
                for (const Itmes of CellData.trim().split(',')) {
                  const Item = Itmes;
                  worksheetsecond.getCell(RowCount, SecondExcelCount).value = Item.trim();
                  worksheetsecond.getColumn(SecondExcelCount).width = Item.length + 1;
                  RowCount += 1;
                }
                SecondExcelCount += 1;
              }
            }
          }
        }
      }
    }
    const dir = path.join(config.uploadDir, 'ProductTemplateExcel');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, relName);
    await UtilityClass.TrackError('Admin- Merchant Excel Path: ' + filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    worksheet.views = [{ state: 'frozen', xSplit: 7, ySplit: 2 }]; // SplitRow = 2, SplitColumn = 7
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  } catch (ex) {
    await UtilityClass.TrackError('Admin- Merchant Excel Issue: ' + ex.message);
    return '/ProductTemplateExcel/' + relName;
  }
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/download-template
// auth ([SessionExpireCheck])
router.all([P + '/Index{/:id}', P, '/merchant/download-template', '/merchant/merchant/download-template'], auth, asyncHandler(async (req, res) => {
  const BranchId = Number(req.user.plid);
  let objModel = { BranchId };
  const dal = new CategoryDAL();
  objModel = await dal.GetSelectedCategory(objModel.BranchId);
  res.json({ view: '~/Views/Merchant_DownloadTemplate/Index.cshtml', Model: objModel, ViewBag: { Plid: BranchId } });
}));

// ---- DownloadFormat ------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(P + '/DownloadFormat{/:id}', auth, asyncHandler(async (req, res) => {
  const MainCatId = parseInt(req.p.MainCatId, 10);
  const CatId = parseInt(req.p.CatId, 10);
  const SubCatId = parseInt(req.p.SubCatId, 10);
  let ret = 'Failed';
  if (req.user == null) return res.json('Session Expired. Please login again');
  try {
    const BranchId = Number(req.user.plid);
    const objProductdal = new ProductDal();
    await objProductdal.CategoryAttribute_List(MainCatId, CatId, SubCatId); // CategoryAttribute (result unused in legacy)
    const objDs = await objProductdal.CategoryAttribute_DataSet(MainCatId, CatId, SubCatId, BranchId);
    const tables = dsTables(objDs);
    if (tables.length > 0) {
      ret = await WriteDataIntoExcelWithFormats(req, tables);
    }
    await UtilityClass.TrackError('Admin- Merchant Excel Issue: ' + String(ret));
    return res.json(String(ret));
  } catch (Ex) {
    await UtilityClass.TrackError('Admin- Merchant Excel Issue: ' + Ex.message);
    return res.json(String(ret));
  }
}));

// NOTE: WriteDataIntoExcelWithFormats(DataSet) is a public helper (takes a DataSet, not bindable from HTTP) and GetTimestamp is static -> not routed.

module.exports = router;
