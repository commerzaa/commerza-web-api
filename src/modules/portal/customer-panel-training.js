'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Training.cs (TrainingController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');

const router = express.Router();
const DB = 'shopping';
const PROPS = ['NAME', 'DATA'];

async function trainingData() {
  const rows = await db.query(DB, 'select name, data from tbl_trainingdata where videotype = 1 and contenttype = 1 and status::int = 1 order by tdid desc');
  return mapRows(rows, PROPS);
}

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home")). RouteConfig "user/training" is commented out.
router.all(['/portal/Training/Index{/:id}', '/portal/Training'], ps.customerAuth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid); // eslint-disable-line no-unused-vars
  res.json({ view: '~/Views/CustomerPanel/Training/Index.cshtml', Layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml', Model: await trainingData() });
}));

// auth. RouteConfig "referral/training" is commented out.
router.all('/portal/Training/IndexReferral{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid); // eslint-disable-line no-unused-vars
  res.json({ view: '~/Views/CustomerPanel/Training/Index.cshtml', Layout: '~/Views/Shared/_ReferralLayout.cshtml', Model: await trainingData() });
}));

module.exports = router;
