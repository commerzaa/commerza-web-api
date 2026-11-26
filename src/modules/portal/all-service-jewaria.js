'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AllServiceJewariaController.cs (class AllServiceJewariaController => /portal/AllServiceJewaria/...)
// Static views. [CheckResellerTimeout]: no check in legacy.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();
const C = '/portal/AllServiceJewaria';

// ---------------------------------------------------------------- Index()
// public
// route-config: "all-service-eblaa" -> AllServiceJewaria/Index
router.all([`${C}/Index{/:id}`, '/portal/all-service-eblaa'], ps.portalSession,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/AllServiceJewaria/Index.cshtml' })));

// ---------------------------------------------------------------- appRechargefailureurl()
// public (recharge failure landing page)
// route-config: "all-Payment-failureurl" -> AllServiceJewaria/appRechargefailureurl
// (the view reads Session["errormessagemobile"]; returned here so the client can render it)
router.all([`${C}/appRechargefailureurl{/:id}`, '/portal/all-Payment-failureurl'], ps.portalSession,
  asyncHandler(async (req, res) => res.json({
    view: '~/Views/AllServiceJewaria/appRechargefailureurl.cshtml',
    Session: { errormessagemobile: ps.sessionGet(req, 'errormessagemobile') },
  })));

module.exports = router;
