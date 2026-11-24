'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/All_News_Show.cs (All_News_ShowController, 1 action: Index)
 * Prefix: /member
 * route-config: All News Show -> referral/All-News-Show (id optional)
 * The legacy action only checks the session and returns the (model-less) view.
 */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'All_News_Show';

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/All-News-Show{/:id}'], auth, asyncHandler(async (req, res) => {
  res.json({});
}));

module.exports = router;
