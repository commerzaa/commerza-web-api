// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\Posted_Blog.cs (class Posted_BlogController => /portal/Posted_Blog/...)
'use strict';
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { csErr, mvcStr, mvcIntN, mvcInt, toInt32, toStr, outOf } = require('./_shared/batch-03-common');
const { view } = require('./_shared/batch-06-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/Posted_Blog';

/** class Postedbloghistory */
const POSTEDBLOGHISTORY_PROPS = ['TSBMID', 'PLID', 'REGNO', 'Title', 'Introduction', 'Description', 'Conclusion', 'PostedDate', 'TTMID', 'Status',
  'ApprovalStatus', 'IsEditPossible', 'IsDeletePossible', 'IsDeactivatePossible', 'ActivityDate', 'AccuracyPercentage', 'TopicName', 'Remark',
  'EarnedPoints'];

/**
 * int.Parse(@IntResult OUT .Value.ToString()). PORT-NOTE: the PostgreSQL function returns the OUT value as a column of its rows;
 * with no rows there is no value to read and 0 is used (legacy read the OUT parameter even for an empty page).
 */
function totalOf(rows) {
  if (!rows || rows.length === 0) return 0;
  const v = toStr(outOf(rows, 'intresult'));
  if (!/^\s*[+-]?\d+\s*$/.test(v)) throw csErr('FormatException', 'Input string was not in a correct format.');
  return parseInt(v, 10);
}

// ---------------------------------------------------------------- ActionResult Index(string fromdate, string todate, string Status, int? page, string ddltopic)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/posted-blog" -> Posted_Blog/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/posted-blog'], ps.customerAuth, asyncHandler(async (req, res) => {
  let fromdate = mvcStr(req, 'fromdate'); let todate = mvcStr(req, 'todate'); let Status = mvcStr(req, 'Status');
  let page = mvcIntN(req, 'page'); let ddltopic = mvcStr(req, 'ddltopic');
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Status === null) Status = '0';
  if (ddltopic === null || ddltopic === '') ddltopic = '0';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const Plid = Number(req.user.plid);
  // DBO.USP_Get_Posted_Blog @PLID,@STARTROWINDEX,@MAXROWS,@FromDate,@ToDate,@ddlStatus,@IntResult OUT,@loginid,@Username,@Name,@Mode,@TSBMID,@isAdmin,@ByType,@ddltopic
  const rows = await db.proc(DB, 'usp_get_posted_blog', {
    plid: toInt32(Plid), startrowindex: page, maxrows: MaxRows, fromdate: fromdate.trim(), todate: todate.trim(), ddlstatus: toInt32(Status),
    loginid: '', username: '', name: '', mode: '0', tsbmid: '0', isadmin: '0', bytype: '2', ddltopic: toInt32(ddltopic),
  });
  const MAIL_HISTORY = mapRows(rows, POSTEDBLOGHISTORY_PROPS);
  const TotalRecord = totalOf(rows);
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.Status = Status;
  return view(res, '~/Views/CustomerPanel/Posted_Blog/Index.cshtml', MAIL_HISTORY, ViewBag);
}));

/** DBO.Usp_SubmitedBlogMaster @Mode,@PLID,@Title,@Introduction,@Description,@Conclusion,@TTMID,@IntResult OUT,@TSBMID */
async function submitedBlog(req, Mode, id) {
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_submitedblogmaster', {
    mode: toInt32(Mode), plid: toInt32(Plid), title: '', introduction: '', description: '', conclusion: '', ttmid: toInt32('0'), tsbmid: id,
  });
  return toStr(outOf(rows, 'intresult')); // SpOutput.Value.ToString() (DBNull => "")
}

// ---------------------------------------------------------------- JsonResult RemoveBlog(int id)
// auth (legacy cast (Login)Session["Plid"] without a null check)
router.all(`${C}/RemoveBlog{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const id = mvcInt(req, 'id');
  return res.json(await submitedBlog(req, '3', id));
}));

// ---------------------------------------------------------------- JsonResult ActiveBlog(int id)
// auth
router.all(`${C}/ActiveBlog{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const id = mvcInt(req, 'id');
  return res.json(await submitedBlog(req, '5', id));
}));

// ---------------------------------------------------------------- JsonResult DeactiveBlog(int id)
// auth
router.all(`${C}/DeactiveBlog{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const id = mvcInt(req, 'id');
  return res.json(await submitedBlog(req, '6', id));
}));

module.exports = router;
