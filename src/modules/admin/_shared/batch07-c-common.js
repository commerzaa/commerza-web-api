'use strict';
/**
 * Helpers private to admin port batch07 part C (Franchise controllers). Not a router (lives in _shared/).
 * Exports: nn(params), totalOut(rows, name), firstCol(rows), PRODUCT_TYPE_PROPS, BindProductType(), FPD_PROPS,
 *          exportFranchisePackage(req, res, ViewBag, url, fromDate, toDate, ProductType)
 */
const db = require('../../../db');
const { mapRows } = require('../../../utils/shape');
const { col, str } = require('./batch07-common');

const DB = 'affiliate';

/**
 * `new SqlParameter("@X", null)` => the parameter is NOT sent (SqlClient skips a null Value), so the procedure default is used.
 * Removes null/undefined entries so PostgreSQL named notation also falls back to the function default.
 */
function nn(params) {
  const o = {};
  for (const k of Object.keys(params)) if (params[k] !== null && params[k] !== undefined) o[k] = params[k];
  return o;
}

/**
 * Convert.ToInt32(<OUT param>.Value[.ToString()]) for a paging total that the PG function returns as a column of every row.
 * PORT-NOTE: with no result rows the OUT value is not visible in PostgreSQL => 0 (the procedures set it to the row count, i.e. 0).
 * DBNull on a returned row => FormatException/InvalidCastException like legacy.
 */
function totalOut(rows, name) {
  if (!rows || rows.length === 0) return 0;
  const s = str(col(rows[0], name));
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

/** Database.SqlQuery<string>(...).FirstOrDefault(): first column of the first row (null when no row). */
function firstCol(rows) {
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  const k = Object.keys(r)[0];
  const v = k === undefined ? null : r[k];
  return v === null || v === undefined ? null : String(v);
}

/** class ProductType (Controllers/AdminPanel/FranchisePackage.cs) */
const PRODUCT_TYPE_PROPS = ['FIMID', 'NAME'];

/**
 * ProductType.BindProductType(): [DBO].[USP_PRODUCTTYPE] (SELECT FIMID,Name FROM TBL_FRANCHIDMASTER).
 * Used by Views/AdminPanel/FranchisePackage/Index.cshtml and Invertory_StockLedger/Index.cshtml (dropdown "ProductTypeList").
 * catch => `throw ExpObj` (the ErrorInsert block after the throw is unreachable in legacy) => errors propagate.
 * ToList() is never null => the `return null` branch is unreachable.
 */
async function BindProductType() {
  const Producttype = mapRows(await db.proc(DB, 'USP_PRODUCTTYPE', {}), PRODUCT_TYPE_PROPS);
  if (Producttype !== null) return Producttype;
  return null;
}

/** class FranchisePackageDetails (Controllers/AdminPanel/FranchisePackage.cs) */
const FPD_PROPS = ['ROWNUMBER', 'FPMID', 'FIMID', 'FranchiseType', 'Status', 'MinAmount', 'MaxAmount', 'Commission', 'DISCRIPTION', 'Title'];

/**
 * public void ExportReport(string fromDate, string toDate, string ProductType) - identical body in FranchisePackage.cs (Franchise_PackageController)
 * and FranchiseLedger.cs (copy/paste: the ledger controller exports the FRANCHISE PACKAGE list).
 * Returns true when the download was written to `res`.
 */
async function exportFranchisePackage(req, res, ViewBag, url, fromDate, toDate, ProductType) {
  const { excelHistory, nowStamp, writeXlsExport, tab, dec2, nullRef } = require('./batch07-common');
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'Franchise_Package' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename); // [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE='1',@STRRESULT OUT
  // DBO.UPS_GetFranchisePackage @ProductType,@fromDate,@toDate,@STARTROWINDEX=1,@MAXROWS=999999,@TotalRecord out
  const objAlltList = mapRows(await db.proc(DB, 'UPS_GetFranchisePackage', nn({
    ProductType, fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 999999,
  })), FPD_PROPS);
  if (objAlltList.length > 0) {
    let srno = 1;
    const r = await writeXlsExport({
      req, res, sheet: 'Franchise_Package.xls', downloadName: ' Franchise_Package.xls', Filename, ViewBag,
      headers: ['S.No.', 'FRANCHISE TYPE', 'MIN AMOUNT', 'MAX AMOUNT', 'COMMISSION %', 'STATUS'],
      rows: objAlltList, innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        const s = (v) => { if (v === null || v === undefined) throw nullRef(); return String(v); };
        w('\n');
        w(tab(String(srno)) + ' \t');
        w(tab(s(item.FranchiseType)) + ' \t');
        w(tab(dec2(item.MinAmount)) + ' \t');
        w(tab(dec2(item.MaxAmount)) + ' \t');
        // PORT-NOTE: decimal.ToString() kept the SQL scale (e.g. "5.00"); JS prints the plain number.
        w(tab(s(item.Commission)) + ' \t');
        w(tab(Number(item.Status) === 1 ? 'Active' : 'Deactive') + ' \t');
        srno += 1;
      },
    });
    return r.sent;
  }
  return false;
}

module.exports = { nn, totalOut, firstCol, PRODUCT_TYPE_PROPS, BindProductType, FPD_PROPS, exportFranchisePackage };
