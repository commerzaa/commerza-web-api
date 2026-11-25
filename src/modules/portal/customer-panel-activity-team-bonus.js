'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\ActivityTeamBonus.cs (class ActivityTeamBonusController => /portal/ActivityTeamBonus/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, view, optInt, outv } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/ActivityTeamBonus';

/** class GetEarningWalletHistory (Controllers/CustomerPanel/Earnings.cs) */
const EARNING_WALLET_HISTORY = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints',
  'TotalEarnedPoints', 'Status', 'PayId'];

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/activity-team-bonus" -> ActivityTeamBonus/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/activity-team-bonus'], ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ddlcustpage = optInt(p.ddlcustpage);
  let page = optInt(p.page);
  const str = (v) => (v === undefined || v === null ? null : String(v));
  let SearchField = str(p.SearchField);
  let SearchValue = str(p.SearchValue);
  let fromdate = str(p.fromdate);
  let todate = str(p.todate);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';

  const Plid = Number(req.user.plid);
  const ViewBag = {};
  // db._Member_Master.Where(a => a.PLID == Plid).FirstOrDefault() - loginid is computed but never used (kept)
  let loginid = '';
  const row = await db.queryOne(DB, 'select loginid from member_master where plid = @Plid limit 1', { Plid });
  if (row !== null) loginid = row.loginid;
  void loginid;
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;

  const rows = await db.proc(DB, 'usp_member_Earning_history', {
    plid: Math.trunc(Plid), StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    fromDate: fromdate.trim(), ToDate: todate.trim(),
  });
  const AllFreeEpinList = mapRows(rows, EARNING_WALLET_HISTORY);
  // int.Parse(spOutput.Value.ToString())
  const tc = outv(rows, 'TotalCount');
  if (tc === null || !/^\s*[+-]?\d+\s*$/.test(String(tc))) throw new Error('Input string was not in a correct format.');
  const TotalRecord = parseInt(tc, 10);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  return view(res, '~/Views/CustomerPanel/ActivityTeamBonus/Index.cshtml', AllFreeEpinList, ViewBag);
}));

module.exports = router;
