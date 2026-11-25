'use strict';
// Ported from Shoping Portal Merchant Panel/Controllers/CustomerPanel/WorkingHours.cs  (DB: shopping - Db_Shopping)
const express = require('express');
const router = express.Router();
const { scalar, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const BASE = '/merchant/WorkingHours';

// auth (session null check -> auth)
// route-config: merchant/workinghours
router.all([`${BASE}/Index{/:id}`, BASE, '/merchant/merchant/workinghours'], auth, asyncHandler(async (req, res) => {
  res.json({});
}));

// auth
router.all(`${BASE}/UpdateWorkingHours{/:id}`, auth, asyncHandler(async (req, res) => {
  const { dayid, openTime, closeTime, openTimeEvening, closeTimeEvening, isClosed } = req.p;
  const Plid = req.user.plid;
  const pm = await scalar('shopping', 'select pmid from portal_master where plid = @plid and active = true limit 1', { plid: Plid });
  const Pmid = pm === null || pm === undefined ? 0 : pm;
  const row = await procOne('shopping', 'usp_updatebusinessworkinghours', {
    pmid: Pmid, dayid: dayid.trim(), opentime: openTime.trim(), closetime: closeTime.trim(),
    opentimeevening: openTimeEvening.trim(), closetimeevening: closeTimeEvening.trim(), isclosed: isClosed.trim(),
  });
  // PORT-NOTE: @STRRESULT OUT read from "strresult" column
  res.json(String(row && row.strresult !== null && row.strresult !== undefined ? row.strresult : ''));
}));

module.exports = router;
