'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/APIIntegration.cs (APIIntegrationController, 1 action: Index)
 * Prefix: /member
 * The legacy action only checks the session and returns the (model-less) view. (No friendly URL in RouteConfig.cs.)
 */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'APIIntegration';

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`], auth, asyncHandler(async (req, res) => {
  res.json({});
}));

module.exports = router;
