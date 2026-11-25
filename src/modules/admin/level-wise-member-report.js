'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\LevelWiseMemberReport.cs (class LevelWiseMemberReportController => /LevelWiseMemberReport/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nInt, nStr, outOf } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'LevelWiseMemberReport';

/** class LevelWiseMemberReport_Class */
const PROPS = ['RowNumber', 'Level', 'TotalRegisteredMember', 'TotalActiveMember', 'TotalBusinessVolume'];

// ---------------------------------------------------------------- Index(int? page, string fromDate, string toDate)
// auth (PORT-NOTE: legacy had NO session check on this all-member admin report - protected with adminAuth)
// route-config: "AdminPanel/level-wise-member-report" -> LevelWiseMemberReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/level-wise-member-report'], adminAuth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize(); // (unused by the legacy code)
  void MaxRows;
  let page = nInt(req.p.page); if (page === null) page = 1;
  let fromDate = nStr(req.p.fromDate); if (fromDate === null) fromDate = '';
  let toDate = nStr(req.p.toDate); if (toDate === null) toDate = '';
  let Obj = [];
  const ViewBag = {};
  try {
    // [Usp_LevelWiseIncomeDetails] @PLID,@TotalMember out,@InActiveMember out,@ActiveMember out,@BusinessVolume out
    const rows = await db.proc(DB, 'Usp_LevelWiseIncomeDetails', { PLID: '0' });
    Obj = mapRows(rows, PROPS);
    ViewBag.totalmem = outOf(rows, 'totalmember');
    ViewBag.totalinactmem = outOf(rows, 'inactivemember');
    ViewBag.totalactmem = outOf(rows, 'activemember');
    ViewBag.totalbusiness = outOf(rows, 'businessvolume');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_LevelWiseIncomeDetails');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  return res.json({ view: '~/Views/AdminPanel/LevelWiseMemberReport/Index.cshtml', Model: Obj, ...ViewBag });
}));

module.exports = router;
