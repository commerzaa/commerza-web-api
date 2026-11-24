/** Exports (static class Centralize_OTP):
 *   async GenrateOTP(int smSID, int emailEID, string TransPass, object session) : string   ("Success^OTP SENT" | "Success^OTP BYPASS" | "Error^...")
 *   async CheckSecurityForTransctiion(int PaymentMode, string Username, string Password, string OTPCODE, string hfauthenticated, string GAKEY, decimal Amount, object session) : string
 * PORT-NOTE: legacy code used HttpContext.Current.Session["plid"] (a Login object with .Plid) and Session["SessionOTP"].
 * Here a trailing `session` argument (plain mutable object, e.g. req.session or a per-user store) is required:
 *   session.plid = { Plid: <long> }  (or a number)   session.SessionOTP = <string>   (GenrateOTP writes SessionOTP)
 * PORT-NOTE: AppSettings["MasterCode"] is read from config.app.MasterCode (fallback env MASTER_CODE); add MASTER_CODE to config/.env.example.
 */
'use strict';
const config = require('../config');
const { queryOne, scalar } = require('../db');
const { Encryptword, Decryptword } = require('../utils/crypto');
const { fire } = require('./_libhelpers');

function sessionPlid(session) {
  if (!session || session.plid === undefined || session.plid === null) {
    throw new TypeError('Object reference not set to an instance of an object. (session.plid missing)');
  }
  const p = session.plid;
  return typeof p === 'object' ? p.Plid : p;
}

function masterCode() {
  const v = config.app.MasterCode !== undefined ? config.app.MasterCode : process.env.MASTER_CODE;
  return v === undefined ? null : v;
}

// SELECT 1 ... FirstOrDefault() => 0 when no row
async function flag(sql, p) {
  const v = await scalar('affiliate', sql, p);
  return v === null || v === undefined ? 0 : Number(v);
}

async function GenrateOTP(smSID, emailEID, TransPass, session) {
  const UtilityClass = require('./UtilityClass');
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let Mobilestatus = 0;
  let Emailstatus = 0;
  let membersmsactive = 0;
  let memberemailactive = 0;
  const Plid = sessionPlid(session);
  session.SessionOTP = OTP;

  const msg = await queryOne('affiliate', 'select sms_content, sms_send_status from tbl_smsaction where id=@id limit 1', { id: smSID });
  Mobilestatus = msg.sms_send_status;

  const emailmsg = await queryOne('affiliate', 'select email_content, email_send_status from tbl_emailaction where eid=@eid limit 1', { eid: emailEID });
  Emailstatus = emailmsg.email_send_status;

  const PLDetails = await queryOne('affiliate', 'select plid, phone, username, tpassword, emailid from portal_login where plid=@plid limit 1', { plid: Plid });
  if (PLDetails !== null) {
    if (PLDetails.phone !== null || PLDetails.phone !== '') {
      membersmsactive = await flag('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS::int=1 AND STATUS::int=1 AND REGNO=@plid limit 1', { plid: Plid });
      memberemailactive = await flag('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL::int=1 AND STATUS::int=1 AND REGNO=@plid limit 1', { plid: Plid });
      const Userid = '';
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);

      const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
      const isv = await scalar('affiliate', 'select IsVerify from MEMBER_LOGIN where REGNO=@plid limit 1', { plid: Plid });
      const IsActiveTranPass = isv === true || isv === 1 || isv === '1';
      if (IsActiveTranPass === true) {
        if (TransPass.trim() === '') {
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
        // legacy: new Thread(...).Start()
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

async function CheckSecurityForTransctiion(PaymentMode, Username, Password, OTPCODE, hfauthenticated, GAKEY, Amount, session) {
  const Plid = sessionPlid(session);
  const IsSecuritySuccess = 'success';

  if (Password === null || Password === undefined || Password === '') {
    Password = await scalar('affiliate', 'Select TPASSWORD From Portal_Login Where PLID=@plid limit 1', { plid: Plid });
    if (Password.trim() !== '') {
      Password = Decryptword(Password);
    }
  }

  if (hfauthenticated === null || hfauthenticated === undefined) {
    hfauthenticated = '0';
  }

  if (Username === '') {
    Username = await scalar('affiliate', 'select username from member_master where regno=@plid limit 1', { plid: Plid });
  }
  const membersmsactive = await flag('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS::int=1 AND STATUS::int=1 AND REGNO=@plid limit 1', { plid: Plid });
  const memberemailactive = await flag('SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL::int=1 AND STATUS::int=1 AND REGNO=@plid limit 1', { plid: Plid });
  const msg = await queryOne('affiliate', 'select sms_send_status from tbl_smsaction where id=17 limit 1');
  const emailmsg = await queryOne('affiliate', 'select email_send_status from tbl_emailaction where eid=14 limit 1');

  if (msg.sms_send_status !== 1 && membersmsactive === 1) {
    if (OTPCODE !== '') {
      if (masterCode() === OTPCODE) {
        session.SessionOTP = OTPCODE;
      }
    }
  } else if (emailmsg.email_send_status !== 1 && memberemailactive === 1) {
    if (OTPCODE !== '') {
      if (masterCode() === OTPCODE) {
        session.SessionOTP = OTPCODE;
      }
    }
  } else if (memberemailactive === 0 && membersmsactive === 0) {
    if (OTPCODE !== '') {
      if (masterCode() === OTPCODE) {
        session.SessionOTP = OTPCODE;
      }
    }
  }
  if (OTPCODE !== session.SessionOTP.toString()) {
    return 'error^You have entered wrong OTP.';
  } else if (OTPCODE === session.SessionOTP.toString() && hfauthenticated === '1') {
    if (GAKEY === '') {
      return 'GAKey';
    }
  }

  if (Username === '' || Amount <= 0) {
    return 'Invalid^Please enter the mandatory fields.';
  } else {
    const isv = await scalar('affiliate', 'select IsVerify from MEMBER_LOGIN where REGNO=@plid limit 1', { plid: Plid });
    const IsActiveTranPass = isv === true || isv === 1 || isv === '1';
    if (IsActiveTranPass === true) {
      if (Password.trim() !== '') {
        Password = Encryptword(Password);
        const PL = await queryOne('affiliate', 'select plid from portal_login where trim(tpassword)=trim(@pw) and plid=@plid limit 1', { pw: Password, plid: Plid });
        if (PL === null) {
          return 'Invalid^Wrong Transaction Password.Please try again.';
        }
      }
    }
  }
  return IsSecuritySuccess;
}

module.exports = { GenrateOTP, CheckSecurityForTransctiion };
