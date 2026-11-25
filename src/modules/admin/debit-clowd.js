'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Debit_Clowd.cs (class Debit_ClowdController, no namespace => /Debit_Clowd/...)
// Database: affiliate (Db_Affiliate). Proc USP_DEBITSHOPPING; tables member_master, tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { nStr, reqInt, reqDec, outStr } = require('./_shared/batch06-common');
const { validateDebit, gaCheck, memberByUserName, smsAction, emailAction, need, fireSms, fireEmail } = require('./_shared/batch06-debit');

const router = express.Router();
const DB = 'affiliate';
const C = 'Debit_Clowd';

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index()
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Debit-Shopping-Wallet" -> Debit_Clowd/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Debit-Shopping-Wallet'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Debit_Clowd/Index.cshtml' });
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult DebitClowd(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth ([SessionExpireCheck] => adminAuth; the inner Session null check / Response.Redirect("/") is covered by it)
router.all(`/admin/${C}/DebitClowd{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = nStr(req.p.Username);
  const Amount = reqDec(req.p.Amount, 'Amount');
  const Id = reqInt(req.p.Id, 'Id');
  const Remark = nStr(req.p.Remark);
  const GAKEY = nStr(req.p.GAKEY);
  const EmpId = req.user.emp_id;
  const Employeeid = EmpId;
  let ret = '';
  const v = validateDebit(Username, Amount, Id);
  if (v) return res.json(v);
  const ga = await gaCheck(EmpId, GAKEY);
  if (ga) return res.json(ga);
  // [USP_DEBITSHOPPING] @USERNAME,@REMARK,@AMOUNT,@RESULT OUT,@EID
  const row = await db.procOne(DB, 'USP_DEBITSHOPPING', { USERNAME: Username, REMARK: Remark, AMOUNT: Amount, EID: Employeeid });
  ret = outStr(row, 'RESULT');
  if (ret === 'SUCCESS') {
    const MemberDetails = await memberByUserName(Username);
    const Frommsg = await smsAction(1066);
    const emailmsg = await emailAction(1060);
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(need(MemberDetails).userName, need(Frommsg).Sms_Content, '', '', 54, Id, 0, '', '', Amount, 0);
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', need(emailmsg).Email_Content, MemberDetails.Emailid, '', 56, '', '', Id, 0, '', '', 0, Amount, 0);
    fireSms(Frommsg, MemberDetails, Frommessg);
    fireEmail(emailmsg, MemberDetails, DynamicMsgForCredit);
  }
  return res.json(ret);
}));

module.exports = router;
