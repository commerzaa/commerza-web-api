'use strict';
// Port of Member\Common\Controllers\CustomerPanel\CustomizeUrl.cs (CustomizeUrlController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

// auth (the view has no server-side data)
router.all('/member/CustomizeUrl/Index{/:id}', auth, asyncHandler(async (req, res) => {
  res.json({});
}));

module.exports = router;
