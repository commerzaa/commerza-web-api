'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Debit_Commission.cs (class Debit_CommissionController, no namespace => /Debit_Commission/...)
// Database: affiliate (Db_Affiliate). Proc USP_DEBITCOMMITION; tables member_master, tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { nStr, reqInt, reqDec, outStr } = require('./_shared/batch06_common');
const { validateDebit, gaCheck, memberByUserName, smsAction, emailAction, need, fireSms, fireEmail } = require('./_shared/batch06_debit');

const router = express.Router();
const DB = 'affiliate';
const C = 'Debit_Commission';

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index()
// auth ([SessionExpireCheck] => adminAuth)
// PORT-NOTE: RouteConfig also maps "AdminPanel/Debit-Commission" -> Debit_Commission/Index, but an EARLIER route with the same url
// targets DebitIncomeWallet/Index (first match wins in MVC), so that friendly URL is registered in DebitIncomeWallet.js only.
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Debit_Commission/Index.cshtml' });
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult DebitCommission(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth ([SessionExpireCheck] => adminAuth)
router.all(`/admin/${C}/DebitCommission{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = nStr(req.p.Username);
  const Amount = reqDec(req.p.Amount, 'Amount');
  const Id = reqInt(req.p.Id, 'Id');
  const Remark = nStr(req.p.Remark);
  const GAKEY = nStr(req.p.GAKEY);
  const EmpId = req.user.emp_id;
  const Employeeid = req.user.emp_id; // Employee_Master EM = (Employee_Master)Session["Admin_User"]; int Employeeid = EM.Emp_ID;
  let ret = '';
  const v = validateDebit(Username, Amount, Id);
  if (v) return res.json(v);
  const ga = await gaCheck(EmpId, GAKEY);
  if (ga) return res.json(ga);
  const MemberDetails = await memberByUserName(Username);
  // [USP_DEBITCOMMITION] @USERNAME,@REMARK,@AMOUNT,@RESULT OUT,@EID
  const row = await db.procOne(DB, 'USP_DEBITCOMMITION', { USERNAME: Username, REMARK: Remark, AMOUNT: Amount, EID: Number(Employeeid) });
  ret = outStr(row, 'RESULT');
  if (ret === 'SUCCESS') {
    const Frommsg = await smsAction(1052);
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(Username, need(Frommsg).Sms_Content, '', '', 39, Id, 0, '', '', Amount, 0);
    const Debitmailmsg = await emailAction(1048);
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword('', need(Debitmailmsg).Email_Content, need(MemberDetails).Emailid, '', 42, '', '', Id, 0, '', '', 0, Amount, 0);
    fireSms(Frommsg, MemberDetails, Frommessg);
    fireEmail(Debitmailmsg, MemberDetails, DynamicMsgForDebit);
  }
  return res.json(ret);
}));

module.exports = router;
