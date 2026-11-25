'use strict';
// Ported from Member\Controllers\AboutUsController.cs (about_usController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const DB = 'affiliate';
const PROPS = ['cmsid', 'Value', 'Type', 'Active'];

// route-config: about-us/{action} (default action Index)
// public
router.all(['/member/about_us/Index{/:id}', '/member/about-us', '/member/about-us/Index'], asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_insertupdatecms', { Name: '', Email: '', mobile: '', address: '', value: '', type: 'aboutus', mode: 0 });
  res.json({ Model: mapRows(rows, PROPS) });
}));

module.exports = router;
