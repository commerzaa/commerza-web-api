'use strict';
/** Ported from Member\Common\Controllers\Privacy_Policy.cs (Privacy_PolicyController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Privacy_Policy';
const PROPS = ['cmsid', 'Value', 'Type', 'Active'];

// public (no session check in legacy)
// route-config: url "Privacy-Policy" -> Privacy_Policy/Index
router.all([`${P}/Index{/:id}`, P, '/member/Privacy-Policy'], asyncHandler(async (req, res) => {
  // @strResult is an OUTPUT parameter in the legacy call (not sent; its value was never used)
  const rows = await proc(DB, 'usp_insertupdatecms', {
    name: '', email: '', mobile: '', address: '', value: '', type: 'privacypolicy', mode: 0,
  });
  res.json({ Model: mapRows(rows, PROPS) });
}));

module.exports = router;
