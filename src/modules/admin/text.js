'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Text.cs (class TextController => /admin/Text/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_REFERRALTEXT, USP_EXCEL_DOWNLOAD_HISTORY. Table tbl_referraltext.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nStr, reqInt, col, str, cellStr, tab, nowStamp, excelHistory, writeXlsExport, excelLink, inlinePerms, cvtInt,
} = require('./_shared/batch11-common');
const { viewRes } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'Text';

/** class Text */
const TEXT_PROPS = ['ROWNUMBER', 'REFTID', 'TITLE', 'URL', 'DESCRIPTION', 'DATE', 'ACTIVE', 'STATUS'];
const LIST_SQL = `select row_number() over (order by date asc) as rownumber, reftid, coalesce(title, '') as title,
  coalesce(description, '') as description, coalesce(url, '') as url, date, active, status from tbl_referraltext`;

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const REFRERRAL = mapRows(await db.query(DB, LIST_SQL, {}), TEXT_PROPS);
  if (REFRERRAL.length > 0) {
    let RowNumber = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Text.xls', Filename,
      headers: ['S.No.', 'Title', 'Date', 'Description', 'URL', 'Status'],
      rows: REFRERRAL,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cellStr(item, 'TITLE')) + ' \t');
        w(tab(cellStr(item, 'DATE')) + ' \t');
        w(tab(cellStr(item, 'DESCRIPTION')) + ' \t');
        w(tab(cellStr(item, 'URL')) + ' \t');
        w(tab(Number(item.ACTIVE) === 1 ? 'Active' : 'Inactive') + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "adminpanel/Text" -> Text/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/adminpanel/Text'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nStr(req.p.btnexel);
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  const REFRERRAL = mapRows(await db.query(DB, LIST_SQL, {}), TEXT_PROPS);
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return viewRes(res, '~/Views/AdminPanel/Text/Index.cshtml', REFRERRAL, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult InsertUpdateReferral(int REFTID, string title, string description, string url, string ddlactive)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/InsertUpdateReferral{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const REFTID = reqInt(req.p.REFTID, 'REFTID');
  const title = nStr(req.p.title);
  const description = nStr(req.p.description);
  const urlP = nStr(req.p.url); // action parameter `url` (shadows the static field)
  const ddlactive = nStr(req.p.ddlactive);
  const Empid = req.user.emp_code; void Empid;
  try {
    const row = await db.procOne(DB, 'USP_REFERRALTEXT', {
      REFTID: REFTID === 0 ? 0 : REFTID, TITLE: title, DESCRIPTION: description, URL: urlP, ACTIVE: cvtInt(ddlactive), MODE: 1,
    });
    return res.json(str(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_REFERRALTEXT');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult EditReferral(string REFTID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/EditReferral{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const REFTID = cvtInt(nStr(req.p.REFTID)); // Convert.ToInt32(REFTID) (PORT-NOTE: was concatenated into the SQL; parameterised)
  const EditReferral = mapRows(await db.query(DB, `select coalesce(title, '') as title, coalesce(description, '') as description,
    coalesce(url, '') as url, date, active, status from tbl_referraltext where reftid = @REFTID`, { REFTID }), TEXT_PROPS);
  if (EditReferral.length === 0) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
  const ss = EditReferral[0];
  const Data = str(ss.TITLE) + '^' + str(ss.DESCRIPTION) + '^' + str(ss.URL) + '^' + str(ss.ACTIVE);
  return res.json(Data);
}));

// ---------------------------------------------------------------- JsonResult DeleteReferral(string REFTID)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/DeleteReferral{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const REFTID = nStr(req.p.REFTID);
  try {
    // PORT-NOTE: legacy sent @ACTIVE = "" (SQL Server converts '' to int 0); 0 is sent.
    const row = await db.procOne(DB, 'USP_REFERRALTEXT', { REFTID, TITLE: '', DESCRIPTION: '', URL: '', ACTIVE: 0, MODE: 2 });
    return res.json(str(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_REFERRALTEXT');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
