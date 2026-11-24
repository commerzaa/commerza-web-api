'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Reward_Achive.cs (Reward_AchiveController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

const REWARD_PROPS = ['FROMDATE', 'TODATE', 'LEFTBUSINESS', 'RIGHTBUSINESS', 'MATCHVOLUMNE', 'REWARDNAME'];
const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');

// auth
// route-config: "referral/aUhVgABBeTa9MmyBzD22nA==" -> Reward_Achive/Index
router.all(['/member/Reward_Achive/Index{/:id}', '/member/referral/aUhVgABBeTa9MmyBzD22nA=='], auth, asyncHandler(async (req, res) => {
  try {
    let ddlcustpage = optInt(req.p.ddlcustpage);
    const SearchField = nn(req.p.SearchField);
    const SearchValue = nn(req.p.SearchValue);
    const fromdate = nn(req.p.fromdate);
    const todate = nn(req.p.todate);
    let page = optInt(req.p.page);
    if (ddlcustpage === null) ddlcustpage = 100;

    const Plid = Number(req.user.plid);
    // legacy looked up Member_Master.LOGINID into an unused local; not needed
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;

    const rows = await db.proc(DB, 'usp_binaryrewards', { regno: Math.trunc(Plid) });
    const TotalRecord = 1;
    const ViewBag = {
      CurrentPage: page,
      GridPageSize: MaxRows,
      TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField,
      SearchValue,
      fromDate: fromdate,
      toDate: todate,
      ddlcustpage,
    };
    res.json({ view: '~/Views/CustomerPanel/Reward_Achive/Index.cshtml', Model: mapRows(rows, REWARD_PROPS), ViewBag });
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_BINARYREWARDS', 0, legacyPath(req)); } catch (e) { console.error(e); }
    // legacy: Response.Redirect("/page-not-found")
    res.json({ redirect: '/page-not-found' });
  }
}));

module.exports = router;
