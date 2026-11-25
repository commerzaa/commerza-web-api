'use strict';
// Ported from Member\Controllers\CustomerPanel\TransferedAtcCoin.cs (TransferedAtcCoinController) - database: affiliate (Db_Affiliate, no queries are made)
const express = require('express');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/TransferedAtcCoin';

// route-config: referral/zxvuLIZWUzv5xuvLubiJfXBpD7As1KqrKGQRSh1HiTRYZ8hdTzxxyA==
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/zxvuLIZWUzv5xuvLubiJfXBpD7As1KqrKGQRSh1HiTRYZ8hdTzxxyA=='], ...guard, asyncHandler(async (req, res) => {
  const qs = req.p.qs;
  if (qs !== undefined && qs !== null) {
    let Id = 0;
    try {
      const d = await UtilityClass.Decryptword(qs);
      if (!/^\s*[+-]?\d+\s*$/.test(String(d))) throw new Error('Input string was not in a correct format.');
      Id = Number(d);
    } catch (e) {
      Id = 0;
    }
    // legacy: Id is not used afterwards (the view is returned either way)
  }
  res.json({});
}));

module.exports = router;
