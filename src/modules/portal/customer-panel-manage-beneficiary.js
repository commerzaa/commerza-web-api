'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/ManageBeneficiaryController.cs
// (namespace Eblaa_Web.Controllers.CustomerPanel, class ManageBeneficiaryController, [CheckResellerTimeout]; no DB access)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();
const P = '/portal/ManageBeneficiary';

// public ([CheckResellerTimeout] body is commented out in legacy => no session check)
router.all([`${P}/Index{/:id}`, P], ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  // return View()  => ~/Views/ManageBeneficiary/Index.cshtml (no model, no ViewBag)
  res.json({ view: '~/Views/ManageBeneficiary/Index.cshtml' });
}));

module.exports = router;
