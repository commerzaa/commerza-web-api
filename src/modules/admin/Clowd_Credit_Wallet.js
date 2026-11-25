'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Clowd_Credit_Wallet.cs (class Clowd_Credit_WalletController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Clowd_Credit_Wallet';

/** new Thread(...).Start() => fire-and-forget */
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[admin/Clowd_Credit_Wallet] background send failed:', e.message)); };

// ---------------------------------------------------------------- [SessionExpireCheck] Index()
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Credit-Shopping-Wallet" -> Clowd_Credit_Wallet/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Credit-Shopping-Wallet'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Clowd_Credit_Wallet/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult CreditShoping(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth (reads Session["Admin_User"] before the null check => NullReference without a session)
router.all(`/admin/${C}/CreditShoping{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = B.sp(req, 'Username');
  const Amount = B.reqNum(req, 'Amount', 'System.Decimal');
  const Id = B.reqNum(req, 'Id', 'System.Int64');
  const Remark = B.sp(req, 'Remark');
  const GAKEY = B.sp(req, 'GAKEY');
  const Employeeid = req.user.emp_id;
  const EmpId = req.user.emp_id;
  let ret = '';
  let IsGoogleAuthenticated = '';
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  if (Amount <= 0) return res.json('Error^Amount should be a non negative number.');
  if (Id <= 0) return res.json('Error^Some error occured.Try typing username again.');
  // Authencation for google starts here
  const gaObj = await new Admin_Security_Key().Get_Security_Key(EmpId);
  if (gaObj !== null && gaObj !== undefined) {
    IsGoogleAuthenticated = '1';
    if (GAKEY === '') return res.json('Error^Enter your GA Key.');
  } else {
    IsGoogleAuthenticated = '0';
  }
  if (IsGoogleAuthenticated !== '0') {
    let objs = new Admin_Security_Key();
    objs = await objs.Get_Security_Key(EmpId);
    if (objs !== null && objs !== undefined) {
      const ValidRandomNo = await objs.Get_GA_Key(EmpId);
      if (!(await objs.Check_GaKeyForEnableTime(EmpId, ValidRandomNo, GAKEY))) {
        // PORT-NOTE: legacy only rejected when GAKEY != "" (a null GAKEY passes) - kept.
        if (GAKEY !== '') return res.json('Error^Invalid GA Key. Please enter a valid GA Key.');
      }
    }
  }
  const out = await db.proc(DB, 'USP_CLOWD_FUND_TRANSFER', {
    USERNAME: Username, REMARK: Remark, AMOUNT: Amount, EID: Number(Employeeid),
  });
  ret = B.str(B.outVal(out, 'RESULT'));
  if (ret === 'SUCCESS') {
    // Db._Member_Master.Where(a => a.userName == Username).FirstOrDefault()
    const MemberDetails = await db.queryOne(DB, 'select username, emailid, mobile from member_master where username = @u limit 1', { u: Username });
    const Frommsg = await db.queryOne(DB, 'select sms_content, smscategory, sms_send_status from tbl_smsaction where id = 1065 limit 1', {});
    const emailmsg = await db.queryOne(DB, 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 1059 limit 1', {});
    if (!MemberDetails || !Frommsg || !emailmsg) throw B.NRE();
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Frommsg.sms_content, '', '', 53, Id, 0, '', '', 0, Amount);
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', emailmsg.email_content, MemberDetails.emailid, '', 55, '', '', Id, 0, '', '', 0, 0, Amount);
    if (Frommsg.smscategory === 'Transfer') {
      if (Number(Frommsg.sms_send_status) === 1) {
        fire(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1'));
      }
    }
    if (Number(emailmsg.email_send_status) === 1) {
      const fileUploader = null;
      // MemberDetails.Emailid.ToLower() ran inside the thread in legacy (a null e-mail crashed only that thread)
      fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', MemberDetails.emailid.toLowerCase(), emailmsg.email_subject, DynamicMsgForCredit, fileUploader));
    }
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (member wallet lookup; legacy had no session check)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let getval = 'Invalid';
  try {
    const sqlquery = `select mm.regno, coalesce(mm.fname, '') || ' ' || coalesce(mm.mname, '') || ' ' || coalesce(mm.lname, '') as mmbername, mm.emailid,
      coalesce(mp.availablecommissionwallet, 0) as availablecommissionwallet, coalesce(availablecoinwallet, 0) as availablecoinwallet,
      coalesce(totalavailableshoppingpoints, 0) as available_fund
      from member_master mm inner join member_performance mp on mp.regno = mm.regno where mm.username = @u`;
    const dr = await db.queryOne(DB, sqlquery, { u: B.str(B.sp(req, 'memberid')) });
    if (dr) {
      getval = `${B.str(dr.regno)}^${B.str(dr.mmbername)}^${B.str(dr.emailid)}^${B.str(dr.availablecommissionwallet)}^${B.str(dr.availablecoinwallet)}^${B.str(dr.available_fund)}`;
    } else {
      getval = 'Invalid';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
  }
  return res.json(getval);
}));

module.exports = router;
