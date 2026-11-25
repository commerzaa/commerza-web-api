'use strict';
// Ported from Member\Controllers\CustomerPanel\Reward_List.cs (1 action) - database: affiliate (Db_Affiliate)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const nz = (v) => (v === undefined || v === null ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}

// auth
// route-config: referral/jDWe8vAmeE4ftAcuAIEPuw== -> Index
router.all(['/member/Reward_List/Index{/:id}', '/member/referral/jDWe8vAmeE4ftAcuAIEPuw=='], auth, asyncHandler(async (req, res) => {
  try {
    let ddlcustpage = intOrNull(req.p.ddlcustpage); let page = intOrNull(req.p.page);
    if (ddlcustpage === null) ddlcustpage = 100;
    const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
    const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
    const Plid = Number(req.user.plid);
    // loginid lookup (Member_Master.LOGINID) was unused by the legacy action; omitted (no side effects).
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_GETEWALLET_REWARDS', {});
    const Model = mapRows(rows, ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS']);
    const TotalRecord = parseInt(String(outv(rows, 'TOTALCOUNT')), 10) || 0;
    const REWARDSAMOUNTS = Number(outv(rows, 'REWARDSAMOUNT'));
    const ADMINCHARGES = Number(outv(rows, 'ADMINCHARGE'));
    const PAYBLEAMOUNTS = Number(outv(rows, 'PAYBLEAMOUNT'));
    res.json({
      Model, REWARDSAMOUNTS, ADMINCHARGES, PAYBLEAMOUNTS, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
    });
    void Plid;
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'USP_ALL_REWARDACHIVERS', req);
    res.json({ redirect: '/page-not-found' });
  }
}));

module.exports = router;
