'use strict';
// Ported from Member/Controllers/Mission.cs  (DB: affiliate - Member DataBaseContext = Db_Affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
const About_us_details = ['cmsid', 'Value', 'Type', 'Active'];

// public (legacy had no session check). route-config: url "Mission" -> Mission/Index
router.all(['/member/Mission/Index{/:id}', '/member/Mission'], asyncHandler(async (req, res) => {
  // PORT-NOTE: @strResult OUT is not read by the legacy code; it is not passed to the PostgreSQL function.
  const rows = await proc(DB, 'usp_insertupdatecms', {
    name: '', email: '', mobile: '', address: '', value: '', type: 'mission', mode: 0,
  });
  res.json({ View: '~/Views/Mission/Index.cshtml', Model: mapRows(rows, About_us_details) });
}));

module.exports = router;
