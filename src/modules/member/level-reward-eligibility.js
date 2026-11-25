'use strict';
// Port of Member\Common\Controllers\CustomerPanel\LevelRewardEligibility.cs (Common.Controllers.CustomerPanel.LevelRewardEligibilityController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const LevelRewardEligibility = ['RowNumber', 'TOTALCOUNTMEMBER', 'LEFTCOUNTMEMBER', 'RIGHTCOUNTMEMBER', 'ELIGIBILITY', 'REWARD', 'FROMDATE', 'TODATE', 'TOTALDIRECTMEMBER'];

// route-config: referral/aaM_slash_aJlpbxjae0NREHhigGM3dt4ZLDzuB7W_plus_Ly2zE7ILRE= -> LevelRewardEligibility/Index
// auth
router.all(['/member/LevelRewardEligibility/Index{/:id}', '/member/referral/aaM_slash_aJlpbxjae0NREHhigGM3dt4ZLDzuB7W_plus_Ly2zE7ILRE='], auth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize();
  const page = req.p.page === undefined || req.p.page === '' ? 1 : parseInt(req.p.page, 10);
  const Plid = Number(req.user.plid);
  await db.queryOne(DB, 'select username from member_master where regno=@plid limit 1', { plid: Plid }); // loginid (unused in legacy)
  const rows = await db.proc(DB, 'usp_rewardelegibility_royalityreport', { regno: Plid, startrowindex: page, maxrows: MaxRows });
  const ObjRoyalityRewardEligibility = mapRows(rows, LevelRewardEligibility);
  const tc = outv(rows, 'totalcount');
  if (tc === null) throw new TypeError('Object reference not set to an instance of an object.');
  const TotalRecord = parseInt(String(tc), 10);
  res.json({
    Model: ObjRoyalityRewardEligibility, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
  });
}));

module.exports = router;
