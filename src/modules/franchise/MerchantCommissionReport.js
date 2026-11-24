'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/MerchantCommissionReport.cs (MerchantCommissionReportController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
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
const C = 'MerchantCommissionReport';

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


/** HttpUtility.HtmlDecode (common entities + numeric references) */
function htmlDecode(v) {
  return s(v).replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
const REPORT_PROPS = ['ROWNUMBER', 'CATNAME', 'SUBCATNAME', 'ADMINCHARGE', 'DELIEVERYCHARGE', 'HANDLINGCHARGE', 'FixedFee', 'SubSubCatName', 'REFUND', 'RETURN', 'EXCHANGE'];

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(res, page, btnexel, SearchValueSubCategory, SearchSubCategory, SearchCategory) {
  const ViewBag = {};
  const Plid = 0;
  const rows = await proc(DB, 'usp_getcommissionreport', {
    mode: '1', plid: Plid, startrowindex: page == null || page === '' ? null : parseInt(page, 10), maxrows: 9999999, catname: '', subcatname: '', orderby: '',
    searchsubsubcategory: htmlDecode(SearchValueSubCategory), searchsubcategory: htmlDecode(SearchSubCategory), searchcategory: htmlDecode(SearchCategory),
  });
  const list = mapRows(rows, REPORT_PROPS);
  try {
    if (list.length > 0) {
      const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'CommissionReport.xls');
      ViewBag.filepath = filepath;
      let out = '';
      out += 'S.No. \t';
      out += 'Category \t';
      out += 'Sub Category \t';
      out += 'Sub Sub Category \t';
      out += 'Admin Commission(%) \t';
      out += 'Transaction Fee(%) \t';
      out += 'Return \t';
      out += 'Refund \t';
      out += 'Exchange \t';
      for (const Item of list) {
        try {
          let line = '\n';
          line += tabClean(Item.ROWNUMBER.toString()) + ' \t';
          line += tabClean(Item.CATNAME.toString()) + ' \t';
          line += tabClean(Item.SUBCATNAME.toString()) + ' \t';
          line += tabClean(Item.SubSubCatName.toString()) + ' \t';
          line += tabClean(Item.ADMINCHARGE.toString()) + ' \t';
          line += tabClean(Item.HANDLINGCHARGE.toString()) + ' \t';
          line += tabClean(Number(Item.RETURN).toFixed(2)) + ' \t';
          line += tabClean(Item.REFUND.toString()) + ' \t';
          line += tabClean(Item.EXCHANGE.toString()) + ' \t';
          out += line;
        } catch (e) { break; }
      }
      fs.writeFileSync(filepath, out);
      // PORT-NOTE: legacy redirected to ~/AllExcelSheets/CommissionReport.xls; the file content is sent directly as the download
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=CommissionReport.xls');
      res.send(out);
      return { sent: true };
    }
    ViewBag.Message = 'There is no record in excel';
  } catch (ExpObj) {
    ViewBag.filepath = ExpObj.message;
  }
  return { sent: false, ViewBag };
}

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  let { page, btnexel, SearchValueSubCategory, SearchSubCategory, SearchCategory } = req.p;
  const Plid = 0;
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (SearchValueSubCategory == null) SearchValueSubCategory = '';
  if (SearchSubCategory == null) SearchSubCategory = '';
  if (SearchCategory == null) SearchCategory = '';
  const MaxRows = 50;
  const rows = await proc(DB, 'usp_getcommissionreport', {
    mode: '1', plid: Plid, startrowindex: page, maxrows: MaxRows, catname: '', subcatname: '', orderby: '',
    searchsubsubcategory: htmlDecode(SearchValueSubCategory), searchsubcategory: htmlDecode(SearchSubCategory), searchcategory: htmlDecode(SearchCategory),
  });
  // PORT-NOTE: @RECORDCOUNT OUT is read from the "recordcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].recordcount || 0) : 0;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, SearchValueSubCategory, SearchSubCategory, SearchCategory, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  const Model = mapRows(rows, REPORT_PROPS);
  if (btnexel === 'Export Excel') {
    const r = await exportReport(res, page, btnexel, SearchValueSubCategory, SearchSubCategory, SearchCategory);
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  res.json({ Model, ViewBag });
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/commission-chart', auth, indexHandler);

// auth
router.all(`/franchise/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const { page, btnexel, SearchValueSubCategory, SearchSubCategory, SearchCategory } = req.p;
  const r = await exportReport(res, page, btnexel, SearchValueSubCategory, SearchSubCategory, SearchCategory);
  if (!r.sent) res.json({ ViewBag: r.ViewBag });
}));

// ---- search suggestion actions (no session check in the legacy code) ---------------------------------
function searchAction(spName) {
  return asyncHandler(async (req, res) => {
    const SearchText = s(req.p.SearchText).split('+apostopis').join("'");
    const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@serchItem', Value: SearchText }], spName, 'dsData');
    res.json(getXml(ds));
  });
}
// public
router.all(`/franchise/${C}/DataSearchsubcat{/:id}`, searchAction('usp_GetDataSearch_subCategory'));
// public
router.all(`/franchise/${C}/ObjectserchMainCateName{/:id}`, searchAction('usp_GetDataSearch_Category_temp'));
// public
router.all(`/franchise/${C}/ObjectserchSubCategory{/:id}`, searchAction('usp_GetDataSearch_SubCategory_temp'));

module.exports = router;
