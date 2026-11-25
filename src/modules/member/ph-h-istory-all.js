'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/PH_HIstory_AllController.cs (PH_HIstory_AllController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const DB = 'affiliate';

const GIVE_HELP_PROPS = ['GiveID', 'InvestID', 'Kid', 'Regno', 'Help_Date', 'Help_Amount', 'Trans_Amount', 'Remain_Amount', 'Status', 'Confirm_Amount', 'Confirm_Date', 'HelpNo', 'Remark'];

// auth (legacy read Session["Plid"] without a null check)
// route-config: "referral/Wi3n3r0P5aUrCPvp3Z0ohPgfdgfHABC==" -> PH_HIstory_All/Index
router.all(['/member/PH_HIstory_All/Index{/:id}', '/member/referral/Wi3n3r0P5aUrCPvp3Z0ohPgfdgfHABC=='], auth, asyncHandler(async (req, res) => {
  const regno = Number(req.user.plid);
  const rows = await db.proc(DB, 'details_give_help', { regno });
  res.json({ view: '~/Views/CustomerPanel/PH_HIstory_All/Index.cshtml', Model: mapRows(rows, GIVE_HELP_PROPS) });
}));

module.exports = router;
