'use strict';
/**
 * Port of Member/Common/Controllers/disclaimer.cs (disclaimerController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: Disclaimer -> disclaimer
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const C = 'disclaimer';

const P_ABOUT = ['cmsid', 'Value', 'Type', 'Active'];

// ---- Index ------------------------------------------------------------------------------------------------------
// public
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/disclaimer'], asyncHandler(async (req, res) => {
  // PORT-NOTE: @strResult OUT is a column of the result rows and is ignored (as in legacy)
  const rows = await proc(DB, 'usp_insertupdatecms', { name: '', email: '', mobile: '', address: '', value: '', type: 'disclaimer', mode: 0 });
  res.json({ Model: mapRows(rows, P_ABOUT) });
}));

module.exports = router;
