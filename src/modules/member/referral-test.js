'use strict';
/** Port of Member/Controllers/CustomerPanel/ReferralTest.cs (ReferralTestController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['TITLE', 'DESCRIPTION', 'URL'];

// route-config: referral/J_plus_4FvJpj3jcsy5RKDx_plus_fgCoQjC9PPPPOkqinNhZhGZ0LWE -> Index
// auth
router.all(['/member/ReferralTest/Index{/:id}', '/member/referral/J_plus_4FvJpj3jcsy5RKDx_plus_fgCoQjC9PPPPOkqinNhZhGZ0LWE'], auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, "SELECT COALESCE(title,'') AS TITLE,COALESCE(description,'') AS DESCRIPTION,COALESCE(url,'') AS URL FROM tbl_referraltext WHERE active=1");
  res.json({ view: '~/Views/CustomerPanel/ReferralTest/Index.cshtml', Model: mapRows(rows, PROPS) });
}));

module.exports = router;
