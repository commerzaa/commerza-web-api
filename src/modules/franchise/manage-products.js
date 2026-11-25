'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Manage_Products.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
// Tables: ims_masterproduct (Product_Master_Main), ims_subproduct (Product_Master_Sub), tbl_sub_category, tbl_category, tbl_main_category
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Manage_Products';

const GETPRODUCTLIST1 = ['subcatid', 'SubCatName'];
const str = (v) => (v === undefined || v === null ? '' : String(v));
const isTrue = (v) => v === true || v === 1 || v === '1' || v === 't';
// Convert.ToInt32(string) / Convert.ToInt64(string): throws FormatException on bad input, null => 0
const conv = (v) => {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
};
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// [SessionExpireCheck] -> auth
router.all(P + '/DataSearch{/:id}', auth, asyncHandler(async (req, res) => {
  const BranchId = Number(req.user.did);
  let SearchText = req.p.SearchText;
  SearchText = SearchText.split('+apostopis').join("'");
  const rows = await db.proc('shopping', 'usp_getproductdatasearch', { serchitem: SearchText, BranchId });
  // DataSet.GetXml(): <NewDataSet><dsData><col>value</col>...</dsData>...</NewDataSet>
  // PORT-NOTE: DataSet.GetXml schema details (xs:schema is not emitted by GetXml) reproduced for plain string/number columns only.
  let xml = '<NewDataSet>';
  for (const r of rows) {
    xml += '<dsData>';
    for (const k of Object.keys(r)) {
      if (r[k] === null || r[k] === undefined) continue; // DBNull columns are omitted by GetXml
      xml += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
    }
    xml += '</dsData>';
  }
  xml += '</NewDataSet>';
  res.json(xml);
}));

// auth
router.all(P + '/deactivateProduct{/:id}', auth, asyncHandler(async (req, res) => {
  const paramType = req.p.paramType;
  const paramID = parseInt(req.p.paramID, 10);
  const status = parseInt(req.p.status, 10);
  let returnval = '';
  try {
    if (paramType === 'mainProd') {
      const mainrow = await db.queryOne('shopping', 'select mprid from ims_masterproduct where mprid = @id limit 1', { id: paramID });
      if (mainrow == null) return res.json('No Such Product Exists');
      await db.exec('shopping', 'update ims_subproduct set isactive = false where mprid = @mprid and isactive = true', { mprid: mainrow.mprid });
    }
    if (paramType === 'subProd') {
      const subrow = await db.queryOne('shopping', 'select sprid, isactive from ims_subproduct where sprid = @id limit 1', { id: paramID });
      if (subrow == null) return res.json('No Such Sub Product Exists');
      const active = subrow.isactive;
      if (status === 0) {
        if (active === true) return res.json('Sub Product is already activated');
        await db.exec('shopping', 'update ims_subproduct set isactive = true where sprid = @id', { id: paramID });
        returnval = 'active';
      } else {
        if (active === false) return res.json('Sub Product is already activated');
        await db.exec('shopping', 'update ims_subproduct set isactive = false, isverified = 2 where sprid = @id', { id: paramID });
        returnval = 'deactive';
      }
    }
    return res.json(returnval);
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// [SessionExpireCheck] -> auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  let { SubPrCode, PrCode, mprid, sprid, ProductName, NewAdd, search, filtercategory } = req.p;
  let page = req.p.page;
  let ddlstatus = req.p.ddlstatus;
  if (PrCode == null) PrCode = '';
  if (SubPrCode == null) SubPrCode = '';
  let MPRIDs = (PrCode === '' ? 0 : conv(PrCode));
  let SPRIDs = (SubPrCode === '' ? 0 : conv(SubPrCode));
  MPRIDs = (mprid == null || mprid === '' ? MPRIDs : conv(mprid));
  SPRIDs = (sprid == null || sprid === '' ? SPRIDs : conv(sprid));
  const Plid = Number(req.user.did);
  if (NewAdd == null) NewAdd = '';
  if (search == null) search = '';
  if (filtercategory == null) filtercategory = '';
  if (ProductName == null) ProductName = '';
  ddlstatus = (ddlstatus === undefined || ddlstatus === null || ddlstatus === '') ? 0 : parseInt(ddlstatus, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const rows = await db.proc('shopping', 'usp_getall_productlist', {
    startrowindex: page, maxrows: MaxRows, mprid: MPRIDs, sprid: SPRIDs, branchid: Plid, cat_code: filtercategory,
    searchfield: search, searchvalue: PrCode, status: ddlstatus,
  });
  const GetProductList1s = mapRows(rows, GETPRODUCTLIST1);
  // @TotalCount OUT => "totalcount" column of the function result
  const TotalRecord = parseInt(rows.length && rows[0].totalcount !== undefined && rows[0].totalcount !== null ? rows[0].totalcount : 0, 10);
  res.json({
    Model: GetProductList1s, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductName, PrCode, SubPrCode, SPRID: SPRIDs, NewAdd, search,
    filtercategory, MPRID: MPRIDs,
  });
}));

// auth
router.all(P + '/transferProduct{/:id}', auth, asyncHandler(async (req, res) => {
  const MPRID = parseInt(req.p.MPRID, 10);
  const paramType = req.p.paramType;
  const paramID = parseInt(req.p.paramID, 10);
  try {
    const MainRow = await db.queryOne('shopping', 'select mprid from ims_masterproduct where mprid = @id limit 1', { id: MPRID });
    if (!MainRow) throw new TypeError('Object reference not set to an instance of an object.');
    const upd = { subcategoryid: 0 };
    if (paramType === 'subcat') {
      const subcatrow = await db.queryOne('shopping', 'select subcatid, catid from tbl_sub_category where subcatid = @id and status = true limit 1', { id: paramID });
      if (subcatrow == null) return res.json('No Such Sub Category Exists');
      const catrow = await db.queryOne('shopping', 'select catid, maincatid from tbl_category where catid = @id and status = true limit 1', { id: subcatrow.catid });
      if (catrow == null) return res.json('No Such Category Exists');
      const maincatrow = await db.queryOne('shopping', 'select maincatid from tbl_main_category where maincatid = @id and status = true limit 1', { id: catrow.maincatid });
      if (maincatrow == null) return res.json('No Such Main Category Exists');
      upd.subcategoryid = subcatrow.subcatid;
      upd.maincategoryid = maincatrow.maincatid;
    }
    if (paramType === 'cat') {
      const catrow = await db.queryOne('shopping', 'select catid, maincatid from tbl_category where catid = @id and status = true limit 1', { id: paramID });
      if (catrow == null) return res.json('No Such Category Exists');
      const maincatrow = await db.queryOne('shopping', 'select maincatid from tbl_main_category where maincatid = @id and status = true limit 1', { id: catrow.maincatid });
      if (maincatrow == null) return res.json('No Such Main Category Exists');
      upd.catid = catrow.catid;
      upd.maincategoryid = maincatrow.maincatid;
    }
    const sets = Object.keys(upd).map((k) => `${k} = @${k}`).join(', ');
    await db.exec('shopping', `update ims_masterproduct set ${sets} where mprid = @mprid`, { ...upd, mprid: MPRID });
    return res.json('ok');
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// auth
router.all(P + '/UpdateDeals{/:id}', auth, asyncHandler(async (req, res) => {
  const SPRID = parseInt(req.p.SPRID, 10);
  const DealsIds = req.p.DealsIds;
  let ret = 'NotOk';
  const pms = await db.queryOne('shopping', 'select dealsids from ims_subproduct where sprid = @id limit 1', { id: SPRID });
  if (!pms) throw new TypeError('Object reference not set to an instance of an object.');
  const newVal = DealsIds.replace(/^,+|,+$/g, '');
  // EF SaveChanges returns the number of modified entities (0 when the value is unchanged)
  let count = 0;
  if (pms.dealsids !== newVal) {
    await db.exec('shopping', 'update ims_subproduct set dealsids = @d where sprid = @id', { d: newVal, id: SPRID });
    count = 1;
  }
  if (count > 0) ret = 'ok';
  res.json(ret);
}));

async function stockUpdate(SPRIDStr, delta) {
  const sprid = conv(SPRIDStr);
  const pms = await db.queryOne('shopping', 'select stockin, stocknet, isoutofstock from ims_subproduct where sprid = @id limit 1', { id: sprid });
  if (!pms) throw new TypeError('Object reference not set to an instance of an object.');
  const stockIn = pms.stockin + delta;
  const StockNEt = pms.stocknet + delta;
  const isOut = !(StockNEt > 0);
  let count = 0;
  if (stockIn !== pms.stockin || StockNEt !== pms.stocknet || isOut !== isTrue(pms.isoutofstock)) {
    await db.exec('shopping', 'update ims_subproduct set stockin = @si, stocknet = @sn, isoutofstock = @oos where sprid = @id', { si: stockIn, sn: StockNEt, oos: isOut, id: sprid });
    count = 1;
  }
  return count > 0 ? 'ok' : 'NotOk';
}

// auth
router.all(P + '/UpdateStock{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await stockUpdate(req.p.SPRID, conv(req.p.StockIn)));
}));

// auth
router.all(P + '/UpdateLessStock{/:id}', auth, asyncHandler(async (req, res) => {
  const id = parseInt(req.p.id, 10);
  const n = conv(req.p.StockIn);
  res.json(await stockUpdate(req.p.SPRID, id === 1 ? n : -n));
}));

module.exports = router;
