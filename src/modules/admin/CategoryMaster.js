'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CategoryMaster.cs (class CategoryMasterController => /admin/CategoryMaster/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  s, ni, reqInt, col, str, toInt32, netStr, nowStamp, tab, excelHistory, sendTsv, netDateStr, cvtInt, sendJson, inlinePermissionsExcelFirst,
} = require('./_shared/batch04A_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'CategoryMaster';

/** class CategoryMasterDetails */
const PROPS = ['ROWNUMBER', 'PCMID', 'Status1', 'Status', 'Name', 'Category', 'Remark', 'Date', 'Added_by'];

let url = '';
let url1 = '';

/** DBO.USP_GetCategoryDetails @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Category */
const categoryDetails = (fromDate, toDate, MAXROWS, STARTROWINDEX, Category) => db.proc(DB, 'USP_GetCategoryDetails', {
  fromDate, toDate, MAXROWS, STARTROWINDEX, Category,
});

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string Category)
async function ExportReport(req, res, ViewBag, fromDate, toDate, Category) {
  const userid = req.user.emp_id;
  const Filename = `Manage_GST${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const _CategoryMasterDetails = mapRows(await categoryDetails(fromDate, toDate, 999999, 1, Category), PROPS);
  if (_CategoryMasterDetails.length > 0) {
    let srno = 1;
    return sendTsv({
      req, res, ViewBag, sheet: 'Manage_GST.xls', downloadName: ' Manage_GST.xls', Filename, rows: _CategoryMasterDetails,
      rowErrProc: 'ExportReport', outerErrProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      headers: ['S.No.', 'Category Name', 'Date', 'Added By'],
      cells: (item, w) => {
        w(tab(String(srno)) + ' \t');
        w(tab(netStr(item.Name)) + ' \t');
        w(tab(netDateStr(item.Date)) + ' \t');
        w(tab(netStr(item.Added_by)) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string fromDate, string toDate, string Category, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Category-Master" -> CategoryMaster/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Category-Master{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = s(req.p.fromDate); let toDate = s(req.p.toDate); let Category = s(req.p.Category); let page = ni(req.p.page);
  let btnexel = s(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const perm = await inlinePermissionsExcelFirst(req.user.emp_id, url); // USP_EXCEL_LINK, then USP_GETEXCELPERMISIONSTATUS
  ViewBag.excelactive = perm.excelactive;
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  if (btnexel === null) btnexel = '';
  if (Category === null) Category = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = 100;
  if (page === null) page = 1;
  const raw = await categoryDetails(fromDate, toDate, MaxRows, page, Category);
  const CategoryMasterDetails = mapRows(raw, PROPS);
  const TotalRecord = toInt32(str(col(raw[0], 'totalcount')));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromDate, toDate, Category);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/CategoryMaster/Index.cshtml', Model: CategoryMasterDetails, ...ViewBag });
}));

// auth (public void action; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, s(req.p.fromDate), s(req.p.toDate), s(req.p.Category));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetManageCategoryById(string PCMID)
// auth (no session check in legacy; admin master data => protected)
router.all(`/admin/${C}/GetManageCategoryById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const PCMID = cvtInt(s(req.p.PCMID)); // Convert.ToInt64(PCMID)
  const row = await db.procOne(DB, 'UPS_GetManageCategoryById', { PCMID });
  sendJson(res, row ? mapRow(row, PROPS) : null);
}));

// ---------------------------------------------------------------- JsonResult CheckCategoryname(string Category)
// auth (no session check in legacy; admin master data => protected)
router.all(`/admin/${C}/CheckCategoryname{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'UPS_Checkcategorybyname', { Category: s(req.p.Category) });
  res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult AddCategory(int PCMID, string Category, string Status)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/AddCategory{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const PCMID = reqInt(req.p.PCMID, 'PCMID');
  const Category = s(req.p.Category);
  const Status = cvtInt(s(req.p.Status));
  let Ret = '0';
  const loginid = req.user.emp_id;
  // [USP_CREATE_NEW_Category] @PCMID,@Category,@Status,@loginid,@STRRESULT out
  const row = await db.procOne(DB, 'USP_CREATE_NEW_Category', { PCMID, Category, Status, loginid });
  Ret = str(col(row, 'strresult'));
  res.json(Ret);
}));

module.exports = router;
