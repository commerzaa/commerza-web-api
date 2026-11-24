'use strict';
/**
 * Port of Member/Common/Controllers/TermsandConditions.cs (TermsandConditionsController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

// About_us_details model properties are not declared in this file (class lives in another C# file); keep columns as returned.
// ---- Index ---------------------------------------------------------------------------------------------
// route-config: TermsandConditions  (TermsandConditions / Index)
// public
router.all(['/member/TermsandConditions/Index{/:id}', '/member/TermsandConditions'], asyncHandler(async (req, res) => {
  // PORT-NOTE: @strResult OUT (varchar 1000) is not used by the C# code; it is returned as a column of the result row by the function.
  const rows = await proc(DB, 'usp_insertupdatecms', {
    name: '', email: '', mobile: '', address: '', value: '', type: 'termsCondition', mode: 0,
  });
  return res.json({ view: '~/Views/TermsandConditions/Index.cshtml', Model: mapRows(rows) });
}));

module.exports = router;
