'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\RepurchaseMember_History.cs
// (class RepurchaseMember_HistoryController => /admin/RepurchaseMember_History/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nstr, view, mapRow, toInt32 } = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'RepurchaseMember_History';

/** class RepurchaseMemberPayout */
const REPURCHASE_MEMBER_PAYOUT_PROPS = ['RowNumber', 'MPID', 'LoginId', 'FName', 'fath_hus_name', 'Address', 'StateName', 'CityName', 'mobile',
  'Regdate', 'panNo', 'IsPanVerified', 'OLBV', 'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MatchBV', 'PaidBV', 'FlushBV', 'CFLBV', 'CFRBV',
  'payfrom', 'payto', 'BinaryIncome', 'Directincome', 'levelIncome', 'TotalIncome', 'OldIncome', 'PaybleAmount', 'Payid',
  'accountHolderName', 'accountNo', 'bankName', 'IfscCode', 'Tds', 'AdminCharge', 'Repurchase'];

// ---------------------------------------------------------------- Index(string payid, string logind)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","Home"))
// route-config: "AdminPanel/RepurchaseMember-History" -> RepurchaseMember_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/RepurchaseMember-History'], adminAuth, asyncHandler(async (req, res) => {
  const payid = nstr(req.p.payid);
  const logind = nstr(req.p.logind);
  // Request.UrlReferrer == null => RedirectToAction("Index", "Payout_Reports")
  if (!req.get('Referer')) return res.json({ redirect: '/Payout_Reports/Index' });
  // Convert.ToInt32(UtilityClass.Decryptword(x)) (no try/catch: FormatException => 500)
  const PAyIDs = toInt32(await UtilityClass.Decryptword(payid));
  const LoginIDs = toInt32(await UtilityClass.Decryptword(logind));
  const rows = await db.proc(DB, 'usp_getRepurchasePayoutStatementOnPayid', { LoginId: LoginIDs, payid: PAyIDs });
  const _statement = rows.length ? mapRow(rows[0], REPURCHASE_MEMBER_PAYOUT_PROPS) : null;
  if (_statement === null) return res.json({ redirect: '/Payout_Reports/Index' });
  return view(res, '~/Views/AdminPanel/RepurchaseMember_History/Index.cshtml', _statement, {});
}));

module.exports = router;
