'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Commission_Fund_TransferController.cs
// (class Commission_Fund_TransferController => /Commission_Fund_Transfer/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Commission_Fund_Transfer';

/** new Thread(...).Start() => fire-and-forget */
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[admin/Commission_Fund_Transfer] background send failed:', e.message)); };

// ---------------------------------------------------------------- [SessionExpireCheck] Index()
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Commission-Fund-Transfer" -> Commission_Fund_Transfer/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Commission-Fund-Transfer'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Commission_Fund_Transfer/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult CreditCommission(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth (reads Session["Admin_User"] before the null check)
router.all(`/admin/${C}/CreditCommission{/:id}`, adminAuth, asyncHandler(async (req, res) => {
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
  // Db._Member_Master.Where(a => a.userName == Username).FirstOrDefault()
  const MemberDetails = await db.queryOne(DB, 'select username, emailid, mobile from member_master where username = @u limit 1', { u: Username });
  const out = await db.proc(DB, 'USP_COMISSION_FUND_TRANSFER', {
    USERNAME: Username, REMARK: Remark, AMOUNT: Amount, EID: Number(Employeeid),
  });
  ret = B.str(B.outVal(out, 'RESULT'));
  if (ret === 'SUCCESS') {
    const Frommsg = await db.queryOne(DB, 'select sms_content, smscategory, sms_send_status from tbl_smsaction where id = 1051 limit 1', {});
    if (!Frommsg) throw B.NRE();
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(Username, Frommsg.sms_content, '', '', 38, Id, 0, '', '', 0, Amount);
    const Creditemailmsg = await db.queryOne(DB, 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 1047 limit 1', {});
    if (!Creditemailmsg || !MemberDetails) throw B.NRE();
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword('', Creditemailmsg.email_content, MemberDetails.emailid, '', 41, '', '', Id, 0, '', '', 0, 0, Amount);
    if (Frommsg.smscategory === 'Transfer') {
      if (Number(Frommsg.sms_send_status) === 1) {
        fire(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1'));
      }
    }
    if (Number(Creditemailmsg.email_send_status) === 1) {
      const fileUploader = null;
      // MemberDetails.Emailid.ToLower() ran inside the thread in legacy (a null e-mail crashed only that thread)
      fire(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', MemberDetails.emailid.toLowerCase(), Creditemailmsg.email_subject, DynamicMsgForDebit, fileUploader));
    }
  }
  return res.json(ret);
}));

module.exports = router;
