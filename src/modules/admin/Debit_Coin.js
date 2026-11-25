'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Debit_Coin.cs (class Debit_CoinController, no namespace => /Debit_Coin/...)
// Database: affiliate (Db_Affiliate). Proc USP_DEBITCOIN; tables member_master, tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { nStr, reqInt, reqDec, outStr } = require('./_shared/batch06_common');
const { validateDebit, gaCheck, memberByUserName, smsAction, emailAction, need, fireSms, fireEmail } = require('./_shared/batch06_debit');

const router = express.Router();
const DB = 'affiliate';
const C = 'Debit_Coin';

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin") => adminAuth)
// route-config: "AdminPanel/Debit-Coin" -> Debit_Coin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Debit-Coin'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Debit_Coin/Index.cshtml' });
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult DebitCoin(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth ([SessionExpireCheck] => adminAuth)
router.all(`/admin/${C}/DebitCoin{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = nStr(req.p.Username);
  const Amount = reqDec(req.p.Amount, 'Amount');
  const Id = reqInt(req.p.Id, 'Id');
  const Remark = nStr(req.p.Remark);
  const GAKEY = nStr(req.p.GAKEY);
  const EmpId = req.user.emp_id;
  let ret = '';
  const v = validateDebit(Username, Amount, Id);
  if (v) return res.json(v);
  const ga = await gaCheck(EmpId, GAKEY);
  if (ga) return res.json(ga);
  const MemberDetails = await memberByUserName(Username);
  // [USP_DEBITCOIN] @USERNAME,@REMARK,@AMOUNT,@RESULT OUT,@ActivityByAdminUserId
  const row = await db.procOne(DB, 'USP_DEBITCOIN', { USERNAME: Username, REMARK: Remark, AMOUNT: Amount, ActivityByAdminUserId: EmpId });
  ret = outStr(row, 'RESULT');
  if (ret === 'SUCCESS') {
    const Frommsg = await smsAction(1049);
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(Username, need(Frommsg).Sms_Content, '', '', 37, Id, 0, '', '', Amount, 0);
    const Debitemailmsg = await emailAction(1045);
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword('', need(Debitemailmsg).Email_Content, need(MemberDetails).Emailid, '', 40, '', '', Id, 0, '', '', 0, Amount, 0);
    fireSms(Frommsg, MemberDetails, Frommessg);
    fireEmail(Debitemailmsg, MemberDetails, DynamicMsgForDebit);
  }
  return res.json(ret);
}));

module.exports = router;
