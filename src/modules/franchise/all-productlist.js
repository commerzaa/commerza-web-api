'use strict';
// Ported from Franchise\Controllers\CustomerPanel\AllProductlist.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const P = '/franchise/AllProductlist';
const DB = 'shopping';
const GPL = ['IsVerified', 'Breadth_cms', 'CashOnDelivery', 'DAP', 'DealsIds', 'Height_cms', 'isnewarrival', 'IsStock', 'istopdeal', 'Length_cms', 'maincatname', 'MerchantCode', 'MerchantId', 'MerchantImage', 'MerchantName', 'EMAILID', 'PHONE', 'MPRID', 'Mvat', 'Prcode', 'ProcurementSLA', 'ProductCount', 'ProductImages', 'ProductTitle', 'prodUnit', 'Qty', 'ReplacementDay', 'rowNumber', 'sellMRP', 'ShippingCharges', 'SPRID', 'status_Sub', 'stockInQty', 'stockNetQty', 'stockOutQty', 'SubPrCode', 'VatTitle', 'IsActive', 'JP', 'BV', 'Rejectremark', 'Weight_kg', 'Subcategory', 'Discountpercentage', 'CreatedDate', 'ModifyDate', 'ismerchantstatus'];
const PDL = ['SubPrCode', 'ShotDescription', 'FullDescription', 'KeyFeatures', 'DiscountPercentage', 'DAP', 'Weight_Kg', 'Length_cms', 'Breadth_cms', 'Height_cms', 'ShippingCharges', 'stockIn', 'SellMRP', 'IsVerified', 'ProductTitle', 'ismerchantstatus', 'Fullfilmentby', 'Procurementtype', 'ProcurementSLA', 'HSN', 'LuxuryCess', 'ManufacturerDetails', 'ImporterDetails', 'PackerDetails', 'CountryOrigin', 'VATTITLE', 'Specification', 'ProductImages', 'SubCategoryId', 'Unit', 'Attributedata', 'VATPERCENTAGE'];
const SPL = ['Rownumber', 'categoryname', 'Localprice', 'Zonalprice', 'Nationalprice', 'Metro'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const FMT = () => new TypeError('Input string was not in a correct format.');
const toInt64 = (s) => { const t = String(s).trim(); if (!/^[+-]?\d+$/.test(t)) throw FMT(); return Number(t); };
const nz = (v) => (v === undefined || v === null ? '' : v);
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// DataSet.GetXml() equivalent (table dsData; NULL columns omitted)
const dsXml = (rows) => (!rows.length ? '<NewDataSet />'
  : '<NewDataSet>' + rows.map((r) => '<dsData>' + Object.keys(r).filter((k) => r[k] !== null && r[k] !== undefined)
    .map((k) => `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`).join('') + '</dsData>').join('') + '</NewDataSet>');
const tabSafe = (v) => String(v === undefined || v === null ? '' : v).replace(/\t/g, '');

// normalises the filter parameters shared by Index and ExportReport
function ids(p) {
  const PrCode = p.PrCode == null ? '' : p.PrCode;
  const SubPrCode = p.SubPrCode == null ? '' : p.SubPrCode;
  let MPRIDs = PrCode === '' ? 0 : toInt64(PrCode);
  let SPRIDs = SubPrCode === '' ? 0 : toInt64(SubPrCode);
  MPRIDs = (p.mprid == null || p.mprid === '') ? MPRIDs : toInt64(p.mprid);
  SPRIDs = (p.sprid == null || p.sprid === '') ? SPRIDs : toInt64(p.sprid);
  return { PrCode, SubPrCode, MPRIDs, SPRIDs };
}

// ExportReport: legacy wrote a tab separated AllProductList.xls and redirected to it; here the content is returned for download.
async function ExportReport(req) {
  const p = req.p;
  const { PrCode, MPRIDs, SPRIDs } = ids(p);
  const DID = Number(req.user.did);
  const NewAdd = p.NewAdd == null ? '' : p.NewAdd; void NewAdd;
  const search = p.search == null ? '' : p.search;
  const filtercategory = p.filtercategory == null ? '' : p.filtercategory;
  const ProductName = p.ProductName == null ? '' : p.ProductName;
  const statusid = p.statusid == null ? '' : p.statusid;
  const ddlstocklist = p.ddlstocklist == null || p.ddlstocklist === '' ? 0 : parseInt(p.ddlstocklist, 10);
  const fromdate = p.fromdate == null ? '' : p.fromdate;
  const todate = p.todate == null ? '' : p.todate;
  const page = p.page == null || p.page === '' ? 1 : parseInt(p.page, 10);
  try {
    const rows = await db.proc(DB, 'usp_getall_productreadylist', {
      STARTROWINDEX: page, MAXROWS: 99999999, MPRID: MPRIDs, SPRID: SPRIDs, BRANCHID: 0, CAT_CODE: filtercategory, SEARCHFIELD: search,
      SEARCHVALUE: PrCode, STATUS: statusid, ISSTOCK: ddlstocklist, FORMDATE: fromdate, TODATE: todate, STOCKIN: '',
      PRODUCTNAME: ProductName, CATEGORYRELATEDTO: '1', DID,
    });
    const list = mapRows(rows, GPL);
    let body = ['SNo ', 'Prdouct Name ', 'Prdouct Code ', 'Sub Category ', 'Status ', 'Stock In ', 'Stock Out ', 'Stock Available ', 'Sell Mrp ',
      'Discount ', 'Selling price ', 'GST % '].join('\t') + '\tDate';
    // legacy header: every column except the last one is followed by " \t"
    body = 'SNo \tPrdouct Name \tPrdouct Code \tSub Category \tStatus \tStock In \tStock Out \tStock Available \tSell Mrp \tDiscount \tSelling price \tGST % \tDate';
    for (const it of list) {
      const st = it.IsVerified;
      const IsVerified = st === 0 ? 'Inactive' : st === 1 ? 'Active' : st === 2 ? 'Blocked' : '';
      body += '\n' + [it.rowNumber, it.ProductTitle, it.SubPrCode, (it.Subcategory + ' ' + it.maincatname), IsVerified, it.stockInQty,
        it.stockOutQty, it.stockNetQty, it.sellMRP, it.Discountpercentage, it.DAP].map((x) => tabSafe(x) + ' \t').join('')
        + tabSafe(it.Mvat) + '\t' + tabSafe(it.CreatedDate) + ' \t';
    }
    return body;
  } catch (ex) {
    return null; // legacy: swallowed
  }
}

// auth
router.all(`${P}/deactivateProduct{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { paramType } = req.p;
  const paramID = parseInt(req.p.paramID, 10);
  const status = parseInt(req.p.status, 10);
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
    res.json(returnval);
  } catch (ex) {
    console.error(ex.message);
    res.json('Something went wrong. Please try later');
  }
}));

const indexHandler = asyncHandler(async (req, res) => {
  const p = req.p;
  const { PrCode, SubPrCode, MPRIDs, SPRIDs } = ids(p);
  const DID = Number(req.user.did);
  const Plid = 0;
  const NewAdd = p.NewAdd == null ? '' : p.NewAdd;
  const search = p.search == null ? '' : p.search;
  const filtercategory = p.filtercategory == null ? '' : p.filtercategory;
  const ProductName = p.ProductName == null ? '' : p.ProductName;
  const statusid = p.statusid == null ? '' : p.statusid;
  const allstock = p.allstock == null ? '' : p.allstock;
  const ddlstocklist = p.ddlstocklist == null || p.ddlstocklist === '' ? 0 : parseInt(p.ddlstocklist, 10);
  const ddlstocklist1 = p.ddlstocklist1 == null || p.ddlstocklist1 === '' ? 0 : parseInt(p.ddlstocklist1, 10);
  let stockfilter = p.stockfilter == null || p.stockfilter === '' ? null : parseInt(p.stockfilter, 10);
  if (ddlstocklist1 !== 0) stockfilter = ddlstocklist1;
  if (ddlstocklist !== 0) stockfilter = ddlstocklist;
  if (stockfilter === null) stockfilter = 0;
  const fromdate = p.fromdate == null ? '' : p.fromdate;
  const todate = p.todate == null ? '' : p.todate;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page == null || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await db.proc(DB, 'usp_getall_productreadylist_f', {
    STARTROWINDEX: page, MAXROWS: MaxRows, MPRID: MPRIDs, SPRID: SPRIDs, BRANCHID: Plid, CAT_CODE: filtercategory, SEARCHFIELD: search,
    SEARCHVALUE: PrCode, STATUS: statusid, ISSTOCK: stockfilter, FORMDATE: fromdate, TODATE: todate, STOCKIN: allstock,
    PRODUCTNAME: ProductName, CATEGORYRELATEDTO: '1', DID,
  });
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row
  const TotalRecord = rows.length && rows[0].totalcount != null ? parseInt(rows[0].totalcount, 10) : 0;
  if (p.btnexel === 'Export Excel') {
    const file = await ExportReport(req);
    if (file !== null) {
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=AllProductList.xls');
      return res.send(file);
    }
  }
  res.json({
    Model: mapRows(rows, GPL),
    checkedval: allstock, statusid, fromDate: fromdate, toDate: todate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search, filtercategory,
    MPRID: MPRIDs, ddlstatus: ddlstocklist,
  });
});
// auth
router.all(`${P}/Index{/:id}`, ...guard, indexHandler);
// route-config
router.all('/franchise/franchisee/AllProductlist', ...guard, indexHandler);

// auth (legacy: no session check; protected because it acts on franchise data)
router.all(`${P}/DataSearchnew{/:id}`, ...guard, asyncHandler(async (req, res) => {
  if (req.p.SearchText == null) throw NRE();
  const SearchText = String(req.p.SearchText).split('+apostopis').join("'");
  res.json(dsXml(await db.proc(DB, 'usp_getproductdatasearch_productlist', { serchItem: SearchText })));
}));

// auth
router.all(`${P}/DataSearch{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const BranchId = 0;
  if (req.p.SearchText == null) throw NRE();
  const SearchText = String(req.p.SearchText).split('+apostopis').join("'");
  res.json(dsXml(await db.proc(DB, 'usp_getproductdatasearch', { serchItem: SearchText, BranchId })));
}));

// auth (void action: export download)
router.all(`${P}/ExportReport{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const file = await ExportReport(req);
  if (file === null) return res.status(200).end();
  res.set('Content-Type', 'application/force-download');
  res.set('Content-Disposition', 'attachment; filename=AllProductList.xls');
  res.send(file);
}));

// auth
router.all(`${P}/transferProduct{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const MPRID = toInt64(req.p.MPRID);
  const { paramType } = req.p;
  const paramID = parseInt(req.p.paramID, 10);
  try {
    const MainRow = await db.queryOne(DB, 'select * from ims_masterproduct where mprid = @id limit 1', { id: MPRID });
    if (!MainRow) throw NRE();
    const upd = { subcategoryid: 0, maincategoryid: MainRow.maincategoryid, catid: MainRow.catid };
    if (paramType === 'subcat') {
      const subcatrow = await db.queryOne(DB, 'select * from tbl_sub_category where subcatid = @id and status = true limit 1', { id: paramID });
      if (!subcatrow) return res.json('No Such Sub Category Exists');
      const catrow = await db.queryOne(DB, 'select * from tbl_category where catid = @id and status = true limit 1', { id: subcatrow.catid });
      if (!catrow) return res.json('No Such Category Exists');
      const maincatrow = await db.queryOne(DB, 'select * from tbl_main_category where maincatid = @id and status = true limit 1', { id: catrow.maincatid });
      if (!maincatrow) return res.json('No Such Main Category Exists');
      upd.subcategoryid = subcatrow.subcatid;
      upd.maincategoryid = maincatrow.maincatid;
    }
    if (paramType === 'cat') {
      const catrow = await db.queryOne(DB, 'select * from tbl_category where catid = @id and status = true limit 1', { id: paramID });
      if (!catrow) return res.json('No Such Category Exists');
      const maincatrow = await db.queryOne(DB, 'select * from tbl_main_category where maincatid = @id and status = true limit 1', { id: catrow.maincatid });
      if (!maincatrow) return res.json('No Such Main Category Exists');
      upd.catid = catrow.catid;
      upd.maincategoryid = maincatrow.maincatid;
    }
    await db.exec(DB, 'update ims_masterproduct set subcategoryid = @sc, maincategoryid = @mc, catid = @c where mprid = @id',
      { sc: upd.subcategoryid, mc: upd.maincategoryid, c: upd.catid, id: MPRID });
    res.json('ok');
  } catch (ex) {
    console.error(ex.message);
    res.json('Something went wrong. Please try later');
  }
}));

// auth
router.all(`${P}/UpdateDeals{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const SPRID = toInt64(req.p.SPRID);
  if (req.p.DealsIds == null) throw NRE();
  let ret = 'NotOk';
  const pms = await db.queryOne(DB, 'select sprid from ims_subproduct where sprid = @id limit 1', { id: SPRID });
  if (!pms) throw NRE();
  const DealsIds = String(req.p.DealsIds).replace(/^,+|,+$/g, '');
  const count = await db.exec(DB, 'update ims_subproduct set dealsids = @d where sprid = @id', { d: DealsIds, id: SPRID });
  if (count > 0) ret = 'ok';
  res.json(ret);
}));

// auth
router.all(`${P}/UpdateStock{/:id}`, ...guard, asyncHandler(async (req, res) => {
  let ret = 'NotOk';
  const sprid = toInt64(req.p.SPRID);
  const add = parseInt(req.p.StockIn, 10);
  if (Number.isNaN(add)) throw FMT();
  const pms = await db.queryOne(DB, 'select stockin, stocknet from ims_subproduct where sprid = @id limit 1', { id: sprid });
  if (!pms) throw NRE();
  const StockNEt = pms.stocknet + add;
  const count = await db.exec(DB, 'update ims_subproduct set stockin = @si, stocknet = @sn, isoutofstock = @oos where sprid = @id',
    { si: pms.stockin + add, sn: StockNEt, oos: !(StockNEt > 0), id: sprid });
  if (count > 0) ret = 'ok';
  res.json(ret);
}));

// auth
router.all(`${P}/checksellingpricelist{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getsellingpricelist', { SPRID: req.p.sprid, selingprice: Number(req.p.sellprice) });
  res.json(mapRows(rows, SPL));
}));

// auth (legacy: no session check; protected because it acts on franchise data)
router.all(`${P}/editallproductlist{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const SPRID = parseInt(req.p.SPRID, 10);
  // PORT-NOTE: the legacy positional literals (ten 0 values then four empty strings) are passed by the procedure's own parameter names;
  // the original statement text was malformed C# (embedded quotes) and the 4th empty string maps to @STRRESULT.
  const rows = await db.proc(DB, 'usp_updateallproductlist', {
    mode: 2, SPRID, ISVERIFIED: 0, SELLMRP: 0, DISCOUNT: 0, DAP: 0, STOCKIN: 0, LENGTH: 0, BREADTH: 0, WEIGHT: 0, HEIGHT: 0, SHIPPINGCHARGES: 0,
    SHORTDESC: '', KEYFEATURES: '', FULLDESC: '',
  });
  res.json(mapRows(rows, PDL));
}));

// auth (legacy: [ValidateInput(false)], no session check; protected because it mutates product data)
router.all(`${P}/Updatesingleproduct{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  for (const k of ['fullDesc', 'specification', 'KeyFeatures']) if (p[k] == null) throw NRE();
  const rep = (s) => String(s).split('+#!#+').join('<').split('+!#!+').join('>');
  const fullDesc = rep(p.fullDesc);
  const specification = rep(p.specification);
  const KeyFeatures = rep(p.KeyFeatures);
  const rows = await db.proc(DB, 'usp_updateallproduct', {
    mode: 1, SPRID: p.spid == null || p.spid === '' ? null : Number(p.spid), IsVerified: parseInt(p.IsVerified, 10), sellMRP: p.mrp,
    discount: Number(p.discount), dap: Number(p.DAP), stockin: parseInt(p.Stock, 10), length: Number(p.Length), breadth: Number(p.Breadth),
    weight: Number(p.Weight), height: Number(p.Height), shippingcharges: Number(p.ShippingCharges), shortdesc: p.ShortDesc,
    keyfeatures: KeyFeatures, fullDesc, image: '', manufacturingdetail: p.manufacturingdetail, importerdetail: p.importerdetail,
    packerdetail: p.packerdetail, gst: p.gst, procurementtype: p.procurementtype, fullfilmentseller: p.fullfilmentseller,
    procurementsla: p.procurementsla, hsn: p.hsn, luxurycess: p.luxurycess, countryorigin: '', specification,
  });
  // @strresult OUT => column of the result row
  const out = rows.length ? rows[0].strresult : null;
  if (out === null || out === undefined) throw NRE();
  res.json(String(out));
}));

// auth (legacy: no session check; protected because it acts on franchise data)
router.all(`${P}/UpdateStatuslist{/:id}`, ...guard, asyncHandler(async (req, res) => {
  if (req.p.isSelected == null) throw NRE();
  const tokens = String(req.p.isSelected).split(',');
  let status = parseInt(req.p.activinactiv, 10);
  const activinactiv = status;
  for (let i = 0; i < tokens.length - 1; i++) {
    const sn = await db.scalar(DB, 'select stocknet from ims_subproduct where sprid::varchar = @s limit 1', { s: tokens[i] });
    const StockNet = sn === null || sn === undefined ? 0 : Number(sn);
    if (StockNet > 0) {
      await db.proc(DB, 'usp_updateprdouctcount', { SPRID: tokens[i], Status: status });
    } else if (activinactiv > 1) {
      await db.proc(DB, 'usp_updateprdouctcount', { SPRID: tokens[i], Status: status });
    } else {
      status = 4;
    }
  }
  res.json(status);
}));

module.exports = router;
