'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Merchant_NonLiveProduct.cs (Merchant_NonLiveProductController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Merchant_NonLiveProduct';

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() equivalent for one table */
function getXml(ds) {
  let x = '<NewDataSet>';
  for (const name of Object.keys(ds)) {
    for (const r of ds[name]) {
      x += `<${name}>`;
      for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== undefined) x += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
      x += `</${name}>`;
    }
  }
  return x + '</NewDataSet>';
}


const ProductDal = require('../../lib/franchise/ProductDal');
const EXCEL_PROPS = ['Id', 'MCID', 'CID', 'SCID', 'VCID', 'Code', 'ProductTitle', 'ShortDescription', 'FullDescription', 'KeyFeatures', 'UnitQty', 'Unit', 'StockIn',
  'WarrentyInfoCare', 'ProductImages', 'SellMRP', 'DAP', 'Discount', 'DealsIds', 'GroupId', 'ReplacementDay', 'ProcurementSLA', 'CashOnDelivery', 'ShippingCharges',
  'Weight_kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'ErrorReason', 'BranchId', 'CreatedDate', 'QCStatus', 'BranchName', 'MasterCategoryName', 'CategoryName',
  'SubCategoryName', 'VatCategoryName', 'VatValue', 'DealsName', 'GroupName'];

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  let { PrCode, search, filtercategory, page, ddlstatus } = req.p;
  if (PrCode == null) PrCode = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ddlstatus == null || ddlstatus === '') ddlstatus = -1; else ddlstatus = parseInt(ddlstatus, 10);
  const Plid = Number(req.user.did);
  const ViewBag = {};
  ViewBag.QCVerified = Number(await scalar(DB, 'select count(*) from excel_product where qcstatus=1 and branchid=@plid', { plid: Plid }));
  ViewBag.QCPending = Number(await scalar(DB, 'select count(*) from excel_product where qcstatus=0 and branchid=@plid', { plid: Plid }));
  ViewBag.QCFailed = Number(await scalar(DB, 'select count(*) from excel_product where qcstatus=2 and branchid=@plid', { plid: Plid }));
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_getall_excelproductlist', { startrowindex: page, maxrows: MaxRows, branchid: Plid, searchfield: search, searchvalue: PrCode, status: ddlstatus });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(rows);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.PrCode = PrCode;
  ViewBag.search = search;
  ViewBag.filtercategory = filtercategory;
  res.json({ Model: mapRows(rows, EXCEL_PROPS), ViewBag });
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);

// ---- ApproveAndNewSale ---------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/ApproveAndNewSale{/:id}`, auth, asyncHandler(async (req, res) => {
  let CheckIds = req.p.CheckIds;
  CheckIds = CheckIds.replace(/^,+|,+$/g, ''); // Trim(',')
  const Plid = Number(req.user.did);
  const dal = new ProductDal();
  const returnmess = await dal.ApproveAndNewSale(CheckIds, Plid);
  res.json(returnmess);
}));
// GenerateXMLProductList is private in C# (not an action)

module.exports = router;
