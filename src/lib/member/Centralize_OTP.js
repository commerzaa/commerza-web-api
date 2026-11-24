/** Exports (static class Centralize_OTP, namespace Common.Models; Member app, database 'affiliate'; all async; the trailing `req` replaces HttpContext.Current.Session):
 *   GenrateOTP(int smSID, int emailEID, string TransPass, req) : string            ("Success^OTP SENT" | "Success^OTP BYPASS" | "Error^Please Enter Your Password")
 *   GenrateOTP_transfer(int smSID, int emailEID, string TransPass, req) : string
 *   CheckSecurityForTransctiion_transfer(int PaymentMode, string Username, string Password, string OTPCODE, string hfauthenticated, string GAKEY, decimal Amount, req) : string
 *   CheckSecurityForTransctiion(int PaymentMode, string Username, string Password, string OTPCODE, string hfauthenticated, string GAKEY, decimal Amount, req) : string
 * PORT-NOTE: Session["plid"] (Login object) => req.user.plid (JWT); Session["SessionOTP"] => utils/sessionStore get/set(req, 'SessionOTP') (required lazily).
 * PORT-NOTE: AppSettings["MasterCode"] => config.app.MasterCode.
 * PORT-NOTE: the `if(false){...}` blocks of CheckSecurityForTransctiion are dead code and are not ported (the MEMBER_LOGIN.IsVerify lookup there has no effect).
 */
'use strict';
const config = require('../../config');
const { queryOne, scalar } = require('../../db');
const { Encryptword, Decryptword } = require('../../utils/crypto');
const { fire } = require('../_libhelpers');

const DB = 'affiliate';

const NRE = () => new TypeError('Object reference not set to an instance of an object.');

function store() { return require('../../utils/sessionStore'); }

function sessionPlid(req) {
  if (!req || !req.user || req.user.plid === undefined || req.user.plid === null) throw NRE();
  return req.user.plid;
}

function masterCode() {
  const v = config.app.MasterCode;
  return v === undefined ? null : v;
}

// SELECT 1 ... FirstOrDefault() => 0 when no row
async function flag(sql, p) {
  const v = await scalar(DB, sql, p);
  return v === null || v === undefined ? 0 : Number(v);
}

// SqlQuery<bool>(...).FirstOrDefault() => false when no row
async function isVerify(Plid) {
  const v = await scalar(DB, 'select IsVerify from MEMBER_LOGIN where REGNO=@plid limit 1', { plid: Plid });
  return v === true || v === 1 || v === '1';
}

const AUTH_SMS = 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS::int=1 AND STATUS::int=1 AND REGNO=@plid limit 1';
const AUTH_EMAIL = 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL::int=1 AND STATUS::int=1 AND REGNO=@plid limit 1';

async function loadActions(smSID, emailEID) {
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id=@id limit 1', { id: smSID });
  if (msg === null) throw NRE();
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status from tbl_emailaction where eid=@eid limit 1', { eid: emailEID });
  if (emailmsg === null) throw NRE();
  return { msg, emailmsg };
}

async function GenrateOTP(smSID, emailEID, TransPass, req) {
  const UtilityClass = require('./UtilityClass');
  const OTP = String(await UtilityClass.RandomNumberStringByLength(4));
  let Mobilestatus = 0;
  let Emailstatus = 0;
  let membersmsactive = 0;
  let memberemailactive = 0;
  store().set(req, 'SessionOTP', OTP);
  const Plid = sessionPlid(req);

  const { msg, emailmsg } = await loadActions(smSID, emailEID);
  Mobilestatus = msg.sms_send_status;
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select regno, mobile, username, emailid from member_master where regno=@plid limit 1', { plid: Plid });
  if (PLDetails !== null) {
    if (PLDetails.mobile !== null || PLDetails.mobile !== '') {
      membersmsactive = await flag(AUTH_SMS, { plid: Plid });
      memberemailactive = await flag(AUTH_EMAIL, { plid: Plid });
      const Userid = '';
      // messg is computed (stored-procedure call) but never used by the legacy code
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
      const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
      const IsActiveTranPass = await isVerify(Plid);
      if (IsActiveTranPass === true) {
        if (String(TransPass).trim() === '') {
          return 'Error^Please Enter Your Password';
        }
      }
      const Msg = 'Dear ' + PLDetails.username + ',Use this One Time Password ' + OTP + ' Verify your Mobile. Regards, CLUSTER LEVEL MARKETING';
      if (Mobilestatus === 1 && membersmsactive === 1) {
        // legacy: new Thread(...).Start()
        fire(async () => {
          await UtilityClass.SendSMSWithAPIz(PLDetails.mobile, Msg, '1');
        });
      }
      if (Emailstatus === 1 && memberemailactive === 1) {
        fire(async () => {
          if (PLDetails.emailid !== null || PLDetails.emailid !== '') {
            await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', '');
          }
        });
      }
    }
  }
  if ((Mobilestatus === 0 && Emailstatus === 0) || (membersmsactive === 0 && memberemailactive === 0)) {
    return 'Success^OTP BYPASS';
  }
  return 'Success^OTP SENT';
}

async function GenrateOTP_transfer(smSID, emailEID, TransPass, req) {
  const UtilityClass = require('./UtilityClass');
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let Mobilestatus = 0;
  let Emailstatus = 0;
  let membersmsactive = 0;
  let memberemailactive = 0;
  store().set(req, 'SessionOTP', OTP);
  const Plid = sessionPlid(req);

  const { msg, emailmsg } = await loadActions(smSID, emailEID);
  Mobilestatus = msg.sms_send_status;
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select plid, phone, username, tpassword, emailid from portal_login where plid=@plid limit 1', { plid: Plid });
  if (PLDetails !== null) {
    if (PLDetails.phone !== null || PLDetails.phone !== '') {
      membersmsactive = await flag(AUTH_SMS, { plid: Plid });
      memberemailactive = await flag(AUTH_EMAIL, { plid: Plid });
      const Userid = '';
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
      const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
      const IsActiveTranPass = await isVerify(Plid);
      if (IsActiveTranPass === true) {
        if (String(TransPass).trim() === '') {
          return 'Error^Please Enter Your Password';
        }
        if (PLDetails.tpassword === '') {
          return 'Error^It Seems You did not update your password yet';
        }
        TransPass = Encryptword(TransPass);
        if (TransPass !== PLDetails.tpassword) {
          return 'Error^Invalid Transaction Password!';
        }
      }
      if (Mobilestatus === 1 && membersmsactive === 1) {
        fire(async () => {
          await UtilityClass.SendSMSWithAPI(PLDetails.phone, messg, '1');
        });
      }
      if (Emailstatus === 1 && memberemailactive === 1) {
        fire(async () => {
          if (PLDetails.emailid !== null || PLDetails.emailid !== '') {
            await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Member Topup', Emailmsg, null, '', '');
          }
        });
      }
    }
  }
  if ((Mobilestatus === 0 && Emailstatus === 0) || (membersmsactive === 0 && memberemailactive === 0)) {
    return 'Success^OTP BYPASS';
  }
  return 'Success^OTP SENT';
}

// shared "master code" OTP override block of both CheckSecurity* methods
async function applyMasterCode(Plid, OTPCODE, req) {
  const membersmsactive = await flag(AUTH_SMS, { plid: Plid });
  const memberemailactive = await flag(AUTH_EMAIL, { plid: Plid });
  const msg = await queryOne(DB, 'select sms_send_status from tbl_smsaction where id=17 limit 1');
  const emailmsg = await queryOne(DB, 'select email_send_status from tbl_emailaction where eid=14 limit 1');
  const ok = () => { if (OTPCODE !== '') { if (masterCode() === OTPCODE) store().set(req, 'SessionOTP', OTPCODE); } };
  if (msg === null) throw NRE();
  if (msg.sms_send_status !== 1 && membersmsactive === 1) {
    ok();
  } else {
    if (emailmsg === null) throw NRE();
    if (emailmsg.email_send_status !== 1 && memberemailactive === 1) {
      ok();
    } else if (memberemailactive === 0 && membersmsactive === 0) {
      ok();
    }
  }
}

function sessionOtpString(req) {
  const v = store().get(req, 'SessionOTP');
  if (v === undefined || v === null) throw NRE(); // Session["SessionOTP"].ToString() on null
  return String(v);
}

async function CheckSecurityForTransctiion_transfer(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, req) {
  const Plid = sessionPlid(req);
  const IsSecuritySuccess = 'success';
  if (Password === null || Password === undefined || Password === '') {
    Password = await scalar(DB, 'Select TPASSWORD From Portal_Login Where PLID=@plid limit 1', { plid: Plid });
    if (Password === null || Password === undefined) throw NRE();
    if (String(Password).trim() !== '') {
      Password = Decryptword(Password);
    }
  }
  if (hfauthenticated === null || hfauthenticated === undefined) {
    hfauthenticated = '0';
  }
  if (Username === '') {
    Username = await scalar(DB, 'select username from member_master where regno=@plid limit 1', { plid: Plid });
  }
  await applyMasterCode(Plid, OTPCODE, req);
  if (OTPCODE !== sessionOtpString(req)) {
    return 'error^You have entered wrong OTP.';
  } else if (OTPCODE === sessionOtpString(req) && hfauthenticated === '1') {
    if (GAKEY === '') {
      return 'GAKey';
    }
  }
  if (Username === '' || Amount <= 0) {
    return 'Invalid^Please enter the mandatory fields.';
  } else {
    const IsActiveTranPass = await isVerify(Plid);
    if (IsActiveTranPass === true) {
      if (String(Password).trim() !== '') {
        Password = Encryptword(Password);
        const PL = await queryOne(DB, 'select plid from portal_login where trim(tpassword)=trim(@pw) and plid=@plid limit 1', { pw: Password, plid: Plid });
        if (PL === null) {
          return 'Invalid^Wrong Transaction Password.Please try again.';
        }
      }
    }
  }
  return IsSecuritySuccess;
}

async function CheckSecurityForTransctiion(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, req) {
  const Plid = sessionPlid(req);
  const IsSecuritySuccess = 'success';
  if (hfauthenticated === null || hfauthenticated === undefined) {
    hfauthenticated = '0';
  }
  if (Username === '') {
    Username = await scalar(DB, 'select username from member_master where regno=@plid limit 1', { plid: Plid });
  }
  await applyMasterCode(Plid, OTPCODE, req);
  if (OTPCODE !== sessionOtpString(req)) {
    return 'error^You have entered wrong OTP.';
  } else if (OTPCODE === sessionOtpString(req) && hfauthenticated === '1') {
    if (GAKEY === '') {
      return 'GAKey';
    }
  }
  if (Username === '' || Amount <= 0) {
    return 'Invalid^Please enter the mandatory fields.';
  }
  return IsSecuritySuccess;
}

module.exports = { GenrateOTP, GenrateOTP_transfer, CheckSecurityForTransctiion_transfer, CheckSecurityForTransctiion };
