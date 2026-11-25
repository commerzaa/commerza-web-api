'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/PurchaseCoinForHoldNew.cs (PurchaseCoinForHoldNewController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/tFmPloq9iOQwsR1hKDtbKLBlzPSCUPW0URetX0B0NTU=  (PurchaseCoinForHoldNew / Index)
// auth ([SessionExpireCheck] + Session["Plid"] check)
router.all(['/member/PurchaseCoinForHoldNew/Index{/:id}', '/member/referral/tFmPloq9iOQwsR1hKDtbKLBlzPSCUPW0URetX0B0NTU='], auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT coalesce(MIN(MINHOLDCOIN),0) as MINHOLDCOIN, coalesce(MAX(MAXHOLDCOIN),0) as MAXHOLDCOIN FROM TBL_COINHOLDSLABSETTINGS');
  const hold = mapRows(rows, ['MINHOLDCOIN', 'MAXHOLDCOIN']);
  return res.json({ view: '~/Views/CustomerPanel/PurchaseCoinForHoldNew/Index.cshtml', Model: hold });
}));

module.exports = router;
