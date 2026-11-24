'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\BankWithdraw.cs (BankWithdrawController) */
const express = require('express');
const config = require('../../config');
const { query, queryOne, scalar, procOne } = require('../../db');
const { mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/BankWithdraw';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e && e.message)); };
const P_BANK = ['ACID', 'Regno', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ACTIVE', 'DTM_DATE', 'DTM_UPDATE_DATE', 'PancardNo', 'SwiftCode'];
const P_DEDUCT = ['FINALAMOUNT', 'TDS', 'ADMINCH', 'PROCESSINGFEE'];

// route-config: referral/bank-withdrawal
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/bank-withdrawal'], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let regno = 0;
  const Plid = Number(req.user.plid);
  const row = await queryOne(DB, 'select * from member_master where regno = @p limit 1', { p: Plid });
  if (row) {
    regno = row.regno;
    ViewBag.btcaddress = '';
  }
  const BankDetails = mapRow(await queryOne(DB, `SELECT Regno,ACCOUNTHOLDERNAME,ACCOUNTNO,BANKNAME,BRANCHNAME,IFSCCODE
    FROM TBL_MEMBER_KYC_DETAILS Where Regno=@r limit 1`, { r: regno }), P_BANK);
  if (BankDetails) {
    ViewBag.REGNO = BankDetails.Regno;
    ViewBag.accountholdername = BankDetails.ACCOUNTHOLDERNAME;
    ViewBag.ACCOUNTNO = BankDetails.ACCOUNTNO;
    ViewBag.BANKNAME = BankDetails.BANKNAME;
    ViewBag.BRANCHNAME = BankDetails.BRANCHNAME;
    ViewBag.IFSCCODE = BankDetails.IFSCCODE;
    ViewBag.SWIFTCODE = BankDetails.SwiftCode;
  } else {
    ViewBag.REGNO = ''; ViewBag.accountholdername = ''; ViewBag.ACCOUNTNO = ''; ViewBag.BANKNAME = '';
    ViewBag.BRANCHNAME = ''; ViewBag.IFSCCODE = ''; ViewBag.SWIFTCODE = '';
  }
  res.json({ Model: BankDetails, ViewBag });
}));

// auth
router.all(`${P}/GenerateOTPForWithdrawalRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const amount = Number(req.p.amount);
  const withdrawaltype = parseInt(req.p.withdrawaltype, 10);
  const OTP = String(UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);

  const regno = Number(await scalar(DB, 'Select coalesce(REGNO,0) As REGNO From MEMBER_MASTER Where REGNO=@p', { p: req.user.plid })) || 0;
  const perf = async (col) => Number(await scalar(DB, `Select coalesce(${col},0) As v From MEMBER_PERFORMANCE Where RegNo=@r`, { r: regno })) || 0;
  const AvailableCommissionWallet = await perf('AvailableCommissionWallet');
  const AvailableCoinWallet = await perf('AvailableCoinWallet');
  const TotalAvailableShoppingPoints = await perf('TotalAvailableShoppingPoints');
  if (withdrawaltype === 3 && AvailableCommissionWallet < amount) return res.json('error^You have insufficient Balance ! !');
  if (withdrawaltype === 2 && AvailableCoinWallet < amount) return res.json('error^You have insufficient Balance ! !');
  if (withdrawaltype === 5 && TotalAvailableShoppingPoints < amount) return res.json('error^You have insufficient Balance ! !');

  const Active = await scalar(DB, 'Select coalesce(ACTIVE,false) As ACTIVE From Bank_Accounts Where Regno=@r and active=true limit 1', { r: regno });
  if (Active === false || Active === null || Active === undefined || Active === 0) return res.json('error^Please update your bank account !');

  const msg = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 9 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where EID = 9 limit 1');
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const membersmsactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=true AND STATUS=true AND REGNO=@p limit 1', { p: req.user.plid })) || 0;
  const memberemailactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=true AND STATUS=true AND REGNO=@p limit 1', { p: req.user.plid })) || 0;
  const PLDetails = await queryOne(DB, 'select * from member_master where regno = @p limit 1', { p: Plid });
  if (PLDetails) {
    // legacy condition (MOBILE != null || MOBILE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1 && membersmsactive === 1) {
      bg(() => UtilityClass.SendSMSWithAPI(PLDetails.mobile, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      bg(async () => {
        // legacy condition (EMAILID != null || EMAILID != "") is always true
        await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Bank Withdrawal', Emailmsg, null, '', '');
      });
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  res.json(returnmessage);
}));

// auth
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const OTP = String(UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 4 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where EID = 4 limit 1');
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select * from portal_login where plid = @p limit 1', { p: Plid });
  if (PLDetails) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    const membersmsactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=true AND STATUS=true AND REGNO=@p limit 1', { p: req.user.plid })) || 0;
    const memberemailactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=true AND STATUS=true AND REGNO=@p limit 1', { p: req.user.plid })) || 0;
    if (Mobilestatus === 1 && membersmsactive === 1) {
      bg(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      bg(async () => {
        await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Update BTC', Emailmsg, null, '', '');
      });
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  res.json(returnmessage);
}));

// internal (public non-routable-intent helper in legacy; see also the /ProcessPayout route below)
async function ProcessPayout(req, Plid, Wdid) {
  let ret = '';
  let TransactionId = ''; // eslint-disable-line no-unused-vars
  let payresponseMsg = '';
  let paystatus = '';
  const Regno = parseInt(Plid, 10);

  const data = await UtilityClass.WithdrawalByPayunie(Regno);
  const d0 = Array.isArray(data) ? data[0] : data;
  payresponseMsg = d0.status;
  paystatus = d0.statusMessage;

  let ActivityByUserId = ''; let remarks = ''; let Transaction = ''; let paiddate = ''; let Sendby = '';
  let status = 0; let PaidMode = 0;
  const username = await scalar(DB, 'select username from member_master where regno = @r limit 1', { r: Regno });

  // PORT-NOTE: DateTime.Now.ToString() is sent as a Date value.
  if (String(payresponseMsg).toUpperCase() === 'ACCEPTED') {
    if (String(paystatus).toUpperCase() === 'SUCCESS') {
      status = 1; ActivityByUserId = 'Self'; PaidMode = 13; remarks = 'Success'; Transaction = ''; Sendby = 'IMPS'; paiddate = new Date();
    } else if (String(paystatus).toUpperCase() === 'FAIL') {
      const jsonObject = JSON.parse(d0.error);
      status = 2; ActivityByUserId = 'Self'; PaidMode = 13; remarks = jsonObject.status; Transaction = ''; paiddate = new Date();
    } else {
      status = 4; ActivityByUserId = 'Self'; PaidMode = 13; remarks = 'PENDING'; Transaction = ''; Sendby = 'IMPS'; paiddate = new Date();
    }
  } else if (String(paystatus).toLowerCase() === 'insufficient wallet balance') {
    status = 4; ActivityByUserId = 'Self'; PaidMode = 13; remarks = 'PENDING'; Sendby = 'IMPS'; Transaction = ''; paiddate = new Date();
  } else {
    status = 2; ActivityByUserId = 'Self'; PaidMode = 13; remarks = 'Failed'; Transaction = ''; paiddate = new Date();
  }

  // @SendBy was passed by the legacy code but is not part of the proc's parameter list in the SQL text (ignored)
  const out = await procOne(DB, 'usp_bankwithdrawal_approveorreject', {
    wdid: Wdid, mode: status, strresult: remarks, activitybyuserid: ActivityByUserId, paidmode: PaidMode,
    remark: remarks, transaction: Transaction, paiddate,
  });
  ret = str(out && out.strresult);

  if (ret === 'SUCCESS') {
    if (status === 1 || status === 2) {
      const eid = status === 1 ? 40 : 41;
      const EmailId = await scalar(DB, 'select emailid from member_master where username = @u limit 1', { u: username });
      const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where EID = @e limit 1', { e: eid });
      if (!emailmsg) throw NRE();
      const WithdrawalMsg = emailmsg.email_content;
      const DynamicSponcerMsg = status === 1
        ? await UtilityClass.FindingEmailContentWithUserIdPassword(username, WithdrawalMsg, EmailId, '', 32, '', '', 0, 0, '')
        : await UtilityClass.FindingEmailContentWithUserIdPassword(username, WithdrawalMsg, EmailId, '', 33, '', remarks, 0, 0, '');
      if (emailmsg.email_send_status === 1) {
        bg(() => UtilityClass.SendEmailByApiSetting(username, '', '', '', '', '', EmailId.toLowerCase(), emailmsg.email_subject, DynamicSponcerMsg, null));
      }
    }
  }
  return status;
}

// auth
router.all(`${P}/withdrawal_request{/:id}`, auth, asyncHandler(async (req, res) => {
  const amount = Number(req.p.amount);
  const withdrawaltype = parseInt(req.p.withdrawaltype, 10);
  const { masterOtp, bankName, branchName, IFSC, accountHolderName, accountNumber } = req.p;
  {
    const msg = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 9 limit 1');
    const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where EID = 9 limit 1');
    const membersmsactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=true AND STATUS=true AND REGNO=@p limit 1', { p: req.user.plid })) || 0;
    const memberemailactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=true AND STATUS=true AND REGNO=@p limit 1', { p: req.user.plid })) || 0;
    const master = () => {
      if (masterOtp !== '' && config.app.MasterCode === masterOtp) sessionStore.set(req, 'SessionOTP', masterOtp);
    };
    if (!msg) throw NRE();
    if (msg.sms_send_status !== 1 && membersmsactive === 1) {
      master();
    } else {
      if (!emailmsg) throw NRE();
      if (emailmsg.email_send_status !== 1 && memberemailactive === 1) master();
      else if (memberemailactive === 0 && membersmsactive === 0) master();
    }
  }
  const sess = sessionStore.get(req, 'SessionOTP');
  if (sess === undefined || sess === null) throw NRE();
  if (masterOtp !== String(sess)) return res.json('You have entered wrong OTP.');

  const Plid = Number(req.user.plid);
  if (amount < 100) return res.json('Withdrawal can not be less than 100.');
  let ResultOutput = '';
  const orderid = 'CL' + UtilityClass.GenerateOrderId();
  const out = await procOne(DB, 'usp_bankwithdrawal', {
    regno: Plid, amount, wallettype: withdrawaltype, bankname: bankName, branchname: branchName, ifsc: IFSC,
    accountholdername: accountHolderName, accountnumber: accountNumber, orderid,
  });
  ResultOutput = str(out && out.strresult);
  if (ResultOutput === 'success') {
    const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where EID = 39 limit 1');
    if (!emailmsg) throw NRE();
    const EmailId = await scalar(DB, 'select emailid from member_master where regno = @p limit 1', { p: Plid });
    const WithdrawalMsg = emailmsg.email_content;
    const DynamicSponcerMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(accountHolderName, WithdrawalMsg, EmailId, bankName, 31, branchName, accountNumber, 0, amount, IFSC);
    if (emailmsg.email_send_status === 1) {
      bg(() => UtilityClass.SendEmailByApiSetting(accountHolderName, '', '', '', '', '', EmailId.toLowerCase(), emailmsg.email_subject, DynamicSponcerMsg, null));
    }
    const data = await queryOne(DB, "select * from tbl_withdrawals where plid = @p and status = 'Pending' limit 1", { p: Plid });
    let status = 0;
    if (amount <= 5000) {
      if (!data) throw NRE();
      status = await ProcessPayout(req, String(Plid), String(data.wdid));
    }
    if (status === 1) ResultOutput = 'success';
    else if (status === 2) ResultOutput = 'Withdrawal Failed to transfer';
    else ResultOutput = 'Withdrawal Pending It will clear Soon';
  }
  sessionStore.set(req, 'SessionOTP', null);
  res.json(ResultOutput);
}));

// auth
// PORT-NOTE: public int ProcessPayout(Plid, Wdid) was an MVC action in legacy (returned the status as text); for safety the Plid must equal the JWT member.
router.all(`${P}/ProcessPayout{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid);
  if (Plid !== String(req.user.plid)) return res.status(403).json({ status: 'false', message: 'Forbidden' });
  const status = await ProcessPayout(req, Plid, str(req.p.Wdid));
  res.send(String(status));
}));

// auth
router.all(`${P}/GetDeductions{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = await queryOne(DB, 'select * from FUN_GETFINALWITHDRAWALAMOUNT(@p,@a,@t) limit 1', { p: Number(req.user.plid), a: Number(req.p.WithdrawalAmount), t: parseInt(req.p.withdrawaltype, 10) });
  res.json(mapRow(r, P_DEDUCT));
}));

module.exports = router;
