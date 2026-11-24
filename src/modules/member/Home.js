'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Home.cs (HomeController) - 1 action: Index */
const express = require('express');
const { queryOne } = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Home';

// route-config: referral/Home
// public (legacy session was only used to decide the redirect target)
// PORT-NOTE: Redirect(url) / Response.Redirect("/login") => res.json({ redirect }). In C# `Redirect("")`/`Redirect(null)` throws ArgumentException,
// which the catch turns into Response.Redirect("/login"); reproduced by returning redirect '/login' when url is empty.
router.all([`${P}/Index{/:id}`, '/member/referral/Home'], optionalAuth, asyncHandler(async (req, res) => {
  let url = '';
  try {
    if (req.user && req.user.plid != null) {
      const r = await queryOne(DB, 'select software_url from tbl_companymaster where comid = 1 limit 1');
      url = r ? r.software_url : null;
      if (url === null || url === undefined || url === '') throw new Error('Value cannot be null or empty.');
      return res.json({ redirect: url });
    }
    throw new Error('Value cannot be null or empty.');
  } catch (ex) {
    return res.json({ redirect: '/login' });
  }
}));

module.exports = router;
