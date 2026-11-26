// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/ReferralBonus.cs (ReferralBonusController => /portal/ReferralBonus/...)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, outInt, optInt, toInt32, view } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/ReferralBonus';
/** Controllers/CustomerPanel/Earnings.cs class GetEarningWalletHistory */
const GET_EARNING_WALLET_HISTORY = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints',
  'TotalEarnedPoints', 'Status', 'PayId'];
const str = (v) => (v === undefined || v === '' ? null : v); // MVC string binding

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: referral/referral-bonus -> ReferralBonus/Index
router.all([`${P}/Index{/:id}`, P, '/portal/referral/referral-bonus{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  let SearchField = str(req.p.SearchField); let SearchValue = str(req.p.SearchValue);
  let fromdate = str(req.p.fromdate); let todate = str(req.p.todate);
  let page = optInt(req.p.page); let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  const Plid = Number(req.user.plid);
  let loginid = ''; // eslint-disable-line no-unused-vars
  const row = await db.queryOne(DB, 'SELECT loginid FROM member_master WHERE plid = @Plid LIMIT 1', { Plid });
  if (row != null) loginid = row.loginid;
  const MaxRows = ddlcustpage;
  if (page == null) page = 1;
  const rows = await db.proc(DB, 'usp_member_earning_history', {
    plid: toInt32(Plid), StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    fromDate: fromdate.trim(), ToDate: todate.trim(),
  });
  const AllFreeEpinList = mapRows(rows, GET_EARNING_WALLET_HISTORY);
  const TotalRecord = outInt(rows, 'totalcount');
  return view(res, '~/Views/CustomerPanel/ReferralBonus/Index.cshtml', AllFreeEpinList, {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate: fromdate,
    toDate: todate,
    ddlcustpage,
  });
}));

module.exports = router;
