'use strict';
/**
 * Shared helpers for portal batch 23 (CustomerPanel merchant pages: Merchant_UploadBulkProduct, Merchant_UploadBulkImages, Add_Product,
 * BillingDetails, Merchant_NonLiveProduct, QCUploadBulkProduct, ...). Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: mvcStr(req, name), trimChar(s, ch), bindBool(req, name), bindDecimal(req, name), bindChar(req, name),
 *          strictInt32(v), dsTables(ds), EXCEL_PRODUCT_DETAIL, PRODUCT_FULL_DETAIL_DEFAULT(), insertBulkProductDataSet(BranchId, xml),
 *          readExcelDataSet(buffer), GenerateXMLProductList(result, SellerCode), ExportExcelForReporting(ds), utcStamp(d),
 *          listFiles(dir), listDirs(dir), fileInfoJson(f), totalOf(rows)
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const c = require('./batch-05-common');
const c2 = require('./batch-02-common');
const ProductDal = require('../../../lib/portal/ProductDal');

const DB = 'shopping';

/** MVC string action parameter (DefaultModelBinder ConvertEmptyStringToNull): missing or "" => null. */
function mvcStr(req, name) {
  const v = req.p[name];
  if (v === undefined || v === null) return null;
  const s = Array.isArray(v) ? String(v[0]) : String(v);
  return s === '' ? null : s;
}

/** C# string.Trim(char) on a possibly-null string (null => NullReferenceException). */
function trimChar(s, ch) {
  if (s === undefined || s === null) throw c.NRE();
  let a = 0; let b = s.length;
  while (a < b && s[a] === ch) a++;
  while (b > a && s[b - 1] === ch) b--;
  return s.slice(a, b);
}

/** Non-nullable bool action parameter (MVC accepts "true"/"false", checkbox "true,false"). */
function bindBool(req, name) {
  let v = req.p[name];
  if (Array.isArray(v)) v = v[0];
  if (typeof v === 'boolean') return v;
  const t = v === undefined || v === null ? '' : String(v).split(',')[0].trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  throw c.nullEntry(name, 'System.Boolean');
}

/** Non-nullable decimal action parameter. */
function bindDecimal(req, name) {
  const v = req.p[name];
  if (typeof v === 'number') return v;
  const t = v === undefined || v === null ? '' : String(v).trim();
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) throw c.nullEntry(name, 'System.Decimal');
  return Number(t);
}

/** Non-nullable char action parameter (a one-character string). */
function bindChar(req, name) {
  const v = req.p[name];
  const t = v === undefined || v === null ? '' : String(v);
  if (t.length !== 1) throw c.nullEntry(name, 'System.Char');
  return t;
}

/** Convert.ToInt32(string) / int.Parse on a non-null string ("" => FormatException). */
function strictInt32(v) {
  if (typeof v === 'number') return Math.round(v);
  const t = v === undefined || v === null ? '' : String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw c.FormatError();
  return parseInt(t, 10);
}

/** @TotalCount OUT read from the "totalcount" column of the first row (0 when no rows). */
function totalOf(rows, name = 'totalcount') {
  if (!rows || !rows.length) return 0;
  const k = Object.keys(rows[0]).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined || rows[0][k] === null ? 0 : c.toInt32(rows[0][k]);
}

/** DataSet (lib shape { Tables: [rows[]] } / array) -> array of tables (row arrays, may carry .Columns). */
function dsTables(ds) {
  if (!ds) return [];
  if (Array.isArray(ds)) return Array.isArray(ds[0]) || ds.length === 0 ? ds : [ds];
  if (Array.isArray(ds.Tables)) return ds.Tables;
  return Object.values(ds).filter(Array.isArray);
}
const tableColumns = (t) => (Array.isArray(t.Columns) ? t.Columns : (t.length ? Object.keys(t[0]) : []));

/** class Excel_Product_Detail (Models/ExcelProduct.cs) property names */
const EXCEL_PRODUCT_DETAIL = ['Id', 'MCID', 'CID', 'SCID', 'VCID', 'Code', 'ProductTitle', 'ShortDescription', 'FullDescription', 'KeyFeatures', 'UnitQty', 'Unit',
  'StockIn', 'WarrentyInfoCare', 'ProductImages', 'SellMRP', 'DAP', 'Discount', 'DealsIds', 'GroupId', 'ReplacementDay', 'ProcurementSLA', 'CashOnDelivery',
  'ShippingCharges', 'Weight_kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'ErrorReason', 'BranchId', 'CreatedDate', 'QCStatus', 'BranchName',
  'MasterCategoryName', 'CategoryName', 'SubCategoryName', 'VatCategoryName', 'VatValue', 'DealsName', 'GroupName'];

/** new ProductFullDetail() (Models/Product_Master_Sub.cs) with the C# default values. */
function PRODUCT_FULL_DETAIL_DEFAULT() {
  return {
    ActiveFrom: null, ActiveTo: null, ActualPrice: 0, BranchId: 0, Breadth_cms: 0, CashOnDelivery: null, catid: 0, Color: null, CompanyId: 0, DAP: 0,
    DiscountPercentage: 0, FullDescription: null, Height_cms: 0, IsActive: null, IsAllowCoupon: null, IsLevel: null, IsOutOfStock: null, IsVerified: null,
    KeyFeatures: null, Length_cms: 0, MainCategoryId: 0, MainCategoryName: null, MaxOrderQty: 0, MinOrderQty: 0, MPRID: 0, Paymode: null, ProcurementSLA: 0,
    WarrentyInfoCare: 0, ProductCode: null, SubPrCode: null, ProductImages: null, ProductTitle: null, Qty: 0, ReplacementDay: 0, SellMRP: 0, ShippingCharges: 0,
    ShotDescription: null, Size: null, SPRID: 0, StockIn: 0, StockOut: 0, SubCategoryId: 0, Unit: null, VatCategoryId: 0, VatPercentage: 0, Weight_kg: 0,
  };
}

// usp_InsertBulkProduct #TMP column order / .NET column types (dbshopping.sql)
const TMP_COLUMNS = ['SNo', 'MCID', 'CID', 'SCID', 'Vat', 'Code', 'Title', 'ShortDesc', 'FullDesc', 'KeyFeatures', 'UnitQty', 'Unit', 'StockIn', 'Images', 'MRP',
  'DAP', 'Discount', 'Deal', 'GroupName', 'Replacement', 'ProcSLA', 'COD', 'ShippCharge', 'Weight_kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'WarrInfo',
  'AllAttributes', 'ErrorReason'];
const COLUMN_TYPES = {
  SNo: 'Byte', MCID: 'Int64', CID: 'Int64', SCID: 'Int64', Vat: 'String', Code: 'String', Title: 'String', ShortDesc: 'String', FullDesc: 'String',
  KeyFeatures: 'String', UnitQty: 'Int32', Unit: 'String', StockIn: 'Int32', Images: 'String', MRP: 'Decimal', DAP: 'Decimal', Discount: 'Decimal',
  Deal: 'String', GroupName: 'String', Replacement: 'Int32', ProcSLA: 'Int32', COD: 'Boolean', ShippCharge: 'Decimal', Weight_kg: 'Decimal',
  Length_cms: 'Decimal', Breadth_cms: 'Decimal', Height_cms: 'Decimal', WarrInfo: 'Int32', AllAttributes: 'String', ErrorReason: 'String',
  TotalColumnCount: 'Int32', TotalRowsCount: 'Int32', TotalErrorCount: 'Int32', TotalSuccessCount: 'Int32', TotalRepeatCount: 'Int32',
  ErrorCode: 'String', ErrorDescription: 'String',
};

/** Restore the #TMP column names (PostgreSQL returns lower-case names). */
function restoreTmpRow(r) {
  const out = {};
  const lower = {};
  for (const k of Object.keys(r)) lower[k.toLowerCase()] = k;
  for (const col of TMP_COLUMNS) if (lower[col.toLowerCase()] !== undefined) out[col] = r[lower[col.toLowerCase()]];
  for (const k of Object.keys(r)) if (!TMP_COLUMNS.some((x) => x.toLowerCase() === k.toLowerCase())) out[k] = r[k];
  return out;
}

/**
 * ProductDal.InsertBulkProduct(BranchId, xml) => DataSet with the 3 result sets of usp_InsertBulkProduct:
 *   Tables[0] = Select * from #TMP, Tables[1] = the counters row, Tables[2] = select ErrorCode,ErrorDescription from ErrorCodeHandleing.
 * PORT-NOTE: the PostgreSQL function (and therefore the lib) returns only the first result set. When the lib returns a single table,
 * Tables[1] is rebuilt from it exactly as the procedure computes it (column count of #TMP, rows, ErrorReason != '' / = '', repeat = 0)
 * and Tables[2] is read from errorcodehandleing. An empty DataSet (database error swallowed by the lib) is returned unchanged.
 */
async function insertBulkProductDataSet(BranchId, XMLProductList) {
  const dal = new ProductDal();
  const ds = await dal.InsertBulkProduct(BranchId, XMLProductList);
  const tables = dsTables(ds);
  if (tables.length === 0) return { Tables: [] };
  if (tables.length >= 3) return { Tables: tables };
  const t0 = tables[0].map(restoreTmpRow);
  t0.Columns = t0.length ? Object.keys(t0[0]) : TMP_COLUMNS.slice();
  const t1 = [{
    TotalColumnCount: TMP_COLUMNS.length,
    TotalRowsCount: t0.length,
    TotalErrorCount: t0.filter((r) => r.ErrorReason !== null && r.ErrorReason !== undefined && String(r.ErrorReason) !== '').length,
    TotalSuccessCount: t0.filter((r) => r.ErrorReason !== null && r.ErrorReason !== undefined && String(r.ErrorReason) === '').length,
    TotalRepeatCount: 0,
  }];
  t1.Columns = Object.keys(t1[0]);
  let t2 = [];
  try {
    t2 = (await db.query(DB, 'select errorcode, errordescription from errorcodehandleing')).map((r) => ({ ErrorCode: r.errorcode, ErrorDescription: r.errordescription }));
  } catch (ex) {
    console.error(ex);
  }
  t2.Columns = ['ErrorCode', 'ErrorDescription'];
  return { Tables: [t0, t1, t2] };
}

/** .NET object.ToString() of an ExcelDataReader cell value */
function cellToString(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

/**
 * ExcelReaderFactory.CreateBinaryReader / CreateOpenXmlReader + IsFirstRowAsColumnNames = true + AsDataSet().
 * PORT-NOTE: ExcelDataReader is replaced by the npm package `xlsx` (lazy require, not installed). Every sheet becomes a table whose
 * first row gives the column names; numeric cells keep their raw value (dates stay Excel serial numbers).
 */
function readExcelDataSet(buffer) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const Tables = wb.SheetNames.map((n) => {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true, blankrows: true });
    const Columns = [];
    (aoa[0] || []).forEach((h, i) => {
      let name = h === null || h === undefined || String(h) === '' ? `Column${i}` : String(h);
      // DataTable column names must be unique (ExcelDataReader appends an index)
      let k = name; let n2 = 1;
      while (Columns.includes(k)) k = name + '_' + (n2++);
      name = k;
      Columns.push(name);
    });
    const rows = aoa.slice(1).map((r) => { const o = {}; Columns.forEach((col, i) => { o[col] = r[i] === undefined ? null : r[i]; }); return o; });
    rows.Columns = Columns;
    return rows;
  });
  return { Tables };
}

/** DataRow["col"] on a column that does not exist => ArgumentException */
function cell(table, row, col) {
  if (!tableColumns(table).includes(col)) {
    // DataRow lookup is case-insensitive when no exact match exists
    const k = tableColumns(table).find((x) => x.toLowerCase() === col.toLowerCase());
    if (k === undefined) throw new Error(`Column '${col}' does not belong to table .`);
    return cellToString(row[k]);
  }
  return cellToString(row[col]);
}

/** private string GenerateXMLProductList(DataSet result, string SellerCode) (Merchant_UploadBulkProduct.cs) */
function GenerateXMLProductList(result, SellerCode) {
  const tables = dsTables(result);
  if (!tables.length) throw new RangeError('Cannot find table 0.');
  const t0 = tables[0];
  const cols = tableColumns(t0);
  let Str = '';
  Str = '<Product>';
  for (let i = 1; i < t0.length; i++) {
    const r = t0[i];
    const g = (k) => cell(t0, r, k);
    if (g('MCID') !== '') {
      const cash = g('COD') === 'Available' ? '1' : '0';
      Str += '<Tr>';
      Str += '<SNo>' + g('SNo') + '</SNo>';
      Str += '<MCID>' + g('MCID') + '</MCID>';
      Str += '<CID>' + g('CID') + '</CID>';
      Str += '<SCID>' + g('SCID') + '</SCID>';
      Str += '<Vat>' + g('Vat') + '</Vat>';
      Str += '<Code>' + g('Code') + '</Code>';
      Str += '<Title>' + g('Title') + '</Title>';
      Str += '<ShortDesc>' + g('ShortDesc') + '</ShortDesc>';
      Str += '<FullDesc>' + g('FullDesc') + '</FullDesc>';
      Str += '<KeyFeatures>' + g('KeyFeatures') + '</KeyFeatures>';
      Str += '<UnitQty>' + g('UnitQty') + '</UnitQty>';
      Str += '<Unit>' + g('Unit') + '</Unit>';
      Str += '<StockIn>' + g('StockIn') + '</StockIn>';
      Str += '<Images>';
      let NewImages = '';
      for (const Img of g('Images').split('^')) NewImages += SellerCode + '_' + Img + '^';
      Str += NewImages.replace(/\^+$/, '');
      Str += '</Images>';
      Str += '<MRP>' + g('MRP') + '</MRP>';
      Str += '<DAP>' + g('DAP') + '</DAP>';
      Str += '<Discount>' + g('Discount') + '</Discount>';
      Str += '<Deal>' + g('Deal') + '</Deal>';
      Str += '<GroupName>' + g('GroupName') + '</GroupName>';
      Str += '<Replacement>' + g('Replacement') + '</Replacement>';
      Str += '<ProcSLA>' + g('ProcSLA') + '</ProcSLA>';
      Str += '<COD>' + cash + '</COD>';
      Str += '<ShippCharge>' + g('ShippCharge') + '</ShippCharge>';
      Str += '<Weight_kg>' + g('Weight_kg') + '</Weight_kg>';
      Str += '<Length_cms>' + g('Length_cms') + '</Length_cms>';
      Str += '<Breadth_cms>' + g('Breadth_cms') + '</Breadth_cms>';
      Str += '<Height_cms>' + g('Height_cms') + '</Height_cms>';
      Str += '<WarrInfo>' + g('WarrInfo') + '</WarrInfo>';
      Str += '<AllAttributes>';
      let Attribute = '';
      for (let j = 28; j < cols.length; j++) {
        const ColumnName = cols[j];
        if (ColumnName !== 'ErrorReason') Attribute += ColumnName + '~' + g(ColumnName) + '^';
      }
      Str += Attribute + '</AllAttributes>';
      g('ErrorReason');
      Str += '<ErrorReason>' + g('ErrorReason') + '</ErrorReason>';
      Str += '</Tr>';
    }
  }
  Str += '</Product>';
  return Str;
}

/** .NET column DataType: known usp_InsertBulkProduct columns, else inferred from the first non-null JS value. */
function columnType(rows, col) {
  if (COLUMN_TYPES[col]) return COLUMN_TYPES[col];
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
// EntireColumn validations are applied to this many rows (exceljs has no whole-column validation)
const COLUMN_ROWS = 1000;

/**
 * public string ExportExcelForReporting(DataSet ds) (Merchant_UploadBulkProduct.cs)
 * PORT-NOTE: Microsoft.Office.Interop.Excel is replaced by `exceljs` (lazy require, not installed => "Failed", as any legacy exception).
 * Whole-column validations/wrap are applied to the first COLUMN_ROWS rows; one worksheet per non-empty table named after SheetNames[i].
 * The sheet protection password is not copied from the C# (config.app.TemplateSheetPassword).
 */
async function ExportExcelForReporting(ds) {
  let ret = 'Failed';
  let ExcelSheet = null;
  let ExcelWorkBook = null;
  let maxRows = 0;
  try {
    const ExcelJS = require('exceljs');
    ExcelWorkBook = new ExcelJS.Workbook();
    const SheetNames = ['ProuductsUpload', 'TotalCount', 'ErrorCodeList'];
    const tables = dsTables(ds);
    if (!ds) throw c.NRE();
    for (let i = 0; i < tables.length; i++) {
      let p_dtData = null;
      if (tables[i].length > 0) {
        p_dtData = tables[i];
        ExcelSheet = ExcelWorkBook.addWorksheet('Sheet' + (i + 1));
      } else {
        continue;
      }
      const cols = tableColumns(p_dtData);
      const types = cols.map((k) => columnType(p_dtData, k));
      const isNum = (ci) => types[ci] === 'Int32' || types[ci] === 'Decimal';
      const colValidation = (ci, dv) => { for (let r = 1; r <= COLUMN_ROWS; r++) ExcelSheet.getCell(r, ci + 1).dataValidation = dv; };
      const typed = (ci, v) => {
        if (v === null || v === undefined) return v;
        if (['Int32', 'Int64', 'Decimal', 'Byte'].includes(types[ci]) && typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
        return v;
      };

      if (p_dtData.length > 500) maxRows = 500;
      else maxRows = p_dtData.length;

      for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
        for (let colIndex = 0; colIndex < cols.length; colIndex++) {
          let CellValue = typed(colIndex, p_dtData[rowIndex][cols[colIndex]]);
          const CellData = cellToString(CellValue);
          if (rowIndex === 0) {
            const HeaderName = cols[colIndex];
            ExcelSheet.getCell(rowIndex + 1, colIndex + 1).value = HeaderName;
            for (let k = colIndex + 1; k <= cols.length; k++) ExcelSheet.getColumn(k).width = HeaderName.length + 5;
            if (HeaderName === 'MCID' || HeaderName === 'CID' || HeaderName === 'SCID') {
              if (types[colIndex] === 'Int32') {
                colValidation(colIndex, { type: 'whole', operator: 'equal', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: [Number(CellValue)] });
              }
            } else if (HeaderName === 'Vat' || HeaderName === 'Deal' || HeaderName === 'GroupName') {
              if (CellData === '') CellValue = ' ';
              colValidation(colIndex, { type: 'list', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: ['"' + cellToString(CellValue) + '"'] });
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
                colValidation(colIndex, { type: 'list', allowBlank: false, showInputMessage: true, showErrorMessage: false, formulae: ['"' + cellToString(CellValue) + '"'] });
              }
            }
          }
          // Write row value into Excel cell
          if (CellData !== '') {
            if (CellData.split(',').length === 1) ExcelSheet.getCell(rowIndex + 2, colIndex + 1).value = CellValue;
          }
          const cl = ExcelSheet.getCell(rowIndex + 2, colIndex + 1);
          if (cols[colIndex] === 'mobile') {
            // no formatting
          } else if (types[colIndex] === 'DateTime') {
            cl.numFmt = 'mm-d-yy ';
          } else if (types[colIndex] === 'String') {
            cl.font = { ...(cl.font || {}), name: 'Arial Narrow', size: 11 };
          } else if (types[colIndex] === 'Single') {
            cl.numFmt = '0.00%';
          }
          ExcelSheet.getColumn(colIndex + 1).alignment = { wrapText: true };
        }
      }
      // ExcelSheet.Cells.Font.Color = Black
      ExcelSheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (x) => { x.font = { ...(x.font || {}), color: { argb: ARGB.Black } }; }));
      for (let k = 1; k <= cols.length; k++) {
        const h = ExcelSheet.getCell(1, k);
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.LightGray } };
        h.font = { ...(h.font || {}), bold: true, size: 15 };
        const d = ExcelSheet.getCell(2, k);
        d.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.Khaki } };
        d.font = { ...(d.font || {}), color: { argb: ARGB.Red } };
      }
      // ExcelApplication.Cells.Locked = false; rows 1 (header) and 2 (demo data) locked
      for (let k = 1; k <= cols.length; k++) ExcelSheet.getColumn(k).protection = { locked: false };
      ExcelSheet.getRow(1).protection = { locked: true };
      ExcelSheet.getRow(2).protection = { locked: true };

      if (i >= SheetNames.length) throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
      if (SheetNames[i] === 'ProuductsUpload') ExcelSheet.views = [{ state: 'frozen', xSplit: 5, ySplit: 0 }];
      ExcelSheet.name = SheetNames[i];
    }
    if (!ExcelSheet) throw c.NRE(); // ExcelSheet.Protect(...) on null
    await ExcelSheet.protect(String(config.app.TemplateSheetPassword || ''), {});

    let p = c.mapPath('~/Sheets/');
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    const filename = 'MaayasUploadProduct.xlsx';
    p = path.join(p, filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await ExcelWorkBook.xlsx.writeFile(p);
    ret = filename;
  } catch (ex) {
    ret = 'Failed';
  } finally {
    ExcelSheet = null;
    ExcelWorkBook = null;
  }
  return ret;
}

/** DateTime.ToString("dd-MMM-yyyy hh-mm-ss-tt") of a UTC time (ToUniversalTime()). */
function utcStamp(d = new Date()) {
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const p2 = (n) => String(n).padStart(2, '0');
  const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${p2(d.getUTCDate())}-${mon}-${d.getUTCFullYear()} ${p2(h12)}-${p2(d.getUTCMinutes())}-${p2(d.getUTCSeconds())}-${h < 12 ? 'AM' : 'PM'}`;
}

/** DirectoryInfo.GetFiles() (throws DirectoryNotFoundException like .NET when the folder is missing); newest CreationTime first. */
function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => {
    const full = path.join(dir, d.name);
    const st = fs.statSync(full);
    return { Name: d.name, FullName: full, Extension: path.extname(d.name), Length: st.size, CreationTime: st.birthtime, LastWriteTime: st.mtime, mode: st.mode };
  }).sort((a, b) => b.CreationTime - a.CreationTime);
}
/** DirectoryInfo.GetDirectories() */
function listDirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dir, d.name));
}
/** FileInfo as handed to the view (PORT-NOTE: physical FullName/DirectoryName are not exposed). */
const fileInfoJson = (f) => ({ Name: f.Name, Extension: f.Extension, Length: f.Length, CreationTime: f.CreationTime, LastWriteTime: f.LastWriteTime });

module.exports = {
  DB, mvcStr, trimChar, bindBool, bindDecimal, bindChar, strictInt32, totalOf, dsTables, EXCEL_PRODUCT_DETAIL, PRODUCT_FULL_DETAIL_DEFAULT,
  insertBulkProductDataSet, readExcelDataSet, GenerateXMLProductList, ExportExcelForReporting, utcStamp, listFiles, listDirs, fileInfoJson,
  mapPath: c2.mapPath,
};
