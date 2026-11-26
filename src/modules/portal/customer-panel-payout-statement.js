'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\Payout_Statement.cs (class Payout_StatementController => /portal/Payout_Statement/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB, nStr, cvtInt } = require('./_shared/batch-07-common');

const router = express.Router();
const C = '/portal/Payout_Statement';

/** class payoutstatemnt */
const PAYOUTSTATEMNT = ['RowNumber', 'MPID', 'LoginId', 'FName', 'fath_hus_name', 'Address', 'StateName', 'CityName', 'mobile', 'Regdate', 'panNo',
  'IsPanVerified', 'OLBV', 'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MatchBV', 'PaidBV', 'FlushBV', 'CFLBV', 'CFRBV', 'payfrom', 'payto', 'BinaryIncome',
  'Directincome', 'levelIncome', 'TotalIncome', 'OldIncome', 'PaybleAmount', 'Payid', 'accountHolderName', 'accountNo', 'bankName', 'IfscCode', 'Tds',
  'AdminCharge', 'Repurchase'];

// ---------------------------------------------------------------- Index(string payid)
// auth (Session["plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/Payout-Statement" -> Payout_Statement/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/Payout-Statement'], ps.customerAuth, asyncHandler(async (req, res) => {
  const payid = nStr(req.p.payid);
  const PAyIDs = cvtInt(UtilityClass.Decryptword(payid));
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await db.queryOne(DB, 'select loginid from member_master where plid = @plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  const rows = await db.proc(DB, 'usp_getpayoutstatementonpayid', { LoginId: loginid, payid: PAyIDs });
  const _statement = rows && rows[0] ? mapRow(rows[0], PAYOUTSTATEMNT) : null;
  if (_statement === null) return res.json({ redirect: 'Earnings/Index' });
  return res.json({ view: '~/Views/CustomerPanel/Payout_Reports/PayoutStatment.cshtml', Model: _statement });
}));

module.exports = router;
