'use strict';
/** Port of Member/Controllers/CustomerPanel/TransferAtcCoin.cs (TransferAtcCoinController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { queryOne, proc, procOne } = require('../../db');
const { mapRow } = require('../../utils/shape');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const Security_Key = require('../../lib/member/Security_Key');
const ATCAPI = require('../../lib/member/ATCAPI');

const router = express.Router();
const DB = 'affiliate';

const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }; // System.Threading.Thread replacement
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const NPE = () => new TypeError('Object reference not set to an instance of an object.');
/** APIResponse.Substring(2, Length - 4).Replace("\\", "") then JArray.Parse */
function parseApiArray(s) {
  s = s === undefined || s === null ? '' : String(s);
  if (s.length < 4) throw new RangeError('Index and length must refer to a location within the string.');
  return JSON.parse(s.substring(2, s.length - 2).split('\\').join(''));
}
const isDecimal = (s) => /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(String(s));
const toDecimal = (s) => {
  if (s === undefined || s === null) return 0; // Convert.ToDecimal((string)null) == 0
  if (!isDecimal(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
};
const str = (v) => (v === undefined || v === null ? '' : String(v));

// route-config: referral/GCFE2Ctopd96qUhYdKIKSA== -> Index
// auth
router.all(['/member/TransferAtcCoin/Index{/:id}', '/member/referral/GCFE2Ctopd96qUhYdKIKSA=='], auth, asyncHandler(async (req, res) => {
  const qs = req.p.qs;
  sessionStore.set(req, 'SessionTopupOTP', null);
  if (qs !== undefined && qs !== null) {
    let Id = 0; // eslint-disable-line no-unused-vars
    try {
      Id = parseInt(await UtilityClass.Decryptword(qs), 10);
      if (Number.isNaN(Id)) throw new Error('Input string was not in a correct format.');
    } catch (e) {
      Id = 0;
    }
    return res.json({ view: '~/Views/CustomerPanel/TransferAtcCoin/Index.cshtml' });
  }
  return res.json({ view: '~/Views/CustomerPanel/TransferAtcCoin/Index.cshtml' });
}));

/** Legacy GenerateOTP() action body; returns the message ("OTP SENT" | "OTP BYPASS"). Also stores Session["SessionOTP"]. */
async function generateOtp(req) {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Math.trunc(Number(req.user.plid));
  const msg = await queryOne(DB, 'SELECT sms_content,sms_send_status FROM tbl_smsaction WHERE id=9 LIMIT 1');
  if (!msg) throw NPE();
  const Mobilestatus = msg.sms_send_status;
  const emailmsg = await queryOne(DB, 'SELECT email_content,email_send_status FROM tbl_emailaction WHERE eid=9 LIMIT 1');
  if (!emailmsg) throw NPE();
  const Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'SELECT plid,username,phone,emailid FROM portal_login WHERE plid=@plid LIMIT 1', { plid: Plid });
  if (PLDetails) {
    // (PLDetails.PHONE != null || PLDetails.PHONE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 4);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1) fire(() => UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1'));
    if (Emailstatus === 1) {
      fire(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', ''));
    }
  }
  if (Mobilestatus === 0 && Emailstatus === 0) returnmessage = 'OTP BYPASS';
  else returnmessage = 'OTP SENT';
  return returnmessage;
}

// auth (legacy had no session check but it reads Session["plid"])
router.all('/member/TransferAtcCoin/GenerateOTP{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await generateOtp(req));
}));

// auth (legacy had no session check but it reads Session["plid"])
router.all('/member/TransferAtcCoin/ResendOTP{/:id}', auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionTopupOTP', null);
  await generateOtp(req); // legacy: OTP = GenerateOTP().ToString() (the JsonResult object's type name, not the OTP) ...
  sessionStore.set(req, 'SessionTopupOTP', 'System.Web.Mvc.JsonResult');
  res.json('successotp^OTP re-sent to your registered mobile number.');
}));

// auth ([SessionExpireCheck])
router.all('/member/TransferAtcCoin/TransferCoin{/:id}', auth, asyncHandler(async (req, res) => {
  // MVC binds an empty string to null (ConvertEmptyStringToNull), which the legacy "== \"\"" checks below inherit
  const bn = (v) => (v === undefined || v === '' ? null : v);
  const ToWalletAddress = bn(req.p.ToWalletAddress);
  const NoOfCoins = bn(req.p.NoOfCoins);
  let Password = bn(req.p.Password);
  const GAKEY = bn(req.p.GAKEY);
  const OTPCODE = bn(req.p.OTPCODE);
  let HfIsAuthenticated = bn(req.p.HfIsAuthenticated);

  let NoOfCoin = '0.00000000';
  let APIResponseForSave = '';
  let TransactionId = '';
  const PLID = Math.trunc(Number(req.user.plid));

  // Same Member Can Not Topup Coin Wallet More Than Once Within 3 Hour By ATC Coin
  // PORT-NOTE: @STRRESULT OUT is returned as a column of the result row.
  const chk = await proc(DB, 'usp_atccointrasferhistoryfromatcwallettoatcwallet', {
    plid: PLID, fromatcuserid: '', fromatcwallet: '', toatcwallet: '', noofcoins: '0.00000000', transcationid: '', apiresponse: '', mode: '3',
  });
  const chkRes = outCol(chk, 'strresult');
  if (chkRes.toLowerCase() !== 'success') return res.json('Error^' + chkRes);

  if (HfIsAuthenticated === undefined || HfIsAuthenticated === null) HfIsAuthenticated = '0';

  // Generate And Validate OTP Code Start Here
  const msg = await queryOne(DB, 'SELECT sms_send_status FROM tbl_smsaction WHERE id=9 LIMIT 1');
  const emailmsg = await queryOne(DB, 'SELECT email_send_status FROM tbl_emailaction WHERE eid=9 LIMIT 1');
  if (!msg || !emailmsg) throw NPE();
  if (msg.sms_send_status === 0 && emailmsg.email_send_status === 0) {
    const master = config.app && config.app.MasterCode;
    if (master !== undefined && master !== null && master !== '' && master === OTPCODE) sessionStore.set(req, 'SessionOTP', OTPCODE);
  }
  const sessionOtp = sessionStore.get(req, 'SessionOTP');
  if (sessionOtp === undefined || sessionOtp === null) throw NPE(); // Session["SessionOTP"].ToString()
  if (OTPCODE !== String(sessionOtp)) return res.json('error^You have entered wrong OTP.');
  if (OTPCODE === String(sessionOtp) && HfIsAuthenticated === '1') {
    if (GAKEY === '') return res.json('GAKey');
  }
  // Generate And Validate OTP Code End Here

  try {
    if (ToWalletAddress === '') {
      return res.json('Invalid^To Wallet Address is required.');
    } else if (NoOfCoins === '') {
      return res.json('Invalid^No Of Coins is required.');
    } else {
      Password = await UtilityClass.Encryptword(Password);
      const PL = await queryOne(DB, 'SELECT plid FROM portal_login WHERE tpassword=@pw AND plid=@plid LIMIT 1', { pw: Password, plid: PLID });
      if (!PL) return res.json('Invalid^Wrong Password.Please try again.');
    }
    // Session["Plid"] != null
    {
      const Plid = PLID;
      const objs = await new Security_Key().Get_Security_Key(Plid);
      if (objs !== null && objs !== undefined) {
        if (!(await objs.Check_GaKey(Plid, GAKEY))) return res.json('Error^Please enter valid GA key !');
      }
    }
    const ResponseMeaning = '';
    if (ToWalletAddress !== '') {
      const atcRow = await procOne(DB, 'usp_getatcdetails', { plid: PLID });
      const ObjATCDatails = atcRow ? mapRow(atcRow, ['INR', 'Atc_WalletAddress', 'ATCUserId']) : null;
      if (ObjATCDatails === null) throw NPE();
      if (ObjATCDatails.ATCUserId !== '' || ObjATCDatails.Atc_WalletAddress !== '') {
        if (ObjATCDatails.ATCUserId !== '' && ObjATCDatails.Atc_WalletAddress !== '') {
          // For Check Member Has Balance Or Not
          const APIResponseBalance = await ATCAPI.GetATCWalletBalance(ObjATCDatails.ATCUserId, ObjATCDatails.Atc_WalletAddress);
          const ObjJArrayNew = parseApiArray(APIResponseBalance);
          if (isDecimal(str(ObjJArrayNew[0].Response))) {
            NoOfCoin = str(ObjJArrayNew[0].Response);
          } else {
            return res.json('error^' + str(ObjJArrayNew[0].Response));
          }
        } else {
          NoOfCoin = '0.00000000';
        }
        if (toDecimal(NoOfCoins) > toDecimal(NoOfCoin)) {
          return res.json('error^' + 'You Have Insufficient Fund In Your Wallet');
        }
        try {
          // For Check Sender ATCWalletAddressAndAtcUserIdMatchOrNot
          const APIResponseMatch = await ATCAPI.MatchATCWalletAddressAndUserId(ObjATCDatails.ATCUserId, ObjATCDatails.Atc_WalletAddress);
          const ObjJArrayMatch = parseApiArray(APIResponseMatch);
          const ResponseMatch = str(ObjJArrayMatch[0].Response);
          const IsSuccessMatch = str(ObjJArrayMatch[0].IsSuccess);
          if (IsSuccessMatch.trim() !== '1') return res.json('error^' + ResponseMatch);
          // For Validate Receiver Atc Wallet Address Exists Or Not
          const APIResponseValidate = await ATCAPI.ValidateATCWalletAddress(ToWalletAddress);
          const ObjJArrayValidate = parseApiArray(APIResponseValidate);
          const ResponseValidate = str(ObjJArrayValidate[0].Response);
          const IsSuccessValidate = str(ObjJArrayValidate[0].IsSuccess);
          if (IsSuccessValidate.trim() !== '1') return res.json('error^' + ResponseValidate);
        } catch (ExpObj) {
          await new (require('../../lib/member/DataUtility'))().ErrorInsert(0, ExpObj.message, 'TransferCoin', 0, req.originalUrl.split('?')[0]);
          return res.json('error^' + 'Some exception occur try later please !' + ExpObj.message);
        }
        const APIResponse = await ATCAPI.ATCSendReceived(ObjATCDatails.ATCUserId, ToWalletAddress, str(NoOfCoins));
        APIResponseForSave = APIResponse;
        const ObjJArray = parseApiArray(APIResponse);
        const ResponseMessage = str(ObjJArray[0].Response);
        TransactionId = str(ObjJArray[0].TxID);
        if (ResponseMessage.trim().toLowerCase() !== 'true') {
          return res.json(ResponseMessage);
        } else if (TransactionId.trim() === '') {
          return res.json('error^' + 'Invalid Transaction Id.');
        }
        // If Any One Done The Transaction Please Save The Transaction
        const sp = await proc(DB, 'usp_atccointrasferhistoryfromatcwallettoatcwallet', {
          plid: PLID, fromatcuserid: ObjATCDatails.ATCUserId, fromatcwallet: ObjATCDatails.Atc_WalletAddress, toatcwallet: ToWalletAddress, noofcoins: NoOfCoins,
          transcationid: TransactionId, apiresponse: APIResponseForSave, mode: '1',
        });
        if (outCol(sp, 'strresult').toLowerCase() === 'success') return res.json('Success^ Transferd Successfully.');
        return res.json('Error^API Not Responding Try Later.');
      }
      return res.json("Error^Dear User you don't have Wallet address!");
    }
    sessionStore.set(req, 'SessionTopupOTP', null); // Session.Remove("SessionTopupOTP")
    return res.json(ResponseMeaning);
  } catch (Ex) {
    return res.json('Error^Some error occured. Please try again.' + Ex.message);
  }
}));

module.exports = router;
