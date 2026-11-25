'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/AllProductlist.cs (AllProductlistController). DB: Db_Shopping => 'shopping'
 * C# methods (all public => routed): deactivateProduct, Index, DataSearchnew, DataSearch, ExportReport, transferProduct, UpdateDeals,
 *   UpdateStock, checksellingpricelist, editallproductlist, DeletesingleProduct, saveImage, Updatesingleproduct, UpdateStatuslist,
 *   GetAttributedata, _Offer (16).
 * Derived from src/modules/franchise/AllProductlist.js; merchant differences: Session Plid (BranchId) instead of DID, proc
 * USP_GETALL_PRODUCTREADYLIST (15 args, no @CATEGORYRELATEDTO/@DID) instead of USP_GETALL_PRODUCTREADYLIST_F, "Multiple" filter,
 * Excel proc call with 13 args, Updatesingleproduct with images/BV/PV/CASHBACK/attributes/unit/activation PV, push notification
 * on activation, and the extra actions DeletesingleProduct, saveImage, GetAttributedata, _Offer.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../../db');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const PushNotificationRepo = require('../../lib/merchant/PushNotificationRepo');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/AllProductlist';

// C# model property lists (SqlQuery<T> => mapRows)
const GPL = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'PV', 'Cashback_Per', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus', 'PrSKUCode', 'IS_OFFER'];
const PDL = ['SPRID', 'SubPrCode', 'ShotDescription', 'FullDescription', 'KeyFeatures', 'DiscountPercentage', 'DAP', 'Weight_Kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'ShippingCharges', 'stockIn', 'SellMRP', 'IsVerified', 'ProductTitle', 'ismerchantstatus', 'Fullfilmentby', 'Procurementtype', 'ProcurementSLA', 'HSN', 'LuxuryCess', 'ManufacturerDetails', 'ImporterDetails', 'PackerDetails', 'CountryOrigin', 'VATTITLE', 'Specification', 'ProductImages', 'SubCategoryId', 'Unit', 'Attributedata', 'VATPERCENTAGE', 'BV', 'PV', 'Cashback_Per', 'ACTIVATIONPV_PER'];
const SPL = ['Rownumber', 'categoryname', 'Localprice', 'Zonalprice', 'Nationalprice', 'Metro'];
const ATTR = ['ROWNUMBER', 'DID', 'DIDNAME', 'VALUE', 'isSelectiveAttr'];
const OFFER = ['OPID', 'PRODUCT_ID', 'PRODUCT_NAME', 'OFFER_MST_ID', 'OFFER_TITLE', 'OFFER_START', 'OFFER_END', 'START_TIME', 'END_TIME', 'IS_ACTIVE', 'INSERTED_ON', 'OFFER_PRICE', 'OFFER_DIS_PERCENTAGE'];
const DDL = ['ID', 'VALUE', 'TEXT'];

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const FMT = () => new Error('Input string was not in a correct format.');
const isNE = (v) => v === undefined || v === null || v === '';
const str = (v) => (v === undefined || v === null ? '' : String(v));
const nn = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); };
const rep = (s, a, b) => String(s).split(a).join(b);
const toInt64 = (s) => { const t = String(s).trim(); if (!/^[+-]?\d+$/.test(t)) throw FMT(); return Number(t); };
// Convert.ToInt16/ToInt32(string): null => 0, otherwise strict parse
const convInt = (v) => (v === null || v === undefined ? 0 : toInt64(v));
// non-nullable MVC binding (int / Int64 / decimal) - missing or invalid => binding exception
const req = (v, name, decimal = false) => {
  const t = v === undefined || v === null ? '' : String(v).trim();
  const ok = decimal ? /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) : /^[+-]?\d+$/.test(t);
  if (!ok) throw new Error(`The parameters dictionary contains a null entry for parameter '${name}'`);
  return Number(t);
};
// int? binding: missing/invalid => null
const optInt = (v) => (isNE(v) || !/^[+-]?\d+$/.test(String(v).trim()) ? null : parseInt(v, 10));
const tabSafe = (v) => str(v).replace(/\t/g, '');
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// DataSet.GetXml() equivalent (table dsData; NULL columns omitted)
const dsXml = (rows) => (!rows.length ? '<NewDataSet />'
  : '<NewDataSet>' + rows.map((r) => '<dsData>' + Object.keys(r).filter((k) => r[k] !== null && r[k] !== undefined)
    .map((k) => `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`).join('') + '</dsData>').join('') + '</NewDataSet>');

// common PrCode/SubPrCode/mprid/sprid handling of Index and ExportReport
function ids(p) {
  const PrCode = p.PrCode == null ? '' : p.PrCode;
  const SubPrCode = p.SubPrCode == null ? '' : p.SubPrCode;
  let MPRIDs = isNE(PrCode) ? 0 : toInt64(PrCode);
  let SPRIDs = isNE(SubPrCode) ? 0 : toInt64(SubPrCode);
  MPRIDs = isNE(p.mprid) ? MPRIDs : toInt64(p.mprid);
  SPRIDs = isNE(p.sprid) ? SPRIDs : toInt64(p.sprid);
  return { PrCode, SubPrCode, MPRIDs, SPRIDs };
}

// ---- deactivateProduct --------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${P}/deactivateProduct{/:id}`, auth, asyncHandler(async (req_, res) => {
  const { paramType } = req_.p;
  const paramID = req(req_.p.paramID, 'paramID');
  const status = req(req_.p.status, 'status');
  let returnval = '';
  try {
    if (paramType === 'mainProd') {
      const mainrow = await db.queryOne(DB, 'select mprid from ims_masterproduct where mprid = @id limit 1', { id: paramID });
      if (!mainrow) return res.json('No Such Product Exists');
      await db.exec(DB, 'update ims_subproduct set isactive = false where mprid = @id and isactive = true', { id: mainrow.mprid });
    }
    if (paramType === 'subProd') {
      const subrow = await db.queryOne(DB, 'select sprid, isactive from ims_subproduct where sprid = @id limit 1', { id: paramID });
      if (!subrow) return res.json('No Such Sub Product Exists');
      if (status === 0) {
        if (subrow.isactive === true) return res.json('Sub Product is already activated');
        await db.exec(DB, 'update ims_subproduct set isactive = true where sprid = @id', { id: paramID });
        returnval = 'active';
      } else {
        if (subrow.isactive === false) return res.json('Sub Product is already activated');
        await db.exec(DB, 'update ims_subproduct set isactive = false, isverified = 2 where sprid = @id', { id: paramID });
        returnval = 'deactive';
      }
    }
    return res.json(returnval);
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// ---- ExportReport (public void) -------------------------------------------------------------------------------------
// Builds AllProductList.xls (tab separated) exactly like the legacy StreamWriter output, writes it to
// <uploadDir>/AllExcelSheets/AllProductList.xls and returns its content (null when the legacy catch swallowed an exception).
async function ExportReport(req_, a) {
  let { PrCode, SubPrCode, ProductName, NewAdd, search, filtercategory, page, statusid, ddlstocklist, fromdate, todate } = a;
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  const MPRIDs0 = isNE(PrCode) ? 0 : toInt64(PrCode);
  const SPRIDs0 = isNE(SubPrCode) ? 0 : toInt64(SubPrCode);
  const MPRIDs = isNE(a.mprid) ? MPRIDs0 : toInt64(a.mprid);
  const SPRIDs = isNE(a.sprid) ? SPRIDs0 : toInt64(a.sprid);
  const Plid = Number(req_.user.plid);
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  if (statusid == null) statusid = '';
  if (ddlstocklist == null) ddlstocklist = 0;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  try {
    const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
    if (page == null) page = 1;
    // DBO.USP_GETALL_PRODUCTREADYLIST (13 args: @STOCKIN/@PRODUCTNAME/@CATEGORYRELATEDTO/@DID use their defaults)
    const rows = await db.proc(DB, 'usp_getall_productreadylist', {
      startrowindex: page, maxrows: 99999999, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory,
      searchfield: search, searchvalue: PrCode, status: statusid, isstock: ddlstocklist, formdate: fromdate, todate,
    });
    const GetProductListsexcel = mapRows(rows, GPL);
    let body = '';
    body += 'SNo \t';
    body += 'Prdouct Name \t';
    body += 'Prdouct Code \t';
    body += 'Sub Category \t';
    body += 'Status \t';
    body += 'Stock In \t';
    body += 'Stock Out \t';
    body += 'Stock Available \t';
    body += 'Sell Mrp \t';
    body += 'Discount \t';
    body += 'Selling price \t';
    body += 'GST % \t';
    body += 'Date';
    for (const item of GetProductListsexcel) {
      body += '\n';
      body += tabSafe(item.rowNumber) + ' \t';
      body += nn(item.ProductTitle).replace(/\t/g, '') + ' \t';
      body += nn(item.SubPrCode).replace(/\t/g, '') + ' \t';
      const Subcategory = str(item.Subcategory) + ' ' + str(item.maincatname);
      body += tabSafe(Subcategory) + ' \t';
      const status = Number(item.IsVerified);
      let IsVerified = '';
      if (status === 0) IsVerified = 'Inactive';
      if (status === 1) IsVerified = 'Active';
      if (status === 2) IsVerified = 'Blocked';
      body += tabSafe(IsVerified) + ' \t';
      body += tabSafe(item.stockInQty) + ' \t';
      body += tabSafe(item.stockOutQty) + ' \t';
      body += tabSafe(item.stockNetQty) + ' \t';
      body += tabSafe(item.sellMRP) + ' \t';
      body += tabSafe(item.Discountpercentage) + ' \t';
      body += tabSafe(item.DAP) + ' \t';
      body += tabSafe(item.Mvat) + '\t';
      body += nn(item.CreatedDate).replace(/\t/g, '') + ' \t';
    }
    // PORT-NOTE: legacy wrote ~/AllExcelSheets/AllProductList.xls and Response.Redirect-ed to it (forced download headers);
    // the same file is written under config.uploadDir/AllExcelSheets and its content is sent directly as the download.
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'AllProductList.xls');
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    fs.writeFileSync(filepath, body, 'utf8');
    return body;
  } catch (ex) {
    return null; // legacy: catch (Exception ex) { } - swallowed
  }
}
function sendExcel(res, file) {
  res.set('Content-Type', 'application/force-download');
  res.set('Content-Disposition', 'attachment; filename=AllProductList.xls');
  return res.send(file);
}
const exportArgs = (p) => ({
  SubPrCode: p.SubPrCode, PrCode: p.PrCode, mprid: p.mprid, sprid: p.sprid, ProductName: p.ProductName, NewAdd: p.NewAdd,
  search: p.search, filtercategory: p.filtercategory, page: optInt(p.page), statusid: p.statusid, ddlstocklist: optInt(p.ddlstocklist),
  fromdate: p.fromdate, todate: p.todate,
});

// ---- Index ------------------------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req_, res) => {
  const p = req_.p;
  const { PrCode, SubPrCode, MPRIDs, SPRIDs } = ids(p);
  const Plid = Number(req_.user.plid);
  const NewAdd = p.NewAdd == null ? '' : p.NewAdd;
  const search = p.search == null ? '' : p.search;
  const filtercategory = p.filtercategory == null ? '' : p.filtercategory;
  const ProductName = p.ProductName == null ? '' : p.ProductName; // legacy: ProductName.Replace("'", "''") result discarded
  const statusid = p.statusid == null ? '' : p.statusid;
  const allstock = p.allstock == null ? '' : p.allstock;
  let ddlstocklist = optInt(p.ddlstocklist);
  let ddlstocklist1 = optInt(p.ddlstocklist1);
  let stockfilter = optInt(p.stockfilter);
  if (ddlstocklist === null) ddlstocklist = 0;
  if (ddlstocklist1 === null) ddlstocklist1 = 0;
  if (ddlstocklist1 !== 0) stockfilter = ddlstocklist1;
  if (ddlstocklist !== 0) stockfilter = ddlstocklist;
  if (stockfilter === null) stockfilter = 0;
  const fromdate = p.fromdate == null ? '' : p.fromdate;
  const todate = p.todate == null ? '' : p.todate;
  const Multiple = p.Multiple;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = optInt(p.page);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_getall_productreadylist', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory, searchfield: search,
    searchvalue: PrCode, status: statusid, isstock: stockfilter, formdate: fromdate, todate, stockin: allstock, productname: ProductName,
  });
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row (0 when no rows)
  let TotalRecord = rows.length && rows[0].totalcount != null ? parseInt(rows[0].totalcount, 10) : 0;
  let GetProductLists = mapRows(rows, GPL);
  if (!isNE(Multiple)) {
    GetProductLists = GetProductLists.filter((x) => x.ProductTitle === ProductName);
    TotalRecord = GetProductLists.length;
  }
  const ViewBag = {
    checkedval: allstock, statusid, fromDate: fromdate, toDate: todate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory,
    MPRID: MPRIDs, ddlstatus: ddlstocklist,
  };
  if (p.btnexel === 'Export Excel') {
    const a = exportArgs(p);
    // Index passes its normalised values (page defaulted, ddlstocklist defaulted, strings defaulted)
    Object.assign(a, { SubPrCode, PrCode, ProductName, NewAdd, search, filtercategory, page, statusid, ddlstocklist, fromdate, todate });
    const file = await ExportReport(req_, a);
    if (file !== null) return sendExcel(res, file); // legacy Response.Redirect to the xls ends the request
  }
  res.json({ view: '~/Views/AllProductlist/Index.cshtml', Model: GetProductLists, ViewBag, ...ViewBag });
});
// route-config: merchant/AllProductlist -> AllProductlist/Index
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/merchant/AllProductlist', '/merchant/merchant/AllProductlist'], auth, indexHandler);

// ---- DataSearchnew ---------------------------------------------------------------------------------------------------
// auth (legacy: no session check; protected because it is a merchant-panel lookup)
router.all(`${P}/DataSearchnew{/:id}`, auth, asyncHandler(async (req_, res) => {
  const SearchText = rep(nn(req_.p.SearchText), '+apostopis', "'");
  // PORT-NOTE: UtilityClass.GetDataSetSPNamed used the merchant Db_Shopping connection; called directly on 'shopping' here
  res.json(dsXml(await db.proc(DB, 'usp_getproductdatasearch_productlist', { serchitem: SearchText })));
}));

// ---- DataSearch ------------------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${P}/DataSearch{/:id}`, auth, asyncHandler(async (req_, res) => {
  const BranchId = Number(req_.user.plid);
  const SearchText = rep(nn(req_.p.SearchText), '+apostopis', "'");
  res.json(dsXml(await db.proc(DB, 'usp_getproductdatasearch', { serchitem: SearchText, branchid: BranchId })));
}));

// ---- ExportReport (public void action) ------------------------------------------------------------------------------
// auth (reads Session Plid)
router.all(`${P}/ExportReport{/:id}`, auth, asyncHandler(async (req_, res) => {
  const file = await ExportReport(req_, exportArgs(req_.p));
  if (file === null) return res.status(200).end(); // void action, exception swallowed => empty response
  return sendExcel(res, file);
}));

// ---- transferProduct ----------------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${P}/transferProduct{/:id}`, auth, asyncHandler(async (req_, res) => {
  const MPRID = req(req_.p.MPRID, 'MPRID');
  const { paramType } = req_.p;
  const paramID = req(req_.p.paramID, 'paramID');
  try {
    const MainRow = await db.queryOne(DB, 'select mprid, maincategoryid, catid from ims_masterproduct where mprid = @id limit 1', { id: MPRID });
    if (!MainRow) throw NRE();
    const upd = { subcategoryid: 0, maincategoryid: MainRow.maincategoryid, catid: MainRow.catid };
    if (paramType === 'subcat') {
      const subcatrow = await db.queryOne(DB, 'select subcatid, catid from tbl_sub_category where subcatid = @id and status = true limit 1', { id: paramID });
      if (!subcatrow) return res.json('No Such Sub Category Exists');
      const catrow = await db.queryOne(DB, 'select catid, maincatid from tbl_category where catid = @id and status = true limit 1', { id: subcatrow.catid });
      if (!catrow) return res.json('No Such Category Exists');
      const maincatrow = await db.queryOne(DB, 'select maincatid from tbl_main_category where maincatid = @id and status = true limit 1', { id: catrow.maincatid });
      if (!maincatrow) return res.json('No Such Main Category Exists');
      upd.subcategoryid = subcatrow.subcatid;
      upd.maincategoryid = maincatrow.maincatid;
    }
    if (paramType === 'cat') {
      const catrow = await db.queryOne(DB, 'select catid, maincatid from tbl_category where catid = @id and status = true limit 1', { id: paramID });
      if (!catrow) return res.json('No Such Category Exists');
      const maincatrow = await db.queryOne(DB, 'select maincatid from tbl_main_category where maincatid = @id and status = true limit 1', { id: catrow.maincatid });
      if (!maincatrow) return res.json('No Such Main Category Exists');
      upd.catid = catrow.catid;
      upd.maincategoryid = maincatrow.maincatid;
    }
    await db.exec(DB, 'update ims_masterproduct set subcategoryid = @sc, maincategoryid = @mc, catid = @c where mprid = @id',
      { sc: upd.subcategoryid, mc: upd.maincategoryid, c: upd.catid, id: MPRID });
    return res.json('ok');
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// ---- UpdateDeals --------------------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${P}/UpdateDeals{/:id}`, auth, asyncHandler(async (req_, res) => {
  const SPRID = req(req_.p.SPRID, 'SPRID');
  let ret = 'NotOk';
  const pms = await db.queryOne(DB, 'select sprid, dealsids from ims_subproduct where sprid = @id limit 1', { id: SPRID });
  if (!pms) throw NRE();
  const DealsIds = nn(req_.p.DealsIds).replace(/^,+|,+$/g, ''); // DealsIds.Trim(',')
  // EF SaveChanges() returns 0 when no property value changed
  let count = 0;
  if (pms.dealsids !== DealsIds) count = await db.exec(DB, 'update ims_subproduct set dealsids = @d where sprid = @id', { d: DealsIds, id: SPRID });
  if (count > 0) ret = 'ok';
  res.json(ret);
}));

// ---- UpdateStock --------------------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${P}/UpdateStock{/:id}`, auth, asyncHandler(async (req_, res) => {
  let ret = 'NotOk';
  const sprid = convInt(req_.p.SPRID);
  const pms = await db.queryOne(DB, 'select stockin, stocknet, isoutofstock from ims_subproduct where sprid = @id limit 1', { id: sprid });
  if (!pms) throw NRE();
  const add = convInt(req_.p.StockIn);
  const StockIn = Number(pms.stockin) + add;
  const StockNEt = Number(pms.stocknet) + add;
  const IsOutOfStock = !(StockNEt > 0);
  let count = 0;
  // EF SaveChanges() returns 0 when no property value changed
  if (StockIn !== Number(pms.stockin) || StockNEt !== Number(pms.stocknet) || IsOutOfStock !== pms.isoutofstock) {
    count = await db.exec(DB, 'update ims_subproduct set stockin = @si, stocknet = @sn, isoutofstock = @oos where sprid = @id',
      { si: StockIn, sn: StockNEt, oos: IsOutOfStock, id: sprid });
  }
  if (count > 0) ret = 'ok';
  res.json(ret);
}));

// ---- checksellingpricelist ----------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${P}/checksellingpricelist{/:id}`, auth, asyncHandler(async (req_, res) => {
  const sellprice = req(req_.p.sellprice, 'sellprice', true);
  const rows = await db.proc(DB, 'usp_getsellingpricelist', { sprid: req_.p.sprid, selingprice: sellprice });
  res.json(mapRows(rows, SPL));
}));

// USP_UPDATEALLPRODUCTLIST @MODE=2,@SPRID,0,0,0,0,0,0,0,0,0,0,'','','',''  (shared by editallproductlist and _Offer)
async function productDetail(SPRID) {
  // PORT-NOTE: the positional literals are passed by name; the 4th empty string was the @STRRESULT OUT slot.
  const rows = await db.proc(DB, 'usp_updateallproductlist', {
    mode: 2, sprid: SPRID, isverified: 0, sellmrp: 0, discount: 0, dap: 0, stockin: 0, length: 0, breadth: 0, weight: 0, height: 0,
    shippingcharges: 0, shortdesc: '', keyfeatures: '', fulldesc: '',
  });
  return mapRows(rows, PDL).map((r) => {
    if (r.SPRID === undefined || r.SPRID === null) r.SPRID = 0; // C#: public Int64 SPRID { get; set; } = 0;
    r.offer = null;
    return r;
  });
}

// ---- editallproductlist --------------------------------------------------------------------------------------------------
// auth (legacy: no session check; merchant product data)
router.all(`${P}/editallproductlist{/:id}`, auth, asyncHandler(async (req_, res) => {
  const SPRID = req(req_.p.SPRID, 'SPRID');
  res.json(await productDetail(SPRID));
}));

// ---- DeletesingleProduct ---------------------------------------------------------------------------------------------------
// auth (legacy: no session check; deletes merchant product)
router.all(`${P}/DeletesingleProduct{/:id}`, auth, asyncHandler(async (req_, res) => {
  const SPRID = req(req_.p.SPRID, 'SPRID');
  const r = await db.procOne(DB, 'usp_deletesingleproduct', { sprid: SPRID });
  // PORT-NOTE: @STROUTPUT OUT read from the 'stroutput' column; Convert.ToString(DBNull) => ""
  res.json(str(r ? r.stroutput : ''));
}));

// ---- INLINE LIB: merchant UtilityClass.ImageUploadMasterMethodECommNew 6-arg overload + ResizeImage --------------------------
// (src/lib/merchant/UtilityClass -> src/lib/UtilityClass only has the 3-arg overload; merchant enum ImageMode {Thumbnail, SemiLarge, Original, Both})
const MImageMode = { Thumbnail: 0, SemiLarge: 1, Original: 2, Both: 3 };
const lazySharp = () => { try { return require('sharp'); } catch (_) { return null; } };
const mapFolder = (p) => path.join(config.uploadDir, String(p || '').replace(/^[~/\\]+/, '')); // Server.MapPath
// public static void ResizeImage(string FullName, double scaleFactor, double filesize, MemoryStream fromstream, string Folder)
async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  const sharp = lazySharp();
  fs.mkdirSync(path.dirname(FullName), { recursive: true });
  if (filesize > 100) { // KB
    if (!sharp) {
      // PORT-NOTE: sharp not installed - original bytes saved without the resize / JPEG(quality 70) re-encode.
      fs.writeFileSync(FullName, fromstream);
      return;
    }
    const meta = await sharp(fromstream).metadata();
    const originalWidth = meta.width; const originalHeight = meta.height;
    let maxWidth = 515; let maxHeight = 832; const quality = 70;
    if (Folder !== '' && Folder === 'FullImage') { maxWidth = 652; maxHeight = 832; } else if (Folder !== '' && Folder === 'SemiLarge') { maxWidth = 479; maxHeight = 612; } else if (Folder !== '' && Folder === 'ThumbNail') { maxWidth = 235; maxHeight = 300; }
    const ratioX = Math.fround(maxWidth / originalWidth);
    const ratioY = Math.fround(maxHeight / originalHeight);
    const ratio = Math.min(ratioX, ratioY);
    const newWidth = Math.trunc(originalWidth * ratio);
    const newHeight = Math.trunc(originalHeight * ratio);
    const out = await sharp(fromstream).resize(newWidth, newHeight, { fit: 'fill' }).flatten({ background: '#000000' }).jpeg({ quality }).toBuffer();
    fs.writeFileSync(FullName, out);
  } else {
    fs.writeFileSync(FullName, fromstream); // image.Save(FullName)
  }
}
// .NET DateTime.Now.ToString("ddMMyyyyhhmmssffffff")
function netStamp() {
  const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return p2(d.getDate()) + p2(d.getMonth() + 1) + d.getFullYear() + p2(h12) + p2(d.getMinutes()) + p2(d.getSeconds()) + String(d.getMilliseconds() * 1000).padStart(6, '0');
}
async function ImageUploadMasterMethodECommNew(ImageBase64Code, OriginalImage, SemiLargeImage, ThumbNailImage, IMode, IdForAppend) {
  const Orginial_Folder_Path = mapFolder(OriginalImage);
  const SemiLarge_Folder_Path = mapFolder(SemiLargeImage);
  const Thumb_Folder_Path = mapFolder(ThumbNailImage);
  let RealImageName = '';
  const code = nn(ImageBase64Code);
  if (code.trim() !== '' && code.includes('base64,')) {
    let Base64String = '';
    let ImageExt = '';
    if (code !== '') {
      Base64String = code;
      let Image = String(100000 + Math.floor(Math.random() * 900000)); // Generator.Next(100000, 1000000)
      Image = Image.trim();
      Image = rep(Image, '&amp;', 'And');
      Image = rep(Image, '&', ' And ');
      Image = Image.replace(/[^\w\d]/g, '');
      Image = rep(Image, ' ', '-');
      RealImageName = str(IdForAppend) + Image + '_' + netStamp() + '.jpg';
    } else {
      RealImageName = ' ';
    }
    if (Base64String.includes('base64,')) {
      const IndexNo = Base64String.indexOf('/') + 1;
      const lastIndexNo = Base64String.indexOf(';');
      ImageExt = Base64String.substring(IndexNo, lastIndexNo); void ImageExt;
      const IndexNo1 = Base64String.indexOf(',') + 1;
      Base64String = Base64String.substring(IndexNo1);
      const ByteArray = Buffer.from(Base64String, 'base64');
      let filesize = ByteArray.length;
      filesize = filesize / 1024;
      const sharp = lazySharp();
      if (sharp) await sharp(ByteArray).metadata(); // Image.FromStream: throws on invalid image data
      if (IMode === MImageMode.Original || IMode === MImageMode.Both) {
        const p = Orginial_Folder_Path + '/' + RealImageName;
        if (fs.existsSync(p)) fs.unlinkSync(p);
        await ResizeImage(p, 0.25, filesize, ByteArray, 'FullImage');
      }
      if (IMode === MImageMode.SemiLarge || IMode === MImageMode.Both) {
        const p = SemiLarge_Folder_Path + '/' + RealImageName;
        if (fs.existsSync(p)) fs.unlinkSync(p);
        await ResizeImage(p, 0.25, filesize, ByteArray, 'SemiLarge');
      }
      if (IMode === MImageMode.Thumbnail || IMode === MImageMode.Both) {
        const p = Thumb_Folder_Path + '/' + RealImageName;
        if (fs.existsSync(p)) fs.unlinkSync(p);
        await ResizeImage(p, 0.25, filesize, ByteArray, 'ThumbNail');
      }
    } else {
      RealImageName = code.replace(/^\/+/, ''); // TrimStart('/')
    }
  } else if (code.trim() !== '' && !code.includes('base64,')) {
    RealImageName = path.win32.basename(code.trim());
  }
  return RealImageName;
}

// ---- saveImage (public string method; also used by Updatesingleproduct) ---------------------------------------------------
async function saveImage(imgecode, titlename, SellerCode) {
  const OriginalImageFolder = config.app.OriginalProductImage || '';
  const SemiLargeImageFolder = config.app.SemiLargeProductImage || '';
  const ThumbNailImageFolder = config.app.ThumbNailProductImage || '';
  titlename = nn(titlename).replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  const getcolltionimage = nn(imgecode).split('^');
  for (const items of getcolltionimage) {
    let IdForAppend = '';
    IdForAppend = str(SellerCode) + '_' + titlename.trim();
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = str(await ImageUploadMasterMethodECommNew(items, OriginalImageFolder, SemiLargeImageFolder, ThumbNailImageFolder, MImageMode.Both, IdForAppend));
      if (getnewfilename.trim() !== '') {
        if (returnfilename.trim() === '') returnfilename = getnewfilename;
        else returnfilename = returnfilename + '^' + getnewfilename;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      const fname = path.win32.basename(items); // System.IO.Path.GetFileName
      if (returnfilename.trim() === '') returnfilename = fname;
      else returnfilename = returnfilename + '^' + fname;
    }
  }
  return returnfilename;
}
// auth (public string action)
router.all(`${P}/saveImage{/:id}`, auth, asyncHandler(async (req_, res) => {
  res.type('text/plain').send(await saveImage(req_.p.imgecode, req_.p.titlename, req_.p.SellerCode));
}));

// ---- Updatesingleproduct ([ValidateInput(false)]) -------------------------------------------------------------------------
// auth (reads Session Plid as SellerCode)
router.all(`${P}/Updatesingleproduct{/:id}`, auth, asyncHandler(async (req_, res) => {
  const p = req_.p;
  // non-nullable decimal parameters (binding)
  const discount = req(p.discount, 'discount', true);
  const DAP = req(p.DAP, 'DAP', true);
  const Length = req(p.Length, 'Length', true);
  const Breadth = req(p.Breadth, 'Breadth', true);
  const Weight = req(p.Weight, 'Weight', true);
  const Height = req(p.Height, 'Height', true);
  const ShippingCharges = req(p.ShippingCharges, 'ShippingCharges', true);
  const spid = optInt(p.spid);
  const BV = p.BV === undefined ? '0.00' : p.BV;
  const PV = p.PV === undefined ? '0.00' : p.PV;
  const CASHBACK = p.CASHBACK === undefined ? '0.00' : p.CASHBACK;
  const ActivationPV = isNE(p.ActivationPV) ? 0 : req(p.ActivationPV, 'ActivationPV', true);

  let fullDesc = nn(p.fullDesc);
  fullDesc = rep(fullDesc, '+#!#+', '<');
  fullDesc = rep(fullDesc, '+!#!+', '>');
  let specification = nn(p.specification);
  specification = rep(specification, '+#!#+', '<');
  specification = rep(specification, '+!#!+', '>');
  let KeyFeatures = nn(p.KeyFeatures);
  KeyFeatures = rep(KeyFeatures, '+#!#+', '<');
  KeyFeatures = rep(KeyFeatures, '+!#!+', '>');

  const imageByteCode = rep(nn(p.imageByteCode), 'hariOmNamahshivay', '^');
  let productimagename = '';
  const SellerCode = String(req_.user.plid);
  productimagename = await saveImage(imageByteCode, spid === null ? '' : String(spid), SellerCode);

  const row = await db.procOne(DB, 'usp_updateallproduct', {
    mode: 1, sprid: spid, isverified: convInt(p.IsVerified), sellmrp: p.mrp, discount, dap: DAP, stockin: convInt(p.Stock),
    length: Length, breadth: Breadth, weight: Weight, height: Height, shippingcharges: ShippingCharges, shortdesc: p.ShortDesc,
    keyfeatures: KeyFeatures, fulldesc: fullDesc, image: '', manufacturingdetail: p.manufacturingdetail, importerdetail: p.importerdetail,
    packerdetail: p.packerdetail, gst: p.gst, procurementtype: p.procurementtype, fullfilmentseller: p.fullfilmentseller,
    procurementsla: p.procurementsla, hsn: p.hsn, luxurycess: p.luxurycess, countryorigin: '', specification, bv: BV, pv: PV,
    cashback: CASHBACK, prodimages: productimagename, allattributes: p.Attributes, produnit: p.prodUnit, activationpointvalue: ActivationPV,
  });
  // PORT-NOTE: @strresult OUT read from the 'strresult' column of the result row (DBNull.ToString() => "")
  const OutputResult = str(row ? row.strresult : '');
  res.json(OutputResult);
}));

// ---- UpdateStatuslist -------------------------------------------------------------------------------------------------------
// auth (legacy: no session check; changes merchant product status)
router.all(`${P}/UpdateStatuslist{/:id}`, auth, asyncHandler(async (req_, res) => {
  const activinactiv = req(req_.p.activinactiv, 'activinactiv');
  let Result = 0;
  const tokens = nn(req_.p.isSelected).split(',');
  const _pnrepo = new PushNotificationRepo();
  let status = activinactiv;
  for (let i = 0; i < tokens.length - 1; i++) {
    // legacy: "select StockNet from IMS_SubProduct where sprid= '" + tokens[i] + "'" (concatenated; bound here)
    const sn = await db.scalar(DB, 'select stocknet from ims_subproduct where sprid::varchar = @s limit 1', { s: String(tokens[i]).trim() });
    const StockNet = sn === null || sn === undefined ? 0 : Number(sn);
    if (StockNet > 0) {
      const r = await db.procOne(DB, 'usp_updateprdouctcount', { sprid: tokens[i], status });
      Result = r && r.intresult != null ? Number(r.intresult) : 0;
    } else if (activinactiv > 1) {
      const r = await db.procOne(DB, 'usp_updateprdouctcount', { sprid: tokens[i], status });
      Result = r && r.intresult != null ? Number(r.intresult) : 0;
    } else {
      Result = 4;
      status = 4;
    }
    if (status === 1) {
      await _pnrepo.NotificationMarking('Product', convInt(tokens[i]));
    }
  }
  void Result;
  res.json(status);
}));

// ---- GetAttributedata -------------------------------------------------------------------------------------------------------
// auth (legacy: no session check; merchant panel lookup)
router.all(`${P}/GetAttributedata{/:id}`, auth, asyncHandler(async (req_, res) => {
  const rows = await db.proc(DB, 'getallattributelist', { subcatid: req_.p.Subcatid });
  res.json(mapRows(rows, ATTR));
}));

// ---- _Offer (PartialView) ---------------------------------------------------------------------------------------------------
// auth (legacy: no session check; merchant product data)
router.all(`${P}/_Offer{/:id}`, auth, asyncHandler(async (req_, res) => {
  const SPRID = req_.p.SPRID;
  const OfferTypelist = mapRows(await db.query(DB, 'select cast(offerid as varchar) as value, offer_title as text from tbl_offer_mst where is_active = true'), DDL);
  if (SPRID === '') throw FMT(); // Convert.ToInt64("") throws; Convert.ToInt64(null) => 0
  const pobj = await productDetail(SPRID === null || SPRID === undefined ? 0 : toInt64(SPRID));
  const offerRows = await db.proc(DB, 'usp_manage_offer', {
    flag: 'Single_Offer_data', product_id: !isNE(SPRID) ? toInt64(SPRID) : 0, product_name: '', offer_title: '', offer_mst_id: 0,
    offer_start: '1990-01-01', offer_end: '1990-01-01', is_active: false, offer_price: 0, offer_discount_per: 0,
  });
  const offer = mapRows(offerRows, OFFER)[0] || null;
  if (offer !== null) {
    if (!pobj.length) throw NRE(); // pobj.FirstOrDefault().offer
    pobj[0].offer = offer;
  }
  res.json({ view: '_Offer', Model: pobj, ViewBag: { OfferTypelist } });
}));

module.exports = router;
