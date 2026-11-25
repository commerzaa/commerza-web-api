'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ManageBrand.cs (class ManageBrandController => /ManageBrand/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GetBrandDetails, UPS_GetManageBrandById, UPS_Checkbyname, USP_CREATE_NEW_Brand, USP_PRODUCTCATEGORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, s0, reqInt, cvtInt, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outStr, outIntOf,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'ManageBrand';

/** class ManageBrandDetails */
const PROPS = ['ROWNUMBER', 'BMID', 'PCMID', 'B_Code', 'Status1', 'Status', 'Name', 'Category', 'Remark', 'Date', 'Added_by'];

/**
 * class ManageBrand { int PCMID; string NAME; List<ManageBrand> BindCATEGORY() }  (model class with a method, declared in this controller file;
 * used by the views). [DBO].[USP_PRODUCTCATEGORY]; the catch re-threw (`throw ExpObj;` - the ErrorInsert block after it was unreachable).
 */
class ManageBrand {
  constructor() { this.PCMID = 0; this.NAME = null; }

  async BindCATEGORY() {
    const PRODUCTCATEGORY = mapRows(await db.proc(DB, 'USP_PRODUCTCATEGORY', {}), ['PCMID', 'NAME']);
    if (PRODUCTCATEGORY !== null) return PRODUCTCATEGORY;
    return null;
  }
}

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string fromDate, string toDate)
async function ExportReport(req, res, fromDate, toDate, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Manage_Brand' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const list = mapRows(await db.proc(DB, 'USP_GetBrandDetails', { fromDate, toDate, MAXROWS: 999999, STARTROWINDEX: 1 }), PROPS);
  if (list.length > 0) {
    let srno = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Manage_Brand.xls', downloadName: ' Manage_Brand.xls', Filename,
      headers: ['S.No.', 'Brand Name', 'Brand Code', 'Category Type', 'Date', 'Added By'],
      rows: list, innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(String(srno)) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'B_Code')) + ' \t');
        w(tab(cellStr(item, 'Category')) + ' \t');
        w(tab(cellStr(item, 'Date')) + ' \t');
        w(tab(cellStr(item, 'Added_by')) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(string fromDate, string toDate, string CategoryType, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Manage-Brand" -> ManageBrand/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manage-Brand'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  const btnexel = s0(req.p.btnexel);
  const CategoryType = s0(req.p.CategoryType); void CategoryType;
  const fromDate = s0(req.p.fromDate);
  const toDate = s0(req.p.toDate);
  let page = nInt(req.p.page);
  const MaxRows = 100;
  if (page === null) page = 1;
  // DBO.USP_GetBrandDetails @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out
  const rows = await db.proc(DB, 'USP_GetBrandDetails', { fromDate, toDate, MAXROWS: MaxRows, STARTROWINDEX: page });
  const ManageBrandDetails = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate, toDate,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, fromDate, toDate, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/ManageBrand/Index.cshtml', Model: ManageBrandDetails, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetManageBrandById(string BMID)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/GetManageBrandById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'UPS_GetManageBrandById', { BMID: cvtInt(nStr(req.p.BMID)) });
  return res.json(rows.length ? mapRow(rows[0], PROPS) : null);
}));

// ---------------------------------------------------------------- JsonResult Checkbrandname(string Brand, int CategoryType)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/Checkbrandname{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const CategoryType = reqInt(req.p.CategoryType, 'CategoryType');
  const rows = await db.proc(DB, 'UPS_Checkbyname', { Brand: nStr(req.p.Brand), CategoryType, mode: 1 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult CheckBrandcode(string Brandcode, string Brand, int CategoryType)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/CheckBrandcode{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const CategoryType = reqInt(req.p.CategoryType, 'CategoryType');
  // PORT-NOTE: legacy also added a SqlParameter named "@@B_code" (Brandcode) that the command text "[UPS_Checkbyname] @Brand,@CategoryType,@mode"
  // never referenced, so the proc never received it; it is not passed here either.
  const rows = await db.proc(DB, 'UPS_Checkbyname', { Brand: nStr(req.p.Brand), CategoryType, mode: 2 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult AddBrand(int BMID, string Brand, string Brandcode, string CategoryType, string Status, string Remark)
// auth (reads Session["Admin_User"].Emp_ID => NullReferenceException without a session)
router.all(`/admin/${C}/AddBrand{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const BMID = reqInt(req.p.BMID, 'BMID');
  let Ret = '0';
  const loginid = req.user.emp_id;
  // [USP_CREATE_NEW_Brand] @BMID,@Brand,@Brandcode,@CategoryType,@Remark,@Status,@loginid,@STRRESULT out
  const row = await db.procOne(DB, 'USP_CREATE_NEW_Brand', {
    BMID, Brand: nStr(req.p.Brand), Brandcode: nStr(req.p.Brandcode), CategoryType: cvtInt(nStr(req.p.CategoryType)), Remark: nStr(req.p.Remark),
    Status: cvtInt(nStr(req.p.Status)), loginid,
  });
  Ret = outStr(row, 'strresult');
  return res.json(Ret);
}));

module.exports = router;
module.exports.ManageBrand = ManageBrand;
