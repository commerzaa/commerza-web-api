'use strict';
// Port of Member\Common\Controllers\CustomerPanel\DirectorPerformanceBonusDetails.cs (DirectorPerformanceBonusDetailsController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
const DirectorBonusDetails = ['ROWNUMBER', 'USERNAME', 'ADMIN', 'RANKNAME', 'TOTALPAYBLE', 'TDS', 'QUALIFICATION', 'REQUIRED', 'CUMMULATIVEBV', 'ACCUMULATIVEPV', 'NewPPV', 'PAYID'];

// auth
router.all('/member/DirectorPerformanceBonusDetails/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const dynamicpagging = p.dynamicpagging === undefined || p.dynamicpagging === '' ? 100 : parseInt(p.dynamicpagging, 10);
  let PayId = p.PayId === undefined || p.PayId === '' ? null : parseInt(p.PayId, 10);
  const Page = p.Page === undefined || p.Page === '' ? 1 : parseInt(p.Page, 10);
  const Plid = Number(req.user.plid);
  let PerformanceBonus = [];
  const ViewBag = {};
  const MaxRows = dynamicpagging;
  if (PayId === null) {
    PayId = 0;
    const rows = await db.proc(DB, 'newdirectorbonuscpn', { plid: Math.trunc(Plid), username: p.SearchField === undefined ? null : p.SearchField, payid: PayId });
    PerformanceBonus = mapRows(rows, DirectorBonusDetails);
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = 100;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  }
  res.json({ Model: PerformanceBonus, ...ViewBag });
}));

// auth
router.all('/member/DirectorPerformanceBonusDetails/getdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'seprateincomedetails', { username: req.p.USERNAME, payid: parseInt(req.p.PAYID, 10) });
  const purchasepackdetails = mapRows(rows, DirectorBonusDetails);
  if (purchasepackdetails !== null && purchasepackdetails.length > 0) {
    return res.json(purchasepackdetails);
  }
  return res.json('error');
}));

module.exports = router;
