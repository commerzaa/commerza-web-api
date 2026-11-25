'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/All_Downline_Member_List.cs (All_Downline_Member_ListController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc, queryOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV',
  'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName',
  'TITLE', 'PackageAmt', 'STATENAME'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return null;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : f[k];
};

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/all-downline-list  (All_Downline_Member_List / Index)
// auth
router.all(['/member/All_Downline_Member_List/Index{/:id}', '/member/referral/all-downline-list'], auth, asyncHandler(async (req, res) => {
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const Name = nn(req.p.Name); // unused later (legacy passes '' to the proc)
  const Side = toInt(req.p.Side, 0);
  const Level = nn(req.p.Level);
  const ActivationStatus = req.p.ActivationStatus === undefined || req.p.ActivationStatus === null ? '0' : String(req.p.ActivationStatus);
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'SELECT USERNAME FROM Member_master WHERE REGNO = @Plid LIMIT 1', { Plid });
  if (row) loginid = row.username;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = toInt(req.p.page, 1);
  const lvl = toInt(Level === '' ? '0' : Level, null);
  if (lvl === null) throw new Error('Input string was not in a correct format.');
  const act = toInt(ActivationStatus, null);
  if (act === null) throw new Error('Input string was not in a correct format.');
  // PORT-NOTE: @TotalCount / @TotalLRBV / @TOTALLRINCOME / @totalInvesment OUT params are read from the first result row.
  const rows = await proc(DB, 'usp_new_member_get_member_downlinelist_side_wise', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromdate.trim(), todate: todate.trim(),
    levenumber: lvl, side: Side, name: '', username: '', emailid: '', sponserid: '', checkadminside: 0, activationstatus: act,
    userdownlinemember: '', orderbydate: '', fromlevel: 0, tolevel: 0, orderbylevel: 0, mainsearch: '',
  });
  const LRMember = mapRows(rows, PROPS);
  const tc = parseInt(outOf(rows, 'totalcount'), 10);
  const TotalRecord = Number.isNaN(tc) ? 0 : tc;
  const tb = Number(outOf(rows, 'totalinvesment'));
  const totalBV = Number.isNaN(tb) ? 0 : tb; // Convert.ToDecimal(value.ToString())
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate: fromdate, toDate: todate,
    side: Side, SearchField, SearchValue, Level, ActivationStatus, totalBV,
  };
  const ts = await queryOne(DB, 'select STATUS from TBL_SUBMENUROLE_MEMBERPANEL where sid in (12,98) LIMIT 1');
  const TreeStatus = ts ? Number(ts.status) : 0;
  ViewBag.TreeStatus = TreeStatus === 1 ? 1 : 0;
  return res.json({ view: '~/Views/CustomerPanel/All_Downline_Member_List/Index.cshtml', Model: LRMember, ViewBag });
}));

module.exports = router;
