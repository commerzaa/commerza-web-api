'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_Rewards_Achiver.cs (class Binary_Rewards_AchiverController => /Binary_Rewards_Achiver/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toInt32 } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Binary_Rewards_Achiver';

/** class BinaryRewardAchive */
const PROPS = ['FROMDATE', 'TODATE', 'LEFTBUSINESS', 'RIGHTBUSINESS', 'MATCHVOLUMNE', 'REWARDNAME'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string username, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Binary-Rewards-Achiver" -> Binary_Rewards_Achiver/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Binary-Rewards-Achiver'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let SearchField = sv(req.p.SearchField);
  let username = sv(req.p.username); // eslint-disable-line no-unused-vars
  let SearchValue = sv(req.p.SearchValue);
  let fromdate = sv(req.p.fromdate);
  let todate = sv(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (username === null) username = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_ALLREWARDACHIVERS', {});
    const RewardAchivers = mapRows(rows, PROPS);
    // Convert.ToInt16(spOutput.Value == "0" ? "0" : spOutput.Value.ToString()) - object/string reference comparison is always false
    // => Value.ToString(); DBNull => "" => FormatException (caught => PageNotFound), like legacy
    const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    return res.json({ view: '~/Views/AdminPanel/Binary_Rewards_Achiver/Index.cshtml', Model: RewardAchivers, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_ALLREWARDACHIVERS');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

module.exports = router;
