'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/RejectedproductList.cs (RejectedproductListController)
 * Prefix: /merchant   DB: Merchant DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'RejectedproductList';

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


const PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname',
  'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages',
  'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty',
  'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'PV', 'Cashback_Per', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'PrSKUCode', 'IS_OFFER'];
/** Convert.ToInt64(string): FormatException on non-numeric */
function toInt64(v) {
  if (!/^\s*[+-]?\d+\s*$/.test(v)) throw new Error('Input string was not in a correct format.');
  return Number(v);
}

const indexHandler = asyncHandler(async (req, res) => {
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, page, ddlstatus } = req.p;
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = 0, SPRIDs = 0;
  MPRIDs = PrCode === '' ? 0 : toInt64(PrCode);
  SPRIDs = SubPrCode === '' ? 0 : toInt64(SubPrCode);
  MPRIDs = (mprid == null || mprid === '') ? MPRIDs : toInt64(mprid);
  SPRIDs = (sprid == null || sprid === '') ? SPRIDs : toInt64(sprid);
  const Plid = Number(req.user.plid);
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  if (ddlstatus == null || ddlstatus === '') ddlstatus = 1; else ddlstatus = parseInt(ddlstatus, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_getapprovedproductlist', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: search, searchvalue: PrCode,
    status: ddlstatus, isverfied: 2,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, PrCode, SubPrCode,
      SPRID: SPRIDs, NewAdd, search, filtercategory, MPRID: MPRIDs,
    },
  });
});
// auth
// route-config: merchant/Rejected-product
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/Rejected-product{/:id}'], auth, indexHandler);

module.exports = router;
