'use strict';
/**
 * Helpers private to admin port batch06: the shared body of the "Debit_*" admin JsonResult actions
 * (Debit_Clowd.DebitClowd, Debit_Coin.DebitCoin, Debit_Commission.DebitCommission, Debit_Fund.DebitFunds, DebitIncomeWallet.DebitFunds).
 * Exports: validateDebit(Username, Amount, Id), gaCheck(empId, GAKEY), memberByUserName(Username), smsAction(id), emailAction(eid),
 *          need(obj), fireSms(Frommsg, MemberDetails, Frommessg), fireEmail(emailmsg, MemberDetails, DynamicMsg)
 */
const db = require('../../../db');
const { mapRow } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../../lib/admin/Admin_Security_Key');
const { nullRef } = require('./batch06-common');

const DB = 'affiliate';

/** The three leading validations (MVC binds "" as null, so `Username == ""` only matches a literal "" which never arrives - kept). */
function validateDebit(Username, Amount, Id) {
  if (Username === '') return 'Error^Username cannot be left blank.';
  if (Amount <= 0) return 'Error^Amount should be a non negative number.';
  if (Id <= 0) return 'Error^Some error occured.Try typing username again.';
  return null;
}

/** "Authencation for google starts here" block. Returns the error JSON string or null to continue. */
async function gaCheck(empId, GAKEY) {
  let IsGoogleAuthenticated = '';
  const gaObj = await new Admin_Security_Key().Get_Security_Key(empId);
  if (gaObj !== null && gaObj !== undefined) {
    IsGoogleAuthenticated = '1';
    if (GAKEY === '') return 'Error^Enter your GA Key.';
  } else {
    IsGoogleAuthenticated = '0';
  }
  if (IsGoogleAuthenticated !== '0') {
    const objs = await new Admin_Security_Key().Get_Security_Key(empId);
    if (objs !== null && objs !== undefined) {
      const ValidRandomNo = await objs.Get_GA_Key(empId);
      if (!(await objs.Check_GaKeyForEnableTime(empId, ValidRandomNo, GAKEY))) {
        if (GAKEY !== '') return 'Error^Invalid GA Key. Please enter a valid GA Key.';
      }
    }
  }
  return null;
}

/** Db._Member_Master.Where(a => a.userName == Username).FirstOrDefault() */
async function memberByUserName(Username) {
  const r = await db.queryOne(DB, 'select * from member_master where username = @Username limit 1', { Username });
  return r ? mapRow(r, ['regNo', 'userName', 'Emailid', 'mobile', 'FName', 'MName', 'LName', 'LoginId']) : null;
}
/** Db._TBL_SMSACTION.Where(a => a.ID == id).FirstOrDefault() */
async function smsAction(id) {
  const r = await db.queryOne(DB, 'select * from tbl_smsaction where id = @id limit 1', { id });
  return r ? mapRow(r, ['ID', 'ModuleId', 'Action_Name', 'Sms_Content', 'Action_Status', 'Sms_Send_Status', 'SMSCategory', 'TemplateID']) : null;
}
/** Db._tbl_emailaction.Where(a => a.EID == eid).FirstOrDefault() */
async function emailAction(eid) {
  const r = await db.queryOne(DB, 'select * from tbl_emailaction where eid = @eid limit 1', { eid });
  return r ? mapRow(r, ['EID', 'Action_Name', 'Email_Content', 'Action_Status', 'Email_Or_SMS', 'Api_Status', 'AutoRemainderType',
    'Email_Send_To', 'Email_Send_Status', 'IsEmailActive', 'Email_Subject', 'EmailCategory']) : null;
}
/** member access on a possibly-null EF entity => NullReferenceException like the legacy code */
function need(obj) {
  if (obj === null || obj === undefined) throw nullRef();
  return obj;
}

/** if (Frommsg.SMSCategory == "Transfer") if (Frommsg.Sms_Send_Status == 1) new Thread(() => SendSMSWithAPI(MemberDetails.mobile, Frommessg, "1")).Start(); */
function fireSms(Frommsg, MemberDetails, Frommessg) {
  if (need(Frommsg).SMSCategory === 'Transfer') {
    if (Number(Frommsg.Sms_Send_Status) === 1) {
      Promise.resolve()
        .then(() => UtilityClass.SendSMSWithAPI(need(MemberDetails).mobile, Frommessg, '1'))
        .catch((e) => console.error('[admin] SendSMSWithAPI thread failed:', e.message));
    }
  }
}
/** if (emailmsg.Email_Send_Status == 1) new Thread(() => SendEmailByApiSetting(MemberDetails.userName,"","","","","",Emailid.ToLower(),subject,msg,null)).Start(); */
function fireEmail(emailmsg, MemberDetails, DynamicMsg) {
  if (Number(need(emailmsg).Email_Send_Status) === 1) {
    const fileUploader = null;
    Promise.resolve()
      .then(() => {
        const m = need(MemberDetails);
        return UtilityClass.SendEmailByApiSetting(m.userName, '', '', '', '', '', String(need(m.Emailid)).toLowerCase(), emailmsg.Email_Subject, DynamicMsg, fileUploader);
      })
      .catch((e) => console.error('[admin] SendEmailByApiSetting thread failed:', e.message));
  }
}

module.exports = { validateDebit, gaCheck, memberByUserName, smsAction, emailAction, need, fireSms, fireEmail };
