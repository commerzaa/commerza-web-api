'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/WorkingHours.cs (WorkingHoursController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { outCol } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: merchant/workinghours -> WorkingHours/Index
router.all(['/portal/WorkingHours/Index{/:id}', '/portal/WorkingHours', '/portal/merchant/workinghours{/:id}'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/WorkingHours/Index.cshtml' });
});

// auth (unguarded (Login)Session["Plid"] cast)
router.all('/portal/WorkingHours/UpdateWorkingHours{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const { dayid, openTime, closeTime, openTimeEvening, closeTimeEvening, isClosed } = req.p; // pmidParam unused in legacy
  const Plid = Number(req.user.plid);
  const pm = await db.scalar(DB, 'select pmid from portal_master where plid = @plid and active::int = 1 limit 1', { plid: Plid });
  const Pmid = pm === null || pm === undefined ? 0 : Number(pm);
  // legacy: null string parameters -> NullReferenceException on .Trim()
  const row = await db.procOne(DB, 'usp_updatebusinessworkinghours', {
    pmid: Pmid, dayid: dayid.trim(), opentime: openTime.trim(), closetime: closeTime.trim(),
    opentimeevening: openTimeEvening.trim(), closetimeevening: closeTimeEvening.trim(), isclosed: isClosed.trim(),
  });
  // @STRRESULT OUT (int) -> "strresult" column
  const v = outCol(row, 'strresult');
  res.json(String(v === null || v === undefined ? '' : v));
}));

module.exports = router;
