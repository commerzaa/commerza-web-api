// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Merchant_UploadBulkProduct.cs (class Merchant_UploadBulkProductController; DB: Db_Shopping, via ProductDal)
// Started from src/modules/merchant/merchant-upload-bulk-product.js, then matched line by line with the portal C#.
'use strict';
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');

const router = express.Router();
const P = '/portal/Merchant_UploadBulkProduct';
const VIEW = '~/Views/CustomerPanel/Merchant_UploadBulkProduct/Index.cshtml';

/** HttpPostedFileBase upload: multer memory storage, field "upload" (any field accepted, first file named "upload" wins). */
function uploadMiddleware(req, res, next) {
  const ct = String((req.headers && req.headers['content-type']) || '');
  if (!/multipart\/form-data/i.test(ct)) return next();
  const multer = require('multer');
  return multer({ storage: multer.memoryStorage() }).any()(req, res, next);
}

// auth ([SessionExpireCheck]); PrCode, search, filtercategory, page, ddlstatus are bound but unused
// route-config: merchant/bulkupload -> Merchant_UploadBulkProduct/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/bulkupload'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  c.bindNullableInt(req, 'page');
  c.bindNullableInt(req, 'ddlstatus');
  return c.viewJson(res, VIEW, undefined, {});
}));

// auth ([SessionExpireCheck] [HttpPost] [ValidateAntiForgeryToken])
// PORT-NOTE: [ValidateAntiForgeryToken] is not enforced (the JWT bearer token replaces the cookie session; no anti-forgery cookie exists).
router.post(`${P}/Upload{/:id}`, ps.SessionExpireCheck, uploadMiddleware, asyncHandler(async (req, res) => {
  const ModelState = {};
  const files = req.files || [];
  const upload = files.find((f) => String(f.fieldname).toLowerCase() === 'upload') || null;
  // if (ModelState.IsValid) - no model validation attributes => always valid
  if (upload !== null && upload.size > 0) {
    const FileName = String(upload.originalname || '');
    let isXlsx = false;
    if (FileName.endsWith('.xls')) {
      isXlsx = false; // ExcelReaderFactory.CreateBinaryReader
    } else if (FileName.endsWith('.xlsx')) {
      isXlsx = true; // ExcelReaderFactory.CreateOpenXmlReader
    } else {
      ModelState.File = 'This File Format Is Not Supported';
      return c.viewJson(res, VIEW, undefined, { ModelState });
    }
    void isXlsx;
    // reader.IsFirstRowAsColumnNames = true; DataSet result = reader.AsDataSet();
    let result = b.readExcelDataSet(upload.buffer);

    // #region ForInsert
    const BranchId = Number(req.user.plid);
    let SellerCode = '';
    SellerCode = String(BranchId);
    const xmllist = b.GenerateXMLProductList(result, SellerCode);

    result = await b.insertBulkProductDataSet(BranchId, xmllist);
    // #endregion ForInsert
    const ViewBag = {};
    if (result.Tables.length > 0) {
      const t1 = result.Tables[1];
      if (!t1) throw new RangeError('Cannot find table 1.');
      const r0 = t1[0];
      if (!r0) throw new RangeError('There is no row at position 0.');
      ViewBag.TotalColumnCount = c.str(r0.TotalColumnCount);
      ViewBag.TotalRowsCount = c.str(r0.TotalRowsCount);
      ViewBag.TotalErrorCount = c.str(r0.TotalErrorCount);
      ViewBag.TotalSuccessCount = c.str(r0.TotalSuccessCount);
      ViewBag.TotalRepeatCount = c.str(r0.TotalRepeatCount);
      // TempData["DataSet"] = result  (stored as plain tables; row arrays lose their .Columns, restored on read)
      ps.tempDataSet(req, 'DataSet', { Tables: result.Tables.map((t) => ({ Columns: t.Columns || (t.length ? Object.keys(t[0]) : []), Rows: t })) });
    } else {
      ModelState.File = 'Some error occured while uploading.';
      return c.viewJson(res, VIEW, undefined, { ModelState });
    }
    return c.viewJson(res, VIEW, result.Tables[0], ViewBag);
  }
  ModelState.File = 'Please Upload Your File';
  return c.viewJson(res, VIEW, undefined, { ModelState });
}));

/** TempData["DataSet"] -> DataSet ({ Tables: [rows with .Columns] }) or null */
function dataSetFromTempData(v) {
  if (v === null || v === undefined) return null;
  const tables = (v.Tables || []).map((t) => {
    const rows = Array.isArray(t) ? t.slice() : (t.Rows || []).slice();
    rows.Columns = Array.isArray(t.Columns) ? t.Columns : (rows.length ? Object.keys(rows[0]) : []);
    return rows;
  });
  return { Tables: tables, raw: v };
}

// auth ([SessionExpireCheck]; the inner Session["Plid"] == null check is unreachable but kept)
router.all(`${P}/ExportExcel{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  if (!ps.isCustomer(req)) return res.json('Session Expired. Please login again');
  let ret = 'Failed';
  const BranchId = Number(req.user.plid);
  void BranchId;
  const ds = dataSetFromTempData(ps.tempDataGet(req, 'DataSet'));
  if (ds === null) throw c.NRE(); // ds.Tables on null
  if (ds.Tables.length > 0) {
    ps.tempDataSet(req, 'DataSet', ds.raw);
    ret = await b.ExportExcelForReporting(ds);
    if (ret !== 'Failed') {
      // Download_File("~\\Sheets\\" + ret);  (commented out in legacy)
    }
  }
  return res.json(String(ret));
}));

// public (public string action without a session check; the model binder supplies an empty DataSet => no sheet => "Failed")
router.all(`${P}/ExportExcelForReporting{/:id}`, asyncHandler(async (req, res) => {
  const ret = await b.ExportExcelForReporting({ Tables: [] });
  res.type('text/html').send(ret);
}));

// private string GenerateXMLProductList(DataSet, string) => batch-23-common (not an action)

module.exports = router;
