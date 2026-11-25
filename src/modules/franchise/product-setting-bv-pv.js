'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };
// Port of Franchise\Controllers\CustomerPanel\Product_Setting_BV_PV.cs (7 actions)
// route-config: franchisee/Product-Bv-Pv -> Index
const PROPS = ['ROWNUMBER', 'MAINCATID', 'MAINCATNAME', 'CATID', 'CATNAME', 'SUBCATID', 'SUBCATNAME', 'COMMISSION', 'BV', 'PV'];

// DataSet.GetXml() equivalent (DataSet "NewDataSet", table "dsData"; null columns are omitted)
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function getXml(rows) {
  let x = '<NewDataSet>';
  for (const r of rows || []) {
    x += '<dsData>';
    for (const k of Object.keys(r)) {
      if (r[k] === null || r[k] === undefined) continue;
      const v = r[k] instanceof Date ? r[k].toISOString() : r[k];
      x += '<' + k + '>' + esc(v) + '</' + k + '>';
    }
    x += '</dsData>';
  }
  return x + '</NewDataSet>';
}
// PORT-NOTE: DataUtility.GetDataSetSPNamed + DataSet.GetXml() reimplemented inline (db.proc + XML builder).
async function searchProc(req, res, spName) {
  const SearchText = s(req.p.SearchText).split('+apostopis').join("'");
  const rows = await db.proc('shopping', spName, { serchItem: SearchText });
  res.json(getXml(rows));
}

// auth
router.all(['/franchise/Product_Setting_BV_PV/Index{/:id}', '/franchise/franchisee/Product-Bv-Pv'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const SearchValueSubCategory = s(p.SearchValueSubCategory);
  const SearchSubCategory = s(p.SearchSubCategory);
  const SearchCategory = s(p.SearchCategory);
  const MaxRows = 100;
  const page = p.page ? pg(p.page) : 1;
  const DID = parseInt(req.user.did, 10);
  const rows = await db.proc('shopping', 'usp_get_prodouctwise_bv_pv_setting', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate, DID,
    MAINCATID: SearchCategory, CATID: SearchSubCategory, SUBCATID: SearchValueSubCategory,
  });
  const TotalRecord = parseInt(outv(rows, 'TOTALCOUNT'), 10) || 0;
  res.json({
    Model: mapRows(rows, PROPS),
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate,
    toDate,
    SearchValueSubCategory,
    SearchSubCategory,
    SearchCategory,
  });
}));

// auth
router.all('/franchise/Product_Setting_BV_PV/Addprodouctdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const { maincatid, catid, subcatid, commision, bv, pv } = req.p;
  const DID = parseInt(req.user.did, 10);
  const r = await db.procOne('shopping', 'usp_addproductbv_pv', {
    MAINCATID: maincatid, CATID: catid, SUBCATID: subcatid, COMISSION: commision, BV: bv, PV: pv, DID,
  });
  res.json(r && r.result !== undefined && r.result !== null ? String(r.result) : '');
}));

// auth
router.all('/franchise/Product_Setting_BV_PV/changbvstatus{/:id}', auth, asyncHandler(async (req, res) => {
  const chkbvvalue = parseInt(req.p.chkbvvalue, 10);
  const Row = await db.exec('shopping', 'UPDATE TBL_COMPANYSETTINGS SET BVSHOWS=@v WHERE PMID=@did', { v: chkbvvalue, did: req.user.did });
  res.json(Row);
}));

// auth
router.all('/franchise/Product_Setting_BV_PV/changPvstatus{/:id}', auth, asyncHandler(async (req, res) => {
  const chkpvvalue = parseInt(req.p.chkpvvalue, 10);
  const Row = await db.exec('shopping', 'UPDATE TBL_COMPANYSETTINGS SET PVSHOWS=@v WHERE PMID=@did', { v: chkpvvalue, did: req.user.did });
  res.json(Row);
}));

// auth
router.all('/franchise/Product_Setting_BV_PV/ObjectserchMainCateName{/:id}', auth, asyncHandler((req, res) => searchProc(req, res, 'usp_getdatasearch_category_temp')));
// auth
router.all('/franchise/Product_Setting_BV_PV/ObjectserchSubCategory{/:id}', auth, asyncHandler((req, res) => searchProc(req, res, 'usp_getdatasearch_subcategory_temp')));
// auth
router.all('/franchise/Product_Setting_BV_PV/DataSearchsubcat{/:id}', auth, asyncHandler((req, res) => searchProc(req, res, 'usp_getdatasearch_subcategory')));

module.exports = router;
