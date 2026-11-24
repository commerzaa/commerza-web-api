'use strict';
// Ported from Member\Controllers\CustomerPanel\BankAccountWithdraw.cs (4 actions) - database: affiliate (Db_Affiliate)
const express = require('express');
const router = express.Router();
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const NewDMTCoreAPI = require('../../lib/member/NewDMTCoreAPI');
const DB = 'affiliate';
const P = '/member/BankAccountWithdraw';
const col = (row, name) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k !== undefined ? row[k] : undefined; };
const NRE = () => new Error('Object reference not set to an instance of an object.');
// legacy: System.Threading.Thread(...).Start() => fire and forget
const fire = (fn) => { setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }); };
const firstInt = async (sql, params) => { const v = await db.scalar(DB, sql, params); return v === null || v === undefined ? 0 : Number(v); }; // SqlQuery<int>().FirstOrDefault()

// public (legacy session check is commented out; view only)
// route-config: referral/AbNkEAlWVO7ysaKrSmu15lISTBVvezU_plus_ -> Index
router.all([P + '/Index{/:id}', '/member/referral/AbNkEAlWVO7ysaKrSmu15lISTBVvezU_plus_'], asyncHandler(async (req, res) => {
  res.json({});
}));

// auth
router.all(P + '/GenerateOTPForWithdrawalRequest{/:id}', auth, asyncHandler(async (req, res) => {
  const paymode = parseInt(req.p.paymode, 10); const amount = Number(req.p.amount);
  if (Number.isNaN(paymode) || Number.isNaN(amount) || req.p.amount === undefined || req.p.amount === '') {
    return res.status(400).json({ message: 'The parameters dictionary contains a null or invalid entry for paymode/amount.' });
  }
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0; let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const regno = Number(await db.scalar(DB, 'Select coalesce(REGNO,0) As REGNO From MEMBER_MASTER Where PLID=@plid limit 1', { plid: Plid })) || 0;
  const AvailableCommissionWallet = Number(await db.scalar(DB, 'Select coalesce(AvailableCommissionWallet,0) As AvailableCommissionWallet From MEMBER_PERFORMANCE Where RegNo=@regno limit 1', { regno })) || 0;
  if (AvailableCommissionWallet < amount) return res.json('You have insufficient Balance ! !');
  const av = await db.scalar(DB, 'Select coalesce(ACTIVE,false) As ACTIVE From Bank_Accounts Where Regno=@regno and active=true limit 1', { regno });
  const Active = av === null || av === undefined ? false : !!av;
  if (Active === false) return res.json('Please update your bank account !');

  const msg = await db.queryOne(DB, 'select * from TBL_SMSACTION where ID=9 limit 1');
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where EID=9 limit 1');
  Emailstatus = emailmsg.email_send_status;
  const membersmsactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=1 AND STATUS=1 AND REGNO=@plid limit 1', { plid: Plid });
  const memberemailactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=1 AND STATUS=1 AND REGNO=@plid limit 1', { plid: Plid });
  const PLDetails = await db.queryOne(DB, 'select * from portal_login where PLID=@plid limit 1', { plid: Plid });
  if (PLDetails != null) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1 && membersmsactive === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      fire(async () => {
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
router.all(P + '/GenerateOTP{/:id}', auth, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0; let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await db.queryOne(DB, 'select * from TBL_SMSACTION where ID=4 limit 1');
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where EID=4 limit 1');
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await db.queryOne(DB, 'select * from portal_login where PLID=@plid limit 1', { plid: Plid });
  if (PLDetails != null) {
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    const membersmsactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=1 AND STATUS=1 AND REGNO=@plid limit 1', { plid: Plid });
    const memberemailactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=1 AND STATUS=1 AND REGNO=@plid limit 1', { plid: Plid });
    if (Mobilestatus === 1 && membersmsactive === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    } else if (Emailstatus === 1 && memberemailactive === 1) {
      fire(async () => {
        await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Update BTC', Emailmsg, null, '', '');
      });
    } else {
      returnmessage = 'OTP BYPASS';
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  res.json(returnmessage);
}));

// auth
router.all(P + '/withdrawal_request{/:id}', auth, asyncHandler(async (req, res) => {
  const paymode = parseInt(req.p.paymode, 10); const amount = Number(req.p.amount);
  const paymodename = req.p.paymodename; const masterOtp = req.p.masterOtp === undefined ? null : req.p.masterOtp; const ACID = req.p.ACID;
  if (Number.isNaN(paymode) || Number.isNaN(amount) || req.p.amount === undefined || req.p.amount === '') {
    return res.status(400).json({ message: 'The parameters dictionary contains a null or invalid entry for paymode/amount.' });
  }
  const Plid = Number(req.user.plid);
  {
    const msg = await db.queryOne(DB, 'select * from TBL_SMSACTION where ID=9 limit 1');
    const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where EID=9 limit 1');
    const membersmsactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=1 AND STATUS=1 AND REGNO=@plid limit 1', { plid: Plid });
    const memberemailactive = await firstInt('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=1 AND STATUS=1 AND REGNO=@plid limit 1', { plid: Plid });
    const master = config.app.MasterCode;
    const setMaster = () => { if (masterOtp !== '' && master == masterOtp) sessionStore.set(req, 'SessionOTP', masterOtp); }; // eslint-disable-line eqeqeq
    if (msg.sms_send_status !== 1 && membersmsactive === 1) setMaster();
    else if (emailmsg.email_send_status !== 1 && memberemailactive === 1) setMaster();
    else if (memberemailactive === 0 && membersmsactive === 0) setMaster();
  }
  const sess = sessionStore.get(req, 'SessionOTP');
  if (sess === undefined || sess === null) throw NRE();
  if (masterOtp !== String(sess)) return res.json('You have entered wrong OTP.');
  if (amount < 0) return res.json('Withdrawal can not be less than zero.');
  let ResultOutput = '';
  const obj = await db.procOne(DB, 'USP_GETDMTMONEYTRANSFER', { PLID: Plid, MODE: '1', ACID, TYPE: '' });
  if (obj == null) throw NRE(); // legacy: obj.BANKNAME on a null result
  const wr = await db.procOne(DB, 'USP_BANKWITHDRAWAL', {
    REGNO: Plid, AMOUNT: amount, WALLETTYPE: 3, BANKNAME: col(obj, 'BANKNAME'), BRANCHNAME: col(obj, 'BRANCHNAME'), IFSC: col(obj, 'BENEFICIARY_IFSC_CODE'),
    ACCOUNTHOLDERNAME: col(obj, 'BENEFICIARY_NAME'), ACCOUNTNUMBER: col(obj, 'BENEFICIARY_ACCOUNT_NO'), PAYMODE: '1', ACID,
  });
  const ov = (n) => { const v = col(wr, n); return v === undefined || v === null ? null : v; };
  ResultOutput = ov('STRRESULT') === null ? '' : String(ov('STRRESULT'));
  const bankName = col(obj, 'BANKNAME'); const branchName = col(obj, 'BRANCHNAME'); const IFSC = col(obj, 'BENEFICIARY_IFSC_CODE');
  const accountHolderName = col(obj, 'BENEFICIARY_NAME'); const accountNumber = col(obj, 'BENEFICIARY_ACCOUNT_NO');
  if (ResultOutput === 'success') {
    const WDID = parseInt(String(ov('WDIDTEMP')), 10);
    const PayableAmountTemp = ov('PAYABLEAMOUNT') === null ? '' : String(ov('PAYABLEAMOUNT'));
    // Process DMT Withdrawal
    const Client_Trans_Id = String(Math.floor(Math.random() * 1000000)).padStart(10, '0');
    const APIResponse = await NewDMTCoreAPI.TransferMoney(col(obj, 'MSISDN'), PayableAmountTemp, col(obj, 'BENEFICIARY_ID'), Client_Trans_Id);
    const objDmtTransaction = JSON.parse(APIResponse);
    if (!objDmtTransaction.data || objDmtTransaction.data.error_code === undefined || objDmtTransaction.data.error_code === null) throw NRE();
    const ec = String(objDmtTransaction.data.error_code);
    if (ec === '200' || ec === '201') {
      // Success Area
      const TransactionId = String(objDmtTransaction.data.transId);
      await db.proc(DB, 'USP_BANKWITHDRAWAL_APPROVEORREJECT', {
        WDID, MODE: '1', STRRESULT: 'Auto Withdrawal Paid By DMT Services', ActivityByUserId: '0', PaidMode: '11',
        Remark: 'Auto Withdrawal Paid By DMT Services', Transaction: TransactionId, paiddate: '',
      });
    } else {
      // Failure Area
      await db.proc(DB, 'USP_BANKWITHDRAWAL_APPROVEORREJECT', {
        WDID, MODE: '2', STRRESULT: 'Auto Withdrawal Rejected By DMT Services', ActivityByUserId: '0', PaidMode: '0',
        Remark: 'Auto Withdrawal Rejected By DMT Services', Transaction: '', paiddate: '',
      });
    }
    const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where EID=39 limit 1');
    const EmailId = await db.scalar(DB, 'select emailid from member_master where regno=@plid limit 1', { plid: Plid });
    const WithdrawalMsg = emailmsg.email_content;
    const DynamicSponcerMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(accountHolderName, WithdrawalMsg, EmailId, bankName, 31, branchName, accountNumber, 0, amount, IFSC);
    if (emailmsg.email_send_status === 1) {
      fire(async () => {
        await UtilityClass.SendEmailByApiSetting(accountHolderName, '', '', '', '', '', EmailId.toLowerCase(), emailmsg.email_subject, DynamicSponcerMsg, null);
      });
    }
  }
  sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
  res.json(ResultOutput);
  void paymode; void paymodename;
}));

module.exports = router;
