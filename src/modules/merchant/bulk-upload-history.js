'use strict';
const DB = 'shopping';
// Ported from Merchant Panel Controllers/CustomerPanel/BulkUploadHistory.cs (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('merchant')];
const P = '/merchant/BulkUploadHistory';
const VM = ['ROWNUMBER', 'TUIELID', 'ActivityByUser', 'ActivityDate', 'ExcelFile', 'Status', 'ActivityByUserId', 'Companyname', 'TotalRecord', 'TotalerrorRecord', 'CategoryName', 'SubCategoryName', 'SubSubCategoryName', 'QCSTATUS', 'PENDINGSELLING', 'LISTINGCREATED', 'Requestid', 'SENDTOQC'];

// auth
// route-config: merchant/bulkuploadhistory
router.all([`${P}/Index{/:id}`, '/merchant/merchant/bulkuploadhistory{/:id}'], ...guard, asyncHandler(async (req, res) => {
  let { fromDate, toDate, page, FileName, ddlCategory, ddlSubCategory, ddlSubSubCategory } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (FileName == null) FileName = '';
  ddlCategory = ddlCategory == null || ddlCategory === '' ? 0 : parseInt(ddlCategory, 10);
  ddlSubCategory = ddlSubCategory == null || ddlSubCategory === '' ? 0 : parseInt(ddlSubCategory, 10);
  ddlSubSubCategory = ddlSubSubCategory == null || ddlSubSubCategory === '' ? 0 : parseInt(ddlSubSubCategory, 10);
  const ByUserId = Number(req.user.plid);
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
    const data = await db.proc(DB, 'usp_bulkuploadhistory', {
      Mode: '1', ID: '0', FROMDATE: fromDate, TODATE: toDate, Filename: '', ByUserId,
      MAINCATID: ddlCategory, CATID: ddlSubCategory, SUBCATID: ddlSubSubCategory, StartRowIndex: page, MaxRows,
    });
    // PORT-NOTE: @TOTALCOUNT / @STRRESULT OUT read from the 'totalcount' column of the first row
    const TotalRecord = data.length && data[0].totalcount != null ? parseInt(data[0].totalcount, 10) : 0;
    const catid = await db.scalar(DB, 'SELECT catid FROM portal_master WHERE plid = @plid LIMIT 1', { plid: String(ByUserId) });
    const category = mapRows(await db.query(DB,
      `select pc.catid, pc.catname from product_category pc where pc.catactive = true and pc.catid::varchar(100) in (select unnest(string_to_array(@catid, ',')))`,
      { catid: catid === null ? '' : String(catid) }), ['CATID', 'CATNAME']);
    const subcategory = mapRows(await db.query(DB, 'SELECT scatid, scatname FROM product_subcategory WHERE scatactive = true'), ['SCATID', 'SCATNAME']);
    const subsubcategory = mapRows(await db.query(DB,
      'SELECT kmid, keywordname FROM keyword_master WHERE kactive = true'), ['KMID', 'KEYWORDNAME']);
    res.json({
      Model: mapRows(data, VM), category, subcategory, subsubcategory,
      catgory: ddlCategory, subcatgory: ddlSubCategory, subsubcatgory: ddlSubSubCategory,
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate, toDate, FileName, ByUserId: String(ByUserId),
    });
  } catch (ex) {
    console.error(ex.message);
    res.json({ view: '~/Views/PageNotFound/Index.cshtml' }); // View("PageNotFound")
  }
}));

// auth (legacy: public)
router.all(`${P}/subcategorylist{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const catid = parseInt(req.p.catid, 10);
  const rows = await db.query(DB, 'SELECT scatid, scatname FROM product_subcategory WHERE scatactive = true and catid = @catid', { catid });
  res.json(mapRows(rows, ['SCATID', 'SCATNAME']));
}));

// auth (legacy: public)
router.all(`${P}/subsubcategorylist{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const SCATID = parseInt(req.p.SCATID, 10);
  const rows = await db.query(DB, 'SELECT kmid, keywordname FROM keyword_master WHERE kactive = true and scatid = @scatid', { scatid: SCATID });
  res.json(mapRows(rows, ['KMID', 'KEYWORDNAME']));
}));

module.exports = router;
