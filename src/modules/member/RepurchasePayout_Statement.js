'use strict';
// Ported from Member\Controllers\CustomerPanel\RepurchasePayout_Statement.cs (1 action) - database: affiliate
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const nz = (v) => (v === undefined || v === null ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}

// auth
// route-config: referral/RepurchasePayout-Statement -> Index
router.all(['/member/RepurchasePayout_Statement/Index{/:id}', '/member/referral/RepurchasePayout-Statement'], auth, asyncHandler(async (req, res) => {
  const PAyIDs = parseInt(await UtilityClass.Decryptword(nz(req.p.payid)), 10);
  if (Number.isNaN(PAyIDs)) throw new Error('Input string was not in a correct format.');
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await db.queryOne(DB, 'select loginid from member_master where regno=@plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  const r = await db.procOne(DB, 'usp_getRepurchasePayoutStatementOnPayid', { LoginId: loginid, Payid: PAyIDs });
  if (r == null) return res.json({ redirect: 'Earnings/Index' });
  const Model = mapRows([r], ['RowNumber', 'MPID', 'LoginId', 'FName', 'fath_hus_name', 'Address', 'StateName', 'CityName', 'mobile', 'Regdate', 'panNo',
    'IsPanVerified', 'OLBV', 'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MatchBV', 'PaidBV', 'FlushBV', 'CFLBV', 'CFRBV', 'payfrom', 'payto', 'BinaryIncome',
    'Directincome', 'levelIncome', 'TotalIncome', 'OldIncome', 'PaybleAmount', 'Payid', 'accountHolderName', 'accountNo', 'bankName', 'IfscCode', 'Tds',
    'AdminCharge', 'Repurchase'])[0];
  return res.json({ Model });
}));

module.exports = router;
