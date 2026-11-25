'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Ewallet_RewardsAchivers.cs
// (class Ewallet_RewardsAchiversController => /admin/Ewallet_RewardsAchivers/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Ewallet_RewardsAchivers';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests. (`private string regno` field is unused.)
let url = '';
let url1 = '';

/** class RewardAchivers */
const ACHIVER_PROPS = ['RegNo', 'Amount', 'USERNAME', 'MOBILE', 'REGNO'];

// ---------------------------------------------------------------- [SessionExpireCheck] Index(string SearchField, string username, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Ewallet-RewardsAchivers" -> Ewallet_RewardsAchivers/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ewallet-RewardsAchivers'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = B.nStr(req.p.SearchField);
  let username = B.nStr(req.p.username);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let btnexel = B.nStr(req.p.btnexel);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (username === null) username = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await B.perms(Empid, url));
  try {
    const MaxRows = Number(ddlcustpage);
    if (page === null) page = 1;
    // [usp_EWALLETREWADACHIVERS] @FROMDATE,@TODATE,@USERNAME,@MODE, @TOTALCOUNT out  (CommandTimeout 1000)
    const rows = await db.proc(DB, 'usp_EWALLETREWADACHIVERS', { FROMDATE: fromdate, TODATE: todate, USERNAME: username, MODE: 1 });
    const RewardAchivers = mapRows(rows, ACHIVER_PROPS);
    const tc = B.str(B.col(rows[0], 'totalcount'));
    const TotalRecord = B.cvtInt(tc === '' ? '0' : tc);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      // legacy: empty block
    }
    return res.json({ view: '~/Views/AdminPanel/Ewallet_RewardsAchivers/Index.cshtml', Model: RewardAchivers, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'usp_EWALLETREWADACHIVERS');
  }
}));

module.exports = router;
