'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Commission_Structure.cs (Commission_StructureController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 * NOTE: the legacy file is not part of the .csproj (not compiled); ported anyway.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// Usp_GetCommissionReport_Admin result columns (SELECT * FROM #TEMP1)
const COMMISSION_PROPS = ['ROWNUMBER1', 'ROWNUMBER', 'CATNAME', 'SUBCATNAME', 'ADMINCHARGE', 'DELIEVERYCHARGE', 'HANDLINGCHARGE', 'FixedFee', 'SubSubCatName',
  'SUBCATID', 'BVPER', 'cashback_Per', 'newbv', 'newcashback', 'ModifyDate'];
const CATEGORY_PROPS = ['MAINCATID', 'MainCatName', 'CatId', 'CatName', 'SUBCATID', 'SubCatName'];
const SUBCATEGORY_PROPS = ['CatId', 'CatName'];
const SUBSUBCATEGORY_PROPS = ['SUBCATID', 'SubCatName'];

function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}
/** Request.QueryString[name] (case-insensitive) */
function qs(req, name) {
  const k = Object.keys(req.query || {}).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : req.query[k];
}
const tabClean = (v) => String(v).replace(/\t/g, '    ');
const req0 = (v) => { if (v === null || v === undefined) throw NRE(); return v; };

// ---- ExportReport ----------------------------------------------------------------------------------------
async function ExportReport(req, page, did, SearchValueSubCategory, SearchSubCategory, SearchCategory) {
  const Plid = Number(req.user.did);
  if (SearchValueSubCategory == null) SearchValueSubCategory = '';
  if (SearchSubCategory == null) SearchSubCategory = '';
  if (SearchCategory == null) SearchCategory = '';
  did = qs(req, 'did');
  try {
    if (page == null) page = 1;
    const MaxRows = 50;
    // PORT-NOTE: legacy executed "EXEC sp @Mode,@PLID,@RECORDCOUNT OUT,@INTRESULT OUT,@STARTROWINDEX,@MAXROWS,@a,@b,@c" positionally, so the
    // three search values land on @CATNAME,@SUBCATNAME,@ORDERBY (not on the @Search* parameters); reproduced here.
    const rows = await proc(DB, 'usp_getcommissionreport_admin', {
      mode: '1', plid: Plid, startrowindex: page, maxrows: MaxRows, catname: SearchValueSubCategory, subcatname: SearchSubCategory, orderby: SearchCategory,
    });
    const ObjCommissionReport = mapRows(rows, COMMISSION_PROPS);
    const dir = path.join(config.uploadDir, 'Franchise');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'Commission_Structure.xls');
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = '';
    out += 'Sr No \t';
    out += 'Category \t';
    out += 'Sub Category \t';
    out += 'Sub Sub Category \t';
    out += 'BV \t';
    out += 'Cashback \t';
    out += 'Last Modified Date \t';
    for (const item of ObjCommissionReport) {
      out += '\n';
      out += tabClean(req0(item.ROWNUMBER1)) + ' \t';
      out += tabClean(req0(item.CATNAME)) + ' \t';
      out += tabClean(req0(item.SUBCATNAME)) + ' \t';
      out += tabClean(req0(item.SubSubCatName)) + ' \t';
      out += tabClean(Number(req0(item.BVPER)).toFixed(2)) + ' \t';
      out += tabClean(Number(req0(item.cashback_Per)).toFixed(2)) + ' \t';
      out += tabClean(req0(item.ModifyDate)) + ' \t';
    }
    fs.writeFileSync(filepath, out);
  } catch (ex) {
    // swallowed in legacy
  }
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/Commission-Structure
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/Commission_Structure/Index{/:id}', '/franchise/franchisee/Commission-Structure'], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.did);
  const p = req.p;
  let { btnexel, did, SearchValueSubCategory, SearchSubCategory, SearchCategory, MainCategory, SubCategory, SubsubCategory } = p;
  let page = parseInt(p.page, 10); if (Number.isNaN(page)) page = null;
  if (SearchValueSubCategory == null) SearchValueSubCategory = ''; else SubsubCategory = SearchValueSubCategory;
  if (SearchSubCategory == null) SearchSubCategory = ''; else SubCategory = SearchSubCategory;
  if (SearchCategory == null) SearchCategory = ''; else MainCategory = SearchCategory;
  did = qs(req, 'did');
  if (MainCategory == null) MainCategory = '';
  if (SubCategory == null) SubCategory = '';
  if (SubsubCategory == null) SubsubCategory = '';
  if (page == null) page = 1;
  const MaxRows = 200; // UtilityClass.GridPageSize()
  // PORT-NOTE: @RECORDCOUNT OUT is read from the first result row (column "recordcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_getcommissionreport_admin', {
    mode: '1', plid: Plid, startrowindex: page, maxrows: MaxRows, catname: '', subcatname: '', orderby: '',
    searchsubsubcategory: SubsubCategory, searchsubcategory: SubCategory, searchcategory: MainCategory,
  });
  const ObjCommissionReport = mapRows(rows, COMMISSION_PROPS);
  const TotalRecord = totalOf(rows, 'recordcount');
  const ViewBag = {
    did, SearchValueSubCategory: SubsubCategory, SearchSubCategory: SubCategory, SearchCategory: MainCategory, MainCategory, SubCategory, SubsubCategory,
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  if (btnexel === 'Export Excel') {
    await ExportReport(req, page, did, SubsubCategory, SubCategory, MainCategory);
  }
  return res.json({ view: '~/Views/Commission_Structure/Index.cshtml', Model: ObjCommissionReport, ViewBag });
}));

// ---- ExportReport (public void action) ---------------------------------------------------------------------
// auth
router.all('/franchise/Commission_Structure/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let page = parseInt(p.page, 10); if (Number.isNaN(page)) page = null;
  await ExportReport(req, page, p.did, p.SearchValueSubCategory, p.SearchSubCategory, p.SearchCategory);
  return res.status(200).end();
}));

// ---- GetMainCat ----------------------------------------------------------------------------------------
// auth
router.all('/franchise/Commission_Structure/GetMainCat{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_allcategorylist', { maincatname: '', catname: '', prefix: req.p.prefix, mode: 0 });
  return res.json(mapRows(rows, CATEGORY_PROPS));
}));

// ---- SubCategory ---------------------------------------------------------------------------------------
// auth
router.all('/franchise/Commission_Structure/SubCategory{/:id}', auth, asyncHandler(async (req, res) => {
  const { prefix, MainCategory } = req.p;
  if (MainCategory == null) throw NRE();
  const rows = await proc(DB, 'usp_allcategorylist', { maincatname: String(MainCategory).trim(), catname: '', prefix, mode: 1 });
  return res.json(mapRows(rows, SUBCATEGORY_PROPS));
}));

// ---- SUBSubCategory ------------------------------------------------------------------------------------
// auth
router.all('/franchise/Commission_Structure/SUBSubCategory{/:id}', auth, asyncHandler(async (req, res) => {
  const { prefix, MainCategory, SubCategory } = req.p;
  const rows = await proc(DB, 'usp_allcategorylist', { maincatname: MainCategory, catname: SubCategory, prefix, mode: 2 });
  return res.json(mapRows(rows, SUBSUBCATEGORY_PROPS));
}));

module.exports = router;
