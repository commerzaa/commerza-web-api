// Ported from ClusterofferShopingPortal\Controllers\Logout.cs (class LogoutController => /portal/Logout/...)
'use strict';
// Database: none touched. SESSION.md section 5: the client drops its token.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { appStrict } = require('./_shared/batch-20-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// route-config: "Logout" -> Logout/Index
// public (logout: legacy had no session check)
router.all(['/portal/Logout/Index{/:id}', '/portal/Logout'], ps.portalSession, asyncHandler(async (req, res) => {
  // ConfigurationManager.AppSettings["CompanyDomain"].ToString() (missing key => NullReferenceException, HTTP 500)
  const resellerDomain = appStrict('CompanyDomain');
  ps.sessionRemove(req, 'Plid');
  ps.sessionSet(req, 'Cart', null);
  ps.sessionSet(req, 'Afterlogout', resellerDomain);
  ps.sessionRemove(req, 'DID');
  return res.json({ redirect: resellerDomain });
}));

module.exports = router;
