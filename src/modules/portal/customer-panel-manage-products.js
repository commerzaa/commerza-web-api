'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Manage_Products.cs (class Manage_ProductsController; DB: Db_Shopping)
// Started from src/modules/merchant/manage-products.js; portal differences: class GetProductList (no IsVerified/JP/BV/...), ddlstatus default 1,
// deactivateProduct does not touch IsVerified, UpdateStock does not set ModifyDate, no UpdateLessStock action.
// Tables: ims_masterproduct (Product_Master_Main), ims_subproduct (Product_Master_Sub), tbl_sub_category, tbl_category, tbl_main_category
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Manage_Products';

// class GetProductList (portal Manage_Products.cs)
const GETPRODUCTLIST = ['Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms',
  'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages',
  'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty',
  'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'Weight_kg'];
const isTrue = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';
const isFalse = (v) => v === false || v === 0 || v === '0' || v === 'f' || v === 'false';
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlVal = (v) => {
  if (v instanceof Date) return v.toISOString().replace('Z', '+00:00');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
};

// auth ([SessionExpireCheck])
router.all(`${P}/DataSearch{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const BranchId = Number(req.user.plid);
  let SearchText = req.p.SearchText;
  if (c.isNull(SearchText)) throw c.NRE();
  SearchText = c.csReplace(SearchText, '+apostopis', "'");
  // objdut.GetDataSetSPNamed(param, "usp_GetProductDataSearch", "dsData") then ds.GetXml()
  const rows = await db.proc(DB, 'usp_getproductdatasearch', { serchitem: SearchText, branchid: BranchId });
  // DataSet.GetXml(): <NewDataSet><dsData><col>value</col>...</dsData>...</NewDataSet>  (DataSet name "NewDataSet", DBNull columns omitted)
  // PORT-NOTE: GetXml element order/format reproduced for plain columns; column names are the lower-case PostgreSQL names.
  let xml = '<NewDataSet>';
  for (const r of rows) {
    xml += '\r\n  <dsData>';
    for (const k of Object.keys(r)) {
      if (c.isNull(r[k])) continue;
      xml += `\r\n    <${k}>${xmlEsc(xmlVal(r[k]))}</${k}>`;
    }
    xml += '\r\n  </dsData>';
  }
  xml += rows.length ? '\r\n</NewDataSet>' : '</NewDataSet>';
  if (!rows.length) xml = '<NewDataSet />';
  res.json(xml);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/deactivateProduct{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const paramType = req.p.paramType;
  const paramID = c.bindInt(req, 'paramID');
  const status = c.bindInt(req, 'status');
  let returnval = '';
  try {
    if (paramType === 'mainProd') {
      const mainrow = await db.queryOne(DB, 'select mprid from ims_masterproduct where mprid = @id limit 1', { id: paramID });
      if (!mainrow) return res.json('No Such Product Exists');
      await db.exec(DB, 'update ims_subproduct set isactive = false where mprid = @mprid and isactive = true', { mprid: mainrow.mprid });
    }
    if (paramType === 'subProd') {
      const subrow = await db.queryOne(DB, 'select sprid, isactive from ims_subproduct where sprid = @id limit 1', { id: paramID });
      if (!subrow) return res.json('No Such Sub Product Exists');
      if (status === 0) {
        if (isTrue(subrow.isactive)) return res.json('Sub Product is already activated');
        await db.exec(DB, 'update ims_subproduct set isactive = true where sprid = @id', { id: subrow.sprid });
        returnval = 'active';
      } else {
        // legacy message typo kept ("already activated" for the deactivate branch)
        if (isFalse(subrow.isactive)) return res.json('Sub Product is already activated');
        await db.exec(DB, 'update ims_subproduct set isactive = false where sprid = @id', { id: subrow.sprid });
        returnval = 'deactive';
      }
    }
    return res.json(returnval);
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// auth ([SessionExpireCheck])
// route-config: merchant/manage-product -> Manage_Products/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/manage-product'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let { SubPrCode, PrCode, ProductName, NewAdd, search, filtercategory } = req.p;
  const { mprid, sprid } = req.p;
  let page = c.bindNullableInt(req, 'page');
  let ddlstatus = c.bindNullableInt(req, 'ddlstatus');
  if (c.isNull(PrCode)) PrCode = '';
  if (c.isNull(SubPrCode)) SubPrCode = '';
  let MPRIDs = (PrCode === '' ? 0 : c.toInt64(PrCode));
  let SPRIDs = (SubPrCode === '' ? 0 : c.toInt64(SubPrCode));
  MPRIDs = (c.isNull(mprid) || mprid === '' ? MPRIDs : c.toInt64(mprid));
  SPRIDs = (c.isNull(sprid) || sprid === '' ? SPRIDs : c.toInt64(sprid));
  const Plid = Number(req.user.plid);
  if (c.isNull(NewAdd)) NewAdd = '';
  if (c.isNull(search)) search = '';
  if (c.isNull(filtercategory)) filtercategory = '';
  if (c.isNull(ProductName)) ProductName = '';
  if (ddlstatus === null) ddlstatus = 1;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_getall_productlist', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory,
    searchfield: search, searchvalue: PrCode, status: ddlstatus,
  });
  const GetProductLists = mapRows(rows, GETPRODUCTLIST);
  // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 when no rows).
  const TotalRecord = c.toInt32(rows.length ? rows[0].totalcount : 0);
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory, MPRID: MPRIDs,
  };
  return c.viewJson(res, '~/Views/CustomerPanel/Manage_Products/Index.cshtml', GetProductLists, ViewBag);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/transferProduct{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const MPRID = c.bindInt(req, 'MPRID', 'System.Int64');
  const paramType = req.p.paramType;
  const paramID = c.bindInt(req, 'paramID');
  try {
    const MainRow = await db.queryOne(DB, 'select mprid from ims_masterproduct where mprid = @id limit 1', { id: MPRID });
    if (!MainRow) throw c.NRE();
    const upd = { subcategoryid: 0 };
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
    // column names are fixed identifiers (never request values)
    const sets = Object.keys(upd).map((k) => `${k} = @${k}`).join(', ');
    await db.exec(DB, `update ims_masterproduct set ${sets} where mprid = @mprid`, { ...upd, mprid: MPRID });
    return res.json('ok');
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// auth ([SessionExpireCheck])
router.all(`${P}/UpdateDeals{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const SPRID = c.bindInt(req, 'SPRID', 'System.Int64');
  const DealsIds = req.p.DealsIds;
  let ret = 'NotOk';
  const pms = await db.queryOne(DB, 'select dealsids from ims_subproduct where sprid = @id limit 1', { id: SPRID });
  if (!pms) throw c.NRE();
  if (c.isNull(DealsIds)) throw c.NRE();
  const newVal = String(DealsIds).replace(/^,+|,+$/g, '');
  // EF SaveChanges returns the number of modified entities (0 when nothing changed)
  let count = 0;
  if (pms.dealsids !== newVal) count = await db.exec(DB, 'update ims_subproduct set dealsids = @d where sprid = @id', { d: newVal, id: SPRID });
  if (count > 0) ret = 'ok';
  res.json(ret);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/UpdateStock{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let ret = 'NotOk';
  const sprid = c.toInt64(req.p.SPRID);
  const pms = await db.queryOne(DB, 'select stockin, stocknet, isoutofstock from ims_subproduct where sprid = @id limit 1', { id: sprid });
  if (!pms) throw c.NRE();
  const add = c.toInt32(req.p.StockIn);
  const StockIn = Number(pms.stockin) + add;
  const StockNEt = Number(pms.stocknet) + add;
  const IsOutOfStock = !(StockNEt > 0);
  // EF only saves (and counts) when a tracked value changed
  let count = 0;
  if (StockIn !== Number(pms.stockin) || StockNEt !== Number(pms.stocknet) || IsOutOfStock !== isTrue(pms.isoutofstock)) {
    count = await db.exec(DB, 'update ims_subproduct set stockin = @si, stocknet = @sn, isoutofstock = @oos where sprid = @id',
      { si: StockIn, sn: StockNEt, oos: IsOutOfStock, id: sprid });
  }
  if (count > 0) ret = 'ok';
  res.json(ret);
}));

module.exports = router;
