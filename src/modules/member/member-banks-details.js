'use strict';
// Ported from Member\Controllers\CustomerPanel\MemberBanksDetailsController.cs (database: affiliate - Db_Affiliate)
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const config = require('../../config');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Bank_acount = require('../../lib/member/DETAIL_SPAGE_MASTER_FOR_REGISTRATION');
const EzpayDMTCoreAPI = require('../../lib/member/EzpayDMTCoreAPI');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/MemberBanksDetails';
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const nz = (v) => (v === undefined || v === null ? '' : v);
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const sget = (req, k) => sessionStore.get(req, k.toLowerCase());
const sset = (req, k, v) => sessionStore.set(req, k.toLowerCase(), v);
const MASTER = () => config.app.MasterCode || ''; // ConfigurationManager.AppSettings["MasterCode"]
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }; // legacy background thread
const DMT_PROPS = ['MSISDN', 'TRANSFER_TYPE', 'BENEFICIARY_ID', 'BENEFICIARY_ACCOUNT_NO', 'BENEFICIARY_IFSC_CODE', 'BENEFICIARY_BANK_CODE', 'BENEFICIARY_NAME', 'BANKNAME', 'BRANCHNAME'];

async function errorInsert(req, e, procName) {
  try { await new DataUtility().ErrorInsert(0, e.message, procName, 0, req.path); } catch (_) { /* ignore */ }
}

// TBL_DMTAPICALLLOG: deactivate the previous log of the message code and insert a new one (legacy built one 2-statement string)
async function dmtLog(plid, messageCode, RequestId, vals, APIResponse) {
  await db.exec(DB, 'UPDATE tbl_dmtapicalllog SET active = 0, status = 0 WHERE messagecode = @mc AND plid = @plid', { mc: messageCode, plid });
  await db.exec(DB, `Insert Into tbl_dmtapicalllog(requestid,mobileno,name,beneficiaryname,accountno,ifscorbankcode,bankname,bankcode,aadharno,panno,beneficiarycode,verifyreferenceid,otp,amount,transtype,clientrequestid,messagecode,callingdatetime,response,responsedatetime,status,active,plid)
    Values(@requestid,@mobileno,'','',@accountno,'','',@bankcode,'','','',@verifyreferenceid,@otp,'','','',@mc,now(),@response,now(),1,1,@plid)`, {
    requestid: RequestId, mobileno: vals.mobileno || '', accountno: vals.accountno || '', bankcode: vals.bankcode || '',
    verifyreferenceid: vals.verifyreferenceid || '', otp: vals.otp || '', mc: messageCode, response: APIResponse, plid,
  });
}

// auth
router.all([`${P}/Index{/:id}`, '/member/referral/member-bank-details'], ...guard, asyncHandler(async (req, res) => { // route-config
  const regno = Number(req.user.plid);
  const objBa = new Bank_acount();
  res.json({ Model: await objBa.AllDetails(regno) });
}));

// auth
router.all(`${P}/GenerateOTP{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sset(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const msg = await db.queryOne(DB, 'select * from tbl_smsaction where id = 4 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 4 limit 1');
  if (!emailmsg) throw NRE();
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await db.queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid: Plid });
  if (PLDetails) {
    // legacy condition (PHONE != null || PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1) {
      fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    }
    if (Emailstatus === 1) {
      fire(() => { // (EMAILID != null || EMAILID != "") is always true
        return UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Update BTC', Emailmsg, null, '', '');
      });
    }
    returnmessage = 'OTP SENT';
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  res.json(returnmessage);
}));

// auth
router.all(`${P}/UpdateBankDetails{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  try {
    let EmpId = parseInt(p.EmpId, 10) || 0;
    const { AccHolName, AccountNo, BankName, BranchName, IFSCCode, SwiftCode, BankCode } = p;
    const OTPCODE = p.OTPCODE;
    if (EmpId === 0) EmpId = parseInt(req.user.plid, 10);
    const plid = Number(req.user.plid);
    const msg = await db.queryOne(DB, 'select * from tbl_smsaction where id = 4 limit 1');
    const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 4 limit 1');
    const membersmsactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE issms = 1 AND status = 1 AND regno = @r limit 1', { r: plid })) || 0;
    const memberemailactive = Number(await db.scalar(DB, 'SELECT 1 FROM tbl_memberauthentication WHERE isemail = 1 AND status = 1 AND regno = @r limit 1', { r: plid })) || 0;
    const masterOk = () => OTPCODE !== undefined && OTPCODE !== null && OTPCODE !== '' && MASTER() !== '' && MASTER() === OTPCODE;
    if (msg.sms_send_status !== 1 && membersmsactive === 1) {
      if (OTPCODE !== '') { if (masterOk()) sset(req, 'SessionOTP', OTPCODE); }
    } else if (emailmsg.email_send_status !== 1 && memberemailactive === 1) {
      if (OTPCODE !== '') { if (masterOk()) sset(req, 'SessionOTP', OTPCODE); }
    } else if (memberemailactive === 0 && membersmsactive === 0) {
      if (OTPCODE !== '') { if (masterOk()) sset(req, 'SessionOTP', OTPCODE); }
    }
    if (OTPCODE !== undefined && OTPCODE !== null && OTPCODE !== '') {
      const so = sget(req, 'SessionOTP');
      if (so === undefined || so === null) throw NRE();
      if (OTPCODE !== String(so)) return res.json('error^You have entered wrong OTP.');
    }
    // PORT-NOTE: the DMT beneficiary registration block that followed in the legacy file is commented out in the C# and not ported
    const rows = await db.proc(DB, 'usp_insertmemberbankdetais', {
      REGNO: EmpId, HOLDERNAME: AccHolName, ACOUNTNO: AccountNo, BANKNAME: BankName, BRANCHNAME: BranchName,
      IESCCODE: IFSCCode, SWIFTCODE: SwiftCode, BankCode,
    });
    const o = outv(rows, 'strresult');
    if (o === undefined || o === null) throw NRE();
    return res.json(String(o));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_INSERTMEMBERBANKDETAIS');
    return res.json('Error occurred. Please try later');
  }
}));

// auth
router.all(`${P}/CheckIFSCCode{/:id}`, ...guard, asyncHandler(async (req, res) => {
  try {
    const baseurl = 'https://ifsc.razorpay.com/' + nz(req.p.ifsccode);
    const r = await axios.get(baseurl, { responseType: 'text', transformResponse: [(d) => d] });
    res.json(r.data);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'checkifsccode');
    res.json(' Not Found');
  }
}));

// auth
router.all(`${P}/VerifyBenificaryAccount{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { OTP, TransactionId, AccountNo } = req.p;
  try {
    const Plid = Number(req.user.plid);
    let objApiResponse;
    if (OTP !== undefined && OTP !== null && OTP !== '') {
      const RequestId = await EzpayDMTCoreAPI.GetTimestamp(new Date());
      const MessageCode = 'E06021';
      const APIResponse = await EzpayDMTCoreAPI.VerifyOTP(RequestId, TransactionId, OTP);
      objApiResponse = String(APIResponse).split('~');
      await dmtLog(Plid, MessageCode, RequestId, { verifyreferenceid: TransactionId, otp: OTP }, APIResponse);
    } else {
      return res.json('OTP Required !.');
    }
    if (objApiResponse[5].toLowerCase() === 'success') {
      await db.exec(DB, 'UPDATE tbl_dmtbeneficiarymaster SET isverified = 1 WHERE trans_id_benificiaryregistration = @t', { t: TransactionId });
      const EmpId = parseInt(req.user.plid, 10);
      await db.exec(DB, 'UPDATE bank_accounts SET isdmtverified = 1 WHERE accountno = @a AND iskycbankdetails = 0 AND regno = @r', { a: AccountNo, r: EmpId });
      return res.json('success');
    }
    return res.json(objApiResponse[6]);
  } catch (e) {
    return res.json('Some eror occured in verification try later please.');
  }
}));

// auth
router.all(`${P}/UpdateBankStatus{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const AccountNo = req.p.AccountNo;
  let W = 0;
  const Plid = parseInt(req.user.plid, 10);
  const a = await db.scalar(DB, 'SELECT CAST(acid AS INT) From bank_accounts WHERE accountno = @a AND iskycbankdetails = 0 AND isenable = 0 AND regno = @r limit 1', { a: AccountNo, r: Plid });
  const ACID = a === null || a === undefined ? 0 : Number(a);
  const orows = await db.proc(DB, 'new_usp_getdmtmoneytransfer', { PLID: Plid, MODE: '1', ACID, TYPE: '' });
  const objm = orows && orows.length ? orows[0] : null;
  const obj = objm ? require('../../utils/shape').mapRows([objm], DMT_PROPS)[0] : null;
  if (ACID !== 0 && obj !== null) {
    let CustomerMobile = await db.scalar(DB, "SELECT fname || '~' || mobile FROM member_master WHERE regno = @r limit 1", { r: Number(req.user.plid) });
    const RequestId = await EzpayDMTCoreAPI.GetTimestamp(new Date());
    const MessageCode = 'E06031';
    if (CustomerMobile === null || CustomerMobile === undefined) throw NRE();
    const objDbResponse = String(CustomerMobile).split('~');
    CustomerMobile = objDbResponse[1];
    const APIResponse = await EzpayDMTCoreAPI.AccountValidation(RequestId, CustomerMobile, obj.BENEFICIARY_ACCOUNT_NO, obj.BENEFICIARY_BANK_CODE,
      '526489754125', 'CDER546859 ');
    const objApiResponse = String(APIResponse).split('~');
    await dmtLog(Plid, MessageCode, RequestId, { mobileno: CustomerMobile, accountno: obj.BENEFICIARY_ACCOUNT_NO, bankcode: obj.BENEFICIARY_BANK_CODE }, APIResponse);
    if (objApiResponse[5].toLowerCase() === 'success') {
      W = await db.exec(DB, 'UPDATE bank_accounts SET isenable = (CASE WHEN isenable = 0 THEN 1 WHEN isenable = 1 THEN 0 ELSE isenable END) WHERE accountno = @a AND iskycbankdetails = 0 AND regno = @r', { a: AccountNo, r: Plid });
    }
  } else {
    W = await db.exec(DB, 'UPDATE bank_accounts SET isenable = 0 WHERE accountno = @a AND iskycbankdetails = 0 AND regno = @r', { a: AccountNo, r: Plid });
  }
  res.json(W);
}));

module.exports = router;
