'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Stock_ManagementController.cs (Stock_ManagementController) - 2 actions: Index, ExportReport
 * DB: Db_Shopping => 'shopping'
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Stock_Management';
const PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'PV', 'Cashback_Per', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'PrSKUCode', 'IS_OFFER', 'productdetails'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const isEmpty = (v) => v === undefined || v === null || v === '';
const nz = (v) => (v === undefined ? null : v);
/** Regex.Replace(x.ToString(), "\t", "") + " \t"  (ToString() on null => NullReferenceException) */
const sp = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).replace(/\t/g, '') + ' \t'; };
/** Convert.ToDateTime(x).ToString("dd-MM-yyyy") */
const ddmmyyyy = (v) => {
  if (v === null || v === undefined) return '01-01-0001';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;
};

function ids(PrCode, SubPrCode, mprid, sprid) {
  let MPRIDs = isEmpty(PrCode) ? 0 : parseInt(PrCode, 10);
  let SPRIDs = isEmpty(SubPrCode) ? 0 : parseInt(SubPrCode, 10);
  MPRIDs = isEmpty(mprid) ? MPRIDs : parseInt(mprid, 10);
  SPRIDs = isEmpty(sprid) ? SPRIDs : parseInt(sprid, 10);
  return { MPRIDs, SPRIDs };
}

/** ExportReport body (throws like the legacy "catch { throw; }"). Sends the xls. */
async function exportReport(req, res, a) {
  const { MPRIDs, SPRIDs } = ids(a.PrCode, a.SubPrCode, a.mprid, a.sprid);
  const Plid = Number(req.user.plid);
  const page = a.page == null ? 1 : a.page;
  const rows = await proc(DB, 'usp_getall_productreadylist', {
    startrowindex: page, maxrows: 99999999, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: nz(a.filtercategory),
    searchfield: nz(a.search), searchvalue: nz(a.PrCode), status: nz(a.statusid), isstock: nz(a.stockfilter), formdate: nz(a.fromdate),
    todate: nz(a.todate), stockin: nz(a.allstock), productname: nz(a.ProductName),
  });
  const GetProductLists = mapRows(rows, PROPS);
  let out = '';
  ['S.No  ', 'Product Name  ', 'Product code  ', 'Category  ', 'Available Stock  ', 'Stock In  ', 'Stock Out  ', 'Created on ', 'Last Processed on  ']
    .forEach((h) => { out += h + '\t'; });
  for (const item of GetProductLists) {
    out += '\n';
    out += sp(item.rowNumber) + sp(item.ProductTitle) + sp(item.SubPrCode) + sp(item.Subcategory) + sp(item.stockNetQty) + sp(item.stockInQty) + sp(item.stockOutQty)
      + sp(ddmmyyyy(item.CreatedDate)) + sp(ddmmyyyy(item.ModifyDate));
  }
  const dir = path.join(config.uploadDir || path.join(process.cwd(), 'uploads'), 'AllExcelSheets');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'AllStock_Management.xls'), out);
  res.setHeader('Content-Type', 'application/force-download');
  res.setHeader('Content-Disposition', 'attachment; filename=AllStock_Management.xls');
  res.send(out);
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/Stock-Management
// auth ([SessionExpireCheck])
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/Stock-Management', '/merchant/merchant/Stock-Management'], auth, asyncHandler(async (req, res) => {
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, statusid, fromdate, todate, btnexel, allstock } = req.p;
  const toInt = (v) => (isEmpty(v) ? null : parseInt(v, 10));
  let stockfilter = toInt(req.p.stockfilter);
  let ddlstocklist = toInt(req.p.ddlstocklist);
  let ddlstocklist1 = toInt(req.p.ddlstocklist1);
  let page = toInt(req.p.page);
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  const { MPRIDs, SPRIDs } = ids(PrCode, SubPrCode, mprid, sprid);
  const Plid = Number(req.user.plid);
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = ''; // else legacy ProductName.Replace("'", "''") result is discarded
  if (statusid == null) statusid = '';
  if (allstock == null) allstock = '';
  if (ddlstocklist == null) ddlstocklist = 0;
  if (ddlstocklist1 == null) ddlstocklist1 = 0;
  if (ddlstocklist1 !== 0) stockfilter = ddlstocklist1;
  if (ddlstocklist !== 0) stockfilter = ddlstocklist;
  if (stockfilter == null) stockfilter = 0;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_getall_productreadylist', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: search,
    searchvalue: PrCode, status: statusid, isstock: stockfilter, formdate: fromdate, todate, stockin: allstock, productname: ProductName,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  if (btnexel === 'Export Excel') {
    await exportReport(req, res, { stockfilter, SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, page, statusid, ddlstocklist, fromdate, todate, allstock });
    return;
  }
  res.json({
    view: '~/Views/Stock_Management/Index.cshtml',
    Model: mapRows(rows, PROPS),
    ViewBag: {
      checkedval: allstock, statusid, fromDate: fromdate, toDate: todate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory,
      MPRID: MPRIDs, ddlstatus: ddlstocklist,
    },
  });
}));

// ---- ExportReport (public void action) -----------------------------------------------------------------
// auth
router.all(`/merchant/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  await exportReport(req, res, {
    stockfilter: isEmpty(p.stockfilter) ? null : parseInt(p.stockfilter, 10), SubPrCode: p.SubPrCode, PrCode: p.PrCode, mprid: p.mprid, sprid: p.sprid,
    ProductName: p.ProductName, NewAdd: p.NewAdd, search: p.search, filtercategory: p.filtercategory, page: isEmpty(p.page) ? null : parseInt(p.page, 10),
    statusid: p.statusid, ddlstocklist: isEmpty(p.ddlstocklist) ? null : parseInt(p.ddlstocklist, 10), fromdate: p.fromdate, todate: p.todate, allstock: p.allstock,
  });
}));

module.exports = router;
