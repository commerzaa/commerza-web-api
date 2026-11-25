'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\MyPackages.cs (MyPackagesController) */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/member/MyPackages';

// public (no session check in legacy; view only, no server-side data)
router.all([`${P}/Index{/:id}`, P], asyncHandler(async (req, res) => {
  res.json({});
}));

module.exports = router;
