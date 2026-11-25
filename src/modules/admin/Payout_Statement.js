'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Payout_Statement.cs (class Payout_StatementController => /admin/Payout_Statement/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { nStr, cvtInt } = require('./_shared/batch11_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Payout_Statement';

/** class payoutstatemnt1 (this file) */
const STATEMENT_PROPS = ['RowNumber', 'MPID', 'LoginId', 'FName', 'fath_hus_name', 'Address', 'StateName', 'CityName', 'mobile', 'Regdate', 'panNo',
  'IsPanVerified', 'OLBV', 'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MatchBV', 'PaidBV', 'FlushBV', 'CFLBV', 'CFRBV', 'payfrom', 'payto',
  'BinaryIncome', 'Directincome', 'levelIncome', 'TotalIncome', 'OldIncome', 'PaybleAmount', 'Payid', 'accountHolderName', 'accountNo',
  'bankName', 'IfscCode', 'Tds', 'AdminCharge', 'Repurchase'];

// ---------------------------------------------------------------- ActionResult Index(string payid, string logind)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","Home"))
// route-config: "AdminPanel/Payout-Statement" -> Payout_Statement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Payout-Statement'], adminAuth, asyncHandler(async (req, res) => {
  // Request.UrlReferrer == null
  if (!req.get('Referer')) return res.json({ redirect: '/Payout_Reports/Index' });
  // Convert.ToInt32(UtilityClass.Decryptword(x)): Decryptword("") / failure => "" => FormatException (500), like legacy
  const PAyIDs = cvtInt(await UtilityClass.Decryptword(nStr(req.p.payid)));
  const LoginIDs = cvtInt(await UtilityClass.Decryptword(nStr(req.p.logind)));
  const rows = await db.proc(DB, 'usp_getPayoutStatementOnPayid', { LoginId: LoginIDs, payid: PAyIDs });
  const _statement = rows && rows[0] ? mapRows([rows[0]], STATEMENT_PROPS)[0] : null;
  if (_statement === null) return res.json({ redirect: '/Payout_Reports/Index' });
  return res.json({ view: '~/Views/AdminPanel/Payout_Statement/Index.cshtml', Model: _statement });
}));

module.exports = router;
