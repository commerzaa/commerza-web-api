'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\WebsitePopUP.cs (WebsitePopUPController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/WebsitePopUP';
const PROPS = ['name', 'Title', 'Type'];

// public (no session check in legacy; view only)
router.all([`${P}/Index{/:id}`, P, '/member/websitePopUpimage' /* route-config */], asyncHandler(async (req, res) => {
  res.json({});
}));

// public
router.all(`${P}/GetMemberPopupImages{/:id}`, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_memberpopupimage', {});
  res.json(mapRows(rows, PROPS));
}));

module.exports = router;
