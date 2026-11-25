'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Royality_Statement.cs (class Royality_StatementController, no namespace
// => /admin/Royality_Statement/...). Database: affiliate (Db_Affiliate). Proc Usp_RoyalityHistory (@PLID "0").
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { nInt, nStr } = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Royality_Statement';

/** public class Royality_Statement_Class */
const ROYALITY_STATEMENT_PROPS = ['QualifiedLevel', 'FromDate', 'ToDate', 'USERNAME', 'FNAME', 'GrossRoyality', 'AdminCahrge', 'Royality'];

// ---------------------------------------------------------------- ActionResult Index(int? page, string fromDate, string toDate)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Royality-Statement" -> Royality_Statement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Royality-Statement'], adminAuth, asyncHandler(async (req, res) => {
  let page = nInt(req.p.page);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  let Obj = [];
  const ViewBag = {};
  try {
    Obj = mapRows(await db.proc(DB, 'Usp_RoyalityHistory', { PLID: '0' }), ROYALITY_STATEMENT_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    const TotalRecord = 0;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_RoyalityHistory');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found") (ends the response)
  }
  return res.json({ view: '~/Views/AdminPanel/Royality_Statement/Index.cshtml', Model: Obj, ...ViewBag });
}));

module.exports = router;
