'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\PerformanceBonusDetails.cs (PerformanceBonusDetailsController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/PerformanceBonusDetails';
const PROPS = ['ROWNUMBER', 'USERNAME', 'ADMIN', 'RANKNAME', 'TOTALPAYBLE', 'TDS', 'QUALIFICATION', 'REQUIRED', 'CUMMULATIVEBV', 'ACCUMULATIVEPV',
  'NewPPV', 'PAYID', 'RECPER', 'selfComm', 'fromComm', 'PVRATE', 'ISSELF'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/Ln_plus_AzmvCr9MiEgwBonusDetails" -> PerformanceBonusDetails/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/Ln_plus_AzmvCr9MiEgwBonusDetails'], auth, asyncHandler(async (req, res) => {
  let dynamicpagging = toInt(req.p.dynamicpagging);
  let Page = toInt(req.p.Page);
  let PayId = toInt(req.p.PayId);
  if (dynamicpagging == null) dynamicpagging = 100;
  const Plid = Number(req.user.plid);
  let PerformanceBonus = [];
  const ViewBag = {};
  const MaxRows = dynamicpagging;
  if (Page == null) Page = 1;
  if (PayId == null) {
    PayId = 0;
    const rows = await proc(DB, 'performancebonusdetails', { plid: Math.trunc(Plid), payid: PayId });
    PerformanceBonus = mapRows(rows, PROPS);
    Object.assign(ViewBag, {
      CurrentPage: Page, GridPageSize: MaxRows, TotalRecord: 100, dynamicpagging, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    });
  }
  res.json({ Model: PerformanceBonus, ViewBag });
}));

// auth (legacy had no session check but the action reads a member's income detail; it is only used from the logged-in page)
router.all(`${P}/getdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const USERNAME = req.p.USERNAME;
  const PAYID = toInt(req.p.PAYID);
  // @TotalPayable is an OUTPUT parameter (legacy only stored the SqlParameter object in ViewBag, it was never returned)
  const rows = await proc(DB, 'seprateincomedetails', { username: USERNAME, payid: PAYID });
  const purchasepackdetails = mapRows(rows, PROPS);
  if (purchasepackdetails != null && purchasepackdetails.length > 0) return res.json(purchasepackdetails);
  res.json('error');
}));

module.exports = router;
