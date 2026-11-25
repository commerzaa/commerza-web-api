'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Document_Zone.cs (Document_ZoneController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const DB = 'affiliate';
const TrainingTool = ['TLID', 'Type', 'Title', 'Desp', 'VUrl', 'Active', 'Date'];

// route-config: referral/2LnlbAZTWFEncUxhPvG2Cw== -> Document_Zone/Index
// auth
router.all(['/member/Document_Zone/Index{/:id}', '/member/referral/2LnlbAZTWFEncUxhPvG2Cw=='], auth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, 'select * from training_tool order by tlid desc', {});
  res.json(mapRows(rows, TrainingTool));
}));

module.exports = router;
