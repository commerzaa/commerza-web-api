'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/ManageAffiliateBonusController.cs (ManageAffiliateBonusController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'   (class level [SessionExpireCheck] => every route is auth)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { proc, procOne, exec } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/ManageAffiliateBonus';

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const isEmpty = (v) => v === null || v === undefined || v === '';
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? null : row[k];
}
/** Convert.ToInt32 / Convert.ToInt64 (throws on malformed input) */
function toInt(v) {
  const n = Number(String(v).trim());
  if (!Number.isInteger(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
/** Convert.ToDateTime(x).ToString("dd-MM-yyyy") */
function fmtDate(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  const p2 = (n) => String(n).padStart(2, '0');
  return p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear();
}
/** req.p value or body property (case-insensitive) */
function bget(req, name) {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const k = Object.keys(b).find((x) => x.toLowerCase() === name.toLowerCase());
  if (k !== undefined) return b[k];
  return req.p ? req.p[name] : undefined;
}

// GetProductList (AllProductlist.cs) / AffiliateProducts model property names
const GETPRODUCTLIST_PROPS = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal',
  'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount',
  'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty',
  'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'PV', 'Cashback_Per', 'Rejectremark', 'Weight_kg', 'Subcategory',
  'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'PrSKUCode', 'IS_OFFER'];
const AFFILIATEPRODUCTS_PROPS = ['DAP', 'IsStock', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode',
  'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'rowNumber', 'sellMRP', 'SPRID', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode',
  'VatTitle', 'IsActive', 'JP', 'BV', 'PV', 'Cashback_Per', 'REMARK', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate',
  'Request_date', 'Re_request_date', 'ismerchantstatus', 'PrSKUCode', 'IS_AFFILIATE_ENABLE', 'IS_OFFER', 'IS_AFFILIATE', 'BONUS_TYPE', 'BONUS_VALUE',
  'REDEEM_AFTER_DAYS', 'STATUS', 'ABPID'];

/** sets @TotalCount OUT: read from the "totalcount" column of the first row (0 when no rows) */
const totalOf = (rows) => (rows && rows.length ? Number(rows[0].totalcount || 0) : 0);

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all([`${P}/Index{/:id}`, P], auth, asyncHandler(async (req, res) => {
  const { startrow, mprid, sprid, cat_code, searchfield, searchvalue, status, isstock, fromdate, todate, stockin, productname } = req.p;
  const Plid = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_getall_productreadylist', {
    startrowindex: isEmpty(startrow) ? 0 : toInt(startrow), maxrows: MaxRows, mprid: mprid ?? null, sprid: sprid ?? null, branchid: Plid,
    cat_code: cat_code ?? null, searchfield: searchfield ?? null, searchvalue: searchvalue ?? null, status: status ?? null,
    isstock: isstock ?? null, formdate: fromdate ?? null, todate: todate ?? null, stockin: stockin ?? null, productname: productname ?? null,
  });
  void totalOf(rows); // int TotalRecord = int.Parse(spOutput.Value.ToString());
  res.json({ Model: mapRows(rows, GETPRODUCTLIST_PROPS) });
}));

// ---- List (POST) ---------------------------------------------------------------------------------------
// auth
router.post(`${P}/List{/:id}`, auth, asyncHandler(async (req, res) => {
  const filter = req.body || {};
  const g = (n) => bget(req, n);
  const Plid = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_getall_productreadylist', {
    startrowindex: Number(g('STARTROWINDEX') || 0), maxrows: MaxRows, mprid: Number(g('MPRID') || 0), sprid: Number(g('SPRID') || 0), branchid: Plid,
    cat_code: g('CAT_CODE') ?? null, searchfield: g('SEARCHFIELD') ?? null, searchvalue: g('SEARCHVALUE') ?? null, status: g('STATUS') ?? null,
    isstock: Number(g('ISSTOCK') || 0), formdate: g('FORMDATE') ?? null, todate: g('TODATE') ?? null, stockin: g('STOCKIN') ?? null,
    productname: g('PRODUCTNAME') ?? null,
  });
  void filter; void totalOf(rows);
  // legacy: return View(); (no model)
  res.json({});
}));

// ---- Plist ---------------------------------------------------------------------------------------------
async function ExportReport(req, res, a) {
  let MPRIDs = isEmpty(a.PrCode) ? 0 : toInt(a.PrCode);
  let SPRIDs = isEmpty(a.SubPrCode) ? 0 : toInt(a.SubPrCode);
  MPRIDs = isEmpty(a.mprid) ? MPRIDs : toInt(a.mprid);
  SPRIDs = isEmpty(a.sprid) ? SPRIDs : toInt(a.sprid);
  const Plid = req.user.plid;
  let page = a.page;
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_getall_productreadylist', {
    startrowindex: page, maxrows: 99999999, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: a.filtercategory, searchfield: a.search,
    searchvalue: a.PrCode, status: a.statusid, isstock: a.stockfilter, formdate: a.fromdate, todate: a.todate, stockin: a.allstock, productname: a.ProductName,
  });
  const list = mapRows(rows, GETPRODUCTLIST_PROPS);
  const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'AllStock_Management.xls');
  let out = '';
  out += 'S.No  \t';
  out += 'Product Name  \t';
  out += 'Product code  \t';
  out += 'Category  \t';
  out += 'Available Stock  \t';
  out += 'Stock In  \t';
  out += 'Stock Out  \t';
  out += 'Created on \t';
  out += 'Last Processed on  \t';
  const nt = (v) => s(v).replace(/\t/g, '');
  for (const item of list) {
    out += '\n';
    out += nt(item.rowNumber) + ' \t';
    out += nt(item.ProductTitle) + ' \t';
    out += nt(item.SubPrCode) + ' \t';
    out += nt(item.Subcategory) + ' \t';
    out += nt(item.stockNetQty) + ' \t';
    out += nt(item.stockInQty) + ' \t';
    out += nt(item.stockOutQty) + ' \t';
    out += nt(fmtDate(item.CreatedDate)) + ' \t';
    out += nt(fmtDate(item.ModifyDate)) + ' \t';
  }
  fs.writeFileSync(filepath, out);
  // PORT-NOTE: legacy redirected to ~/AllExcelSheets/AllStock_Management.xls; the content is sent directly as the download
  res.set('Content-Type', 'application/force-download');
  res.set('Content-Disposition', 'attachment; filename=AllStock_Management.xls');
  res.send(out);
}

// auth
router.all(`${P}/Plist{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, statusid, fromdate, todate, btnexel, allstock } = p;
  let stockfilter = isEmpty(p.stockfilter) ? null : toInt(p.stockfilter);
  let page = isEmpty(p.page) ? null : toInt(p.page);
  let ddlstocklist = isEmpty(p.ddlstocklist) ? null : toInt(p.ddlstocklist);
  let ddlstocklist1 = isEmpty(p.ddlstocklist1) ? null : toInt(p.ddlstocklist1);
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = isEmpty(PrCode) ? 0 : toInt(PrCode);
  let SPRIDs = isEmpty(SubPrCode) ? 0 : toInt(SubPrCode);
  MPRIDs = isEmpty(mprid) ? MPRIDs : toInt(mprid);
  SPRIDs = isEmpty(sprid) ? SPRIDs : toInt(sprid);
  const Plid = req.user.plid;
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
  const rows = await proc(DB, 'usp_getall_productreadylist_for_affiliate', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: search,
    searchvalue: PrCode, status: statusid, isstock: stockfilter, formdate: fromdate, todate, stockin: allstock, productname: ProductName,
  });
  const GetProductLists = mapRows(rows, AFFILIATEPRODUCTS_PROPS);
  const TotalRecord = totalOf(rows);
  const ViewBag = {
    checkedval: allstock,
    statusid,
    fromDate: fromdate,
    toDate: todate,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductName,
    PrCode,
    SubPrCode,
    SPRID: SPRIDs,
    NewAdd,
    search,
    filtercategory,
    MPRID: MPRIDs,
    ddlstatus: ddlstocklist,
  };
  if (btnexel === 'Export Excel') {
    return ExportReport(req, res, { stockfilter, SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory, page, statusid, ddlstocklist, fromdate, todate, allstock });
  }
  return res.json({ Model: GetProductLists, ViewBag });
}));

// ---- ExportReport (public void action) ---------------------------------------------------------------------
// auth
router.all(`${P}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  await ExportReport(req, res, {
    stockfilter: isEmpty(p.stockfilter) ? null : toInt(p.stockfilter), SubPrCode: p.SubPrCode, PrCode: p.PrCode, mprid: p.mprid, sprid: p.sprid,
    ProductName: p.ProductName, NewAdd: p.NewAdd, search: p.search, filtercategory: p.filtercategory, page: isEmpty(p.page) ? null : toInt(p.page),
    statusid: p.statusid, ddlstocklist: isEmpty(p.ddlstocklist) ? null : toInt(p.ddlstocklist), fromdate: p.fromdate, todate: p.todate, allstock: p.allstock,
  });
}));

// ---- saveBonusData ---------------------------------------------------------------------------------------
// auth (legacy Json() without AllowGet => POST only in MVC; kept as router.all like other actions)
router.all(`${P}/saveBonusData{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = req.user.plid;
  const products = bget(req, 'PRODUCTS');
  const row = await procOne(DB, 'usp_save_affiliate_bonus', {
    bonus_type: bget(req, 'BONUS_TYPE') ?? null,
    bonus_value: bget(req, 'BONUS_VALUE') ?? null,
    redeedays: bget(req, 'REDEEM_DAYS') ?? null,
    sprids: (Array.isArray(products) ? products : []).map((x) => (x && (x.SPRID ?? x.sprid))).join(','),
    created_by: Plid,
    status: 'W', // CommonEnum.AffiliateBonusAddStatus.WAITING_FOR_ACTION
  });
  const result = parseInt(s(outVal(row, 'out_result')), 10);
  const message = s(outVal(row, 'out_message'));
  res.json({ Status: result, Message: message });
}));

// ---- UpdateReRequest ---------------------------------------------------------------------------------------
// ManageAffiliateData.UpdateRequest (DAL/ManageAffiliateData.cs) ported inline
async function UpdateRequest(model) {
  const row = await procOne(DB, 'usp_update_affiliate_bonus', {
    abpid: model.ABPID, bonus_type: model.BONUS_TYPE, bonus_value: model.BONUS_VALUE, redeedays: model.REDEEM_DAYS, sprid: model.SPRID,
    created_by: model.CREATED_BY, status: model.STATUS,
  });
  const st = outVal(row, 'out_status');
  const rs = outVal(row, 'out_result');
  return {
    STATUS: st === true || st === 1 || st === 't' || st === 'true',
    RESULT: parseInt(rs === null || rs === undefined ? 0 : rs, 10),
    MESSAGE: outVal(row, 'out_message'),
  };
}

// auth
router.all(`${P}/UpdateReRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const model = {
    ABPID: parseInt(bget(req, 'ABPID'), 10) || 0,
    SPRID: parseInt(bget(req, 'SPRID'), 10) || 0,
    BONUS_TYPE: bget(req, 'BONUS_TYPE'),
    BONUS_VALUE: bget(req, 'BONUS_VALUE'),
    REDEEM_DAYS: bget(req, 'REDEEM_DAYS'),
    CREATED_BY: 0,
    STATUS: '',
  };
  let response = { STATUS: false, RESULT: 0, MESSAGE: null };
  if (!isEmpty(model.BONUS_TYPE) && !isEmpty(model.BONUS_VALUE) && !isEmpty(model.REDEEM_DAYS)) {
    model.CREATED_BY = Math.trunc(Number(req.user.plid));
    model.STATUS = 'Q'; // CommonEnum.AffiliateBonusAddStatus.RE_Request
    response = await UpdateRequest(model);
  }
  res.json(response);
}));

// ---- EnableDisable (POST) --------------------------------------------------------------------------------
// auth
router.post(`${P}/EnableDisable{/:id}`, auth, asyncHandler(async (req, res) => {
  const action = req.p.action;
  const ABPID = parseInt(req.p.ABPID, 10);
  let isEnable = false;
  if (s(action).toLowerCase() === 'enable') {
    isEnable = true;
  } else if (s(action).toLowerCase() === 'disable') {
    isEnable = false;
  } else {
    return res.json({ Status: false, Message: 'Something went wrong' });
  }
  const rowsAffected = await exec(DB, 'update affiliate_bonus_on_product set is_active = @isEnable where abpid = @abpid', { isEnable, abpid: ABPID });
  if (rowsAffected > 0) return res.json({ Status: true, Message: 'Updated Successfully!' });
  return res.json({ Status: false, Message: 'not Updated Something went wrong!' });
}));

module.exports = router;
