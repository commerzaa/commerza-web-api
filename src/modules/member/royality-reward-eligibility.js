'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/RoyalityRewardEligibility.cs (RoyalityRewardEligibilityController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: RoyalityRewardEligibility -> referral/aaM_slash_aJlpbxjae0NREHhigGM3dt4ZLDzuB7W_plus_Ly2zE7I= (id optional)
 */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const C = 'RoyalityRewardEligibility';

const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, n) => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
const P_ROYALITY = ['RowNumber', 'Level', 'TotalDownlineActiveMember', 'RequiredDownlineActiveMember', 'EligibilityStatus', 'TotalBusiness', 'QualifyDate', 'RoyalityDescription'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/aaM_slash_aJlpbxjae0NREHhigGM3dt4ZLDzuB7W_plus_Ly2zE7I={/:id}'], auth, asyncHandler(async (req, res) => {
  let page = optInt(req.p.page);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
  if (row) loginid = row.username;
  void loginid;
  // PORT-NOTE: @TOTALCOUNTRECORD OUT is the "totalcountrecord" column of the first result row (0 when empty)
  const raw = await proc(DB, 'usp_royalitystatusreport', { startrowindex: page, maxrows: MaxRows, plid: Plid, mode: 1, username: '' });
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(raw, 'totalcountrecord');
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  res.json({ Model: mapRows(raw, P_ROYALITY), ViewBag });
}));

module.exports = router;
