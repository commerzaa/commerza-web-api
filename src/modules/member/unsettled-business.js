'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/UnsettledBusiness.cs (UnsettledBusinessController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const DB = 'affiliate';

const UNSETTLED_PROPS = ['RIGHTINSERTEDDATE', 'RIGHTPACKAGE_AMT', 'RIGHTPACKAGE_SALESVOLUME', 'LEFTINSERTEDDATE', 'LEFTPACKAGE_AMT', 'LEFTPACKAGE_SALESVOLUME'];

// auth
// route-config: "referral/_slash_Yi9xQd6wNdqNn9CHsMXiqhKxdm_plus_YzgY" -> UnsettledBusiness/Index
router.all(['/member/UnsettledBusiness/Index{/:id}', '/member/referral/_slash_Yi9xQd6wNdqNn9CHsMXiqhKxdm_plus_YzgY'], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await db.queryOne(DB, 'select loginid from member_master where regno = @plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  // PORT-NOTE: @TATALLEFTVALUE/@TATALRIGHTVALUE are OUT params of the proc but the legacy call only supplied @LOGINID.
  const rows = await db.proc(DB, 'unsettled_business', { loginid });
  res.json({ view: '~/Views/CustomerPanel/UnsettledBusiness/Index.cshtml', Model: mapRows(rows, UNSETTLED_PROPS) });
}));

module.exports = router;
