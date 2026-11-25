'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\AllNdnList.cs (AllNdnListController)
 * Actions: Index, ExportReport (2)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const GETPRODUCTLIST_PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms',
  'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'EMAILID', 'PHONE', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount',
  'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty',
  'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate'];

const s = (v) => (v === null || v === undefined ? '' : String(v));
const strip = (v) => `${s(v).replace(/\t/g, '')} \t`;
const toInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const toBig = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10));
const totalOf = (rows) => {
  const f = rows && rows[0];
  const v = f ? (f.totalcount !== undefined ? f.totalcount : f.recordcount) : 0;
  return parseInt(v === null || v === undefined ? 0 : v, 10) || 0;
};

async function ExportReport(res, req, a) {
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, page, statusid, ddlstocklist, fromdate, todate } = a;
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = PrCode === '' ? 0 : toBig(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toBig(SubPrCode);
  MPRIDs = (mprid === undefined || mprid === null || mprid === '') ? MPRIDs : toBig(mprid);
  SPRIDs = (sprid === undefined || sprid === null || sprid === '') ? SPRIDs : toBig(sprid);
  const Plid = 0;
  const DID = toBig(req.user.did);
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  if (statusid == null) statusid = '';
  if (ddlstocklist == null) ddlstocklist = 0;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  try {
    if (page == null) page = 1;
    const rows = await db.proc(DB, 'USP_GETALL_PRODUCTREADYLIST', {
      STARTROWINDEX: page, MAXROWS: 99999999, MPRID: MPRIDs, SPRID: SPRIDs, BRANCHID: Plid, CAT_CODE: filtercategory, SEARCHFIELD: search, SEARCHVALUE: PrCode,
      STATUS: statusid, ISSTOCK: ddlstocklist, FORMDATE: fromdate, TODATE: todate, STOCKIN: '', PRODUCTNAME: ProductName, CATEGORYRELATEDTO: '2', DID,
    });
    const list = mapRows(rows, GETPRODUCTLIST_PROPS);
    let out = '';
    out += 'SNo \t';
    out += 'Prdouct Name \t';
    out += 'Prdouct Code \t';
    out += 'Sub Category \t';
    out += 'Status \t';
    out += 'Stock In \t';
    out += 'Stock Out \t';
    out += 'Stock Available \t';
    out += 'Sell Mrp \t';
    out += 'Discount \t';
    out += 'Selling price \t';
    out += 'GST % \t';
    out += 'Date';
    for (const Item of list) {
      out += '\n';
      out += strip(Item.rowNumber);
      out += strip(Item.ProductTitle);
      out += strip(Item.SubPrCode);
      out += strip(`${s(Item.Subcategory)} ${s(Item.maincatname)}`);
      const status = Item.IsVerified;
      let IsVerified = '';
      if (status === 0) IsVerified = 'Inactive';
      if (status === 1) IsVerified = 'Active';
      if (status === 2) IsVerified = 'Blocked';
      out += strip(IsVerified);
      out += strip(Item.stockInQty);
      out += strip(Item.stockOutQty);
      out += strip(Item.stockNetQty);
      out += strip(Item.sellMRP);
      out += strip(Item.Discountpercentage);
      out += strip(Item.DAP);
      out += `${s(Item.Mvat).replace(/\t/g, '')}\t`;
      out += strip(Item.CreatedDate);
    }
    // PORT-NOTE: legacy wrote /AllExcelSheets/AllNdnList.xls but redirected to AllProductList.xls; the generated content is streamed directly under that download name.
    res.setHeader('Content-Type', 'application/force-download');
    res.setHeader('Content-Disposition', 'attachment; filename=AllProductList.xls');
    res.send(out);
    return true;
  } catch (ex) {
    return false;
  }
}

// route-config
// auth
router.all(['/franchise/AllNdnList/Index{/:id}', '/franchise/franchisee/AllNdnlist'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, statusid, fromdate, todate, btnexel, allstock } = p;
  let stockfilter = toInt(p.stockfilter);
  let page = toInt(p.page);
  let ddlstocklist = toInt(p.ddlstocklist);
  let ddlstocklist1 = toInt(p.ddlstocklist1);
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = PrCode === '' ? 0 : toBig(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toBig(SubPrCode);
  MPRIDs = (mprid === undefined || mprid === null || mprid === '') ? MPRIDs : toBig(mprid);
  SPRIDs = (sprid === undefined || sprid === null || sprid === '') ? SPRIDs : toBig(sprid);
  const Plid = 0;
  const DID = toBig(req.user.did);
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
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
  const rows = await db.proc(DB, 'USP_GETALL_PRODUCTREADYLIST_F', {
    STARTROWINDEX: page, MAXROWS: MaxRows, MPRID: MPRIDs, SPRID: SPRIDs, BRANCHID: Plid, CAT_CODE: filtercategory, SEARCHFIELD: search, SEARCHVALUE: PrCode,
    STATUS: statusid, ISSTOCK: stockfilter, FORMDATE: fromdate, TODATE: todate, STOCKIN: allstock, PRODUCTNAME: ProductName, CATEGORYRELATEDTO: '2', DID,
  });
  const GetProductLists = mapRows(rows, GETPRODUCTLIST_PROPS);
  const ViewBag = {
    checkedval: allstock, statusid, fromDate: fromdate, toDate: todate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord: totalOf(rows),
    NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory, MPRID: MPRIDs, ddlstatus: ddlstocklist,
  };
  if (btnexel === 'Export Excel') {
    const done = await ExportReport(res, req, { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, page, statusid, ddlstocklist, fromdate, todate });
    if (done) return undefined;
  }
  return res.json({ Model: GetProductLists, ViewBag });
}));

// auth
router.all('/franchise/AllNdnList/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const done = await ExportReport(res, req, { SubPrCode: p.SubPrCode, PrCode: p.PrCode, mprid: p.mprid, sprid: p.sprid, ProductName: p.ProductName, NewAdd: p.NewAdd,
    search: p.search, filtercategory: p.filtercategory, page: toInt(p.page), statusid: p.statusid, ddlstocklist: toInt(p.ddlstocklist), fromdate: p.fromdate, todate: p.todate });
  if (!done) res.status(200).end();
}));

module.exports = router;
