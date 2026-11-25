'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Payout_Statement.cs (Payout_StatementController) */
const express = require('express');
const { queryOne, procOne } = require('../../db');
const { mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Payout_Statement';
const PROPS = ['RowNumber', 'MPID', 'LoginId', 'FName', 'fath_hus_name', 'Address', 'StateName', 'CityName', 'mobile', 'Regdate', 'panNo',
  'IsPanVerified', 'OLBV', 'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MatchBV', 'PaidBV', 'FlushBV', 'CFLBV', 'CFRBV', 'payfrom', 'payto',
  'BinaryIncome', 'Directincome', 'levelIncome', 'TotalIncome', 'OldIncome', 'PaybleAmount', 'Payid', 'accountHolderName', 'accountNo',
  'bankName', 'IfscCode', 'Tds', 'AdminCharge', 'Repurchase'];

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/Payout-Statement" -> Payout_Statement/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/Payout-Statement'], auth, asyncHandler(async (req, res) => {
  const PAyIDs = parseInt(await UtilityClass.Decryptword(req.p.payid), 10);
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select loginid from member_master where regno = @plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  const _statement = mapRow(await procOne(DB, 'usp_getpayoutstatementonpayid', { loginid, payid: PAyIDs }), PROPS);
  if (_statement == null) return res.json({ redirect: 'Earnings/Index' });
  res.json({ Model: _statement });
}));

module.exports = router;
