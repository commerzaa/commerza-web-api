'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\AdAccount.cs (AdAccountController) - 1 action: Index */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/member/AdAccount';

// auth (Session["Plid"] == null => RedirectToAction("Index","Home")); the action only returns a view without data
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json({});
}));

module.exports = router;
