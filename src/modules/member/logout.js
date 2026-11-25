'use strict';
/** Ported from Member\Common\Controllers\Logout.cs (LogoutController) */
const express = require('express');
const sessionStore = require('../../utils/sessionStore');
const optionalAuthMw = require('../../middleware/auth').optionalAuth;
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/member/Logout';

// route-config: Logout
// public (legacy action had no session check; the client drops the JWT)
router.all([`${P}/Index{/:id}`, '/member/Logout'], optionalAuthMw, asyncHandler(async (req, res) => {
  // Session.Abandon()/Clear()/FormsAuthentication.SignOut(): server-side data of this user is cleared
  if (req.user) {
    for (const k of ['SessionOTP', 'FavoriteURL', 'packname', 'Amount', 'COUNTRYNAME', 'STATENAME', 'CITYNAME', 'Latitude', 'longitude', 'TempData_ParentID', 'TempData_side']) sessionStore.set(req, k, null);
  }
  res.set('Cache-Control', 'no-cache, no-store');
  res.json({ status: 'true', redirect: 'Home/Index' });
}));

// public (void action; body is entirely commented out in legacy)
router.all(`${P}/BrowserClose{/:id}`, (req, res) => {
  res.end();
});

module.exports = router;
