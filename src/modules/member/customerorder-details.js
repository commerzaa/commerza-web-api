'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Customerorder_details.cs (Customerorder_detailsController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRow } = require('../../utils/shape');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const errorInsert = async (e, procName, req) => {
  try { await new DataUtility().ErrorInsert(0, e && e.message, procName, 0, req.path); } catch (_) { /* ignore */ }
};
const MemberProfile = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'Password', 'ImageName', 'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender', 'HighestQualification', 'CID', 'SID', 'CTID', 'Atc_WalletAddress', 'CityName', 'MarriageAnniversary', 'SponserName', 'ACTIVE', 'PINCODE', 'NOMINEEMNAME', 'NOMINEEMREL', 'NOMINEEDOB', 'NOMINEECONTACT', 'FACEBOOKLINK', 'maritalstatus', 'Address', 'SponsorUsername', 'Town_post', 'Qualification', 'occupation'];

// route-config: referral/G3pAMJ553_slash_EVT87l9cm75NKIzwORDERcm75NKIzwKMUX4Q -> Customerorder_details/Index
// auth
router.all(['/member/Customerorder_details/Index{/:id}', '/member/referral/G3pAMJ553_slash_EVT87l9cm75NKIzwORDERcm75NKIzwKMUX4Q'], auth, asyncHandler(async (req, res) => {
  const row = await db.procOne(DB, 'usp_getcontactdetails', { plid: Number(req.user.plid) });
  const out = {};
  if (row !== null) out.memdetails = mapRow(row, MemberProfile);
  res.json(out);
}));

// auth
router.all('/member/Customerorder_details/Insertorderdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ReturnOutput = 'success';
  let OrderId = '';
  const RegNo = parseInt(req.user.plid, 10);
  try {
    const CUSTOMERNAME = p.CUSTOMERNAME;
    const MOBILE = p.MOBILE;
    const EMAILID = p.EMAILID;
    const loginid = String(req.user.loginid); // Convert.ToString(Login.LoginID) - unused
    void loginid;
    const rows = await db.proc(DB, 'cartshopping', {
      regno: RegNo, address: p.ADDRESS, country: p.COUNTRY, state: p.STATES, city: p.CITYS, pincode: p.PINCODE,
      mobile: MOBILE, emailid: EMAILID, username: CUSTOMERNAME, paymode: parseInt(p.PaymentMode, 10),
    });
    const so = outv(rows, 'stroutput');
    const oi = outv(rows, 'orderid');
    ReturnOutput = so === null ? '' : String(so);
    OrderId = oi === null ? '' : String(oi);
    if (ReturnOutput === 'SUCCESS') {
      const SMSVerification = await db.queryOne(DB, 'select * from TBL_SMSACTION where id=25 limit 1', {});
      const MobileSMS = SMSVerification.sms_content; // NullReference when missing (legacy)
      void MobileSMS;
      const emailVerificationmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid=21 limit 1', {});
      const DynamicNewOrderMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(CUSTOMERNAME, emailVerificationmsg.email_content, '', OrderId, 12, '');
      if (Number(SMSVerification.sms_send_status) === 1) {
        const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(CUSTOMERNAME, SMSVerification.sms_content, '', OrderId, 13);
        Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(MOBILE, messg, '1')).catch(() => {});
      }
      if (Number(emailVerificationmsg.email_send_status) === 1) {
        const fileUploader = null;
        Promise.resolve().then(() => UtilityClass.SendEmailByApiSetting(CUSTOMERNAME, '', '', '', '', '', String(EMAILID).toLowerCase(), emailVerificationmsg.email_subject, DynamicNewOrderMsg, fileUploader)).catch(() => {});
      }
    }
  } catch (ExpObj) {
    await errorInsert(ExpObj, 'Usp_AllSubscriptionMaster', req);
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  res.json(ReturnOutput);
}));

module.exports = router;
