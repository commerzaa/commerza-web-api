'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Change_Password_by_Admin.cs (class Change_Password_by_AdminController => /admin/Change_Password_by_Admin/...)
// Database: affiliate (Db_Affiliate).
const os = require('os');
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { s, col, str } = require('./_shared/batch04-a-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Change_Password_by_Admin';

const NRE = () => new Error('Object reference not set to an instance of an object.');
const cs = (v) => (v === null || v === undefined ? '' : String(v)); // C# string concatenation of null => ""

/** USP_GETPASSWORDDETAILS @MODE,@REGNO  (SqlQuery<string>().FirstOrDefault()) */
async function getPasswordDetails(MODE, REGNO) {
  const rows = await db.proc(DB, 'USP_GETPASSWORDDETAILS', { MODE, REGNO });
  if (!rows.length) return null;
  const v = Object.values(rows[0])[0];
  return v === undefined ? null : v;
}

/** Dns.GetHostEntry(Dns.GetHostName()).AddressList[0] */
function hostAddress() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const a of ifs[name] || []) if (!a.internal) return a.address;
  }
  return '127.0.0.1';
}

// ---------------------------------------------------------------- private void history(double Plid, OldPassword, NewPassword, ConfirmPassword, Status, Type, usrenname, getselectedval)
async function history(req, Plid, OldPassword, NewPassword, ConfirmPassword, Status, Type, usrenname) {
  if (Status === '1') Status = 'success';
  else Status = 'Failed';
  const ipAddress = hostAddress();
  const host = req.hostname || '';
  const IAddress = host.toLowerCase() === 'localhost' ? ipAddress : '67.225.214.45';
  const url = `http://freegeoip.net/json/${IAddress}`;
  try {
    const r = await axios.get(url, { responseType: 'text', transformResponse: (x) => x });
    const location = JSON.parse(r.data);
    sessionStore.set(req, 'Latitude', location.latitude === undefined ? null : location.latitude);
    sessionStore.set(req, 'longitude', location.longitude === undefined ? null : location.longitude);
  } catch (ex) { /* swallowed like the legacy empty catch */ }
  if (sessionStore.get(req, 'Latitude') === undefined) sessionStore.set(req, 'Latitude', '');
  if (sessionStore.get(req, 'longitude') === undefined) sessionStore.set(req, 'longitude', '');
  await db.proc(DB, 'USP_ChangePasswordHistory', {
    PLID: Plid, UserName: usrenname, OldPassword, Newpassword: NewPassword, ConfirmPassword, IPAddress: IAddress,
    LATITUDE: sessionStore.get(req, 'Latitude'), LONGITUDE: sessionStore.get(req, 'longitude'), Type, Status,
  });
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index()
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Change-Password-by-Admin" -> Change_Password_by_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Change-Password-by-Admin{/:id}'], adminAuth, (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Change_Password_by_Admin/Index.cshtml' });
});

// ---------------------------------------------------------------- JsonResult Getusernamepassword(string memberid)
// auth (no session check in legacy; returns DECRYPTED member passwords => protected)
router.all(`/admin/${C}/Getusernamepassword{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberid = s(req.p.memberid);
  let getval = 'Invalid';
  try {
    // Db._Member_Master.Where(a => a.userName == memberid).FirstOrDefault()
    const Row = await db.queryOne(DB, 'select * from member_master where username = @memberid limit 1', { memberid });
    if (Row) {
      const regNo = col(Row, 'regno');
      const Password = await getPasswordDetails(1, regNo);
      const TPassword = await getPasswordDetails(2, regNo);
      getval = cs(regNo) + '^' + (cs(col(Row, 'fname')) + ' ' + cs(col(Row, 'lname'))) + '^' + cs(await UtilityClass.Decryptword(Password)) + '^'
        + cs(await UtilityClass.Decryptword(TPassword)) + '^' + cs(col(Row, 'emailid')) + '^' + cs(col(Row, 'mobile'));
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Getusernamepassword');
    getval = 'Invalid' + ExpObj.message;
  }
  return res.json(getval);
}));

// ---------------------------------------------------------------- JsonResult ChangePassword(long getRegNo, string getselectedval, string newpass, string username)
// auth (no session check in legacy; changes a member password => protected)
router.all(`/admin/${C}/ChangePassword{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rawReg = req.p.getRegNo;
  if (rawReg === undefined || rawReg === null || rawReg === '' || !/^[-+]?\d+$/.test(String(rawReg).trim())) {
    const e = new Error("The parameters dictionary contains a null entry for parameter 'getRegNo' of non-nullable type 'System.Int64'");
    e.status = 500; throw e;
  }
  const getRegNo = Number(String(rawReg).trim());
  const getselectedval = s(req.p.getselectedval);
  let newpass = s(req.p.newpass);
  const username = s(req.p.username);
  let resValue = '';
  let ret = 'ok';
  if (getselectedval === null) throw NRE(); // getselectedval.Trim()
  if (getselectedval.trim() === '' || getselectedval.trim() === '0') return res.json('Select Password type');
  // PORT-NOTE: MVC binds "" as null, so the legacy `newpass == ""` test never matched; kept.
  if (newpass === '') return res.json('Password cannot be left blank.');
  newpass = await UtilityClass.Encryptword(newpass);
  try {
    const Row = await db.queryOne(DB, 'select * from member_master where regno = @getRegNo limit 1', { getRegNo });
    const ConfirmPassord = newpass;
    let OldPasswordOrTransactPassword = '';
    const change = async (pwMode, procMode) => {
      OldPasswordOrTransactPassword = await getPasswordDetails(pwMode, getRegNo);
      try {
        // DBO.USP_CONTACTPASSWORDCHANGE @PLID,@OLDPASS,@NEWPASS,@CONFPASS,@INTRESULT OUT,@Mode
        const row = await db.procOne(DB, 'USP_CONTACTPASSWORDCHANGE', {
          PLID: getRegNo, OLDPASS: OldPasswordOrTransactPassword, NEWPASS: newpass, CONFPASS: ConfirmPassord, Mode: procMode,
        });
        resValue = str(col(row, 'intresult'));
      } catch (Exp) {
        await errorInsert(req, Exp, 'USP_CONTACTPASSWORDCHANGE');
        resValue = 'error^Some Error Occured.Please Try Again';
      }
    };
    if (Row && getselectedval === '1') await change(1, '1');
    else if (Row && getselectedval === '2') await change(2, 2);

    if (!/^[-+]?\d+$/.test(resValue.trim())) throw new Error('Input string was not in a correct format.'); // Convert.ToInt32(resValue)
    const result = parseInt(resValue.trim(), 10);
    resValue = String(result);
    if (result > 0) {
      ret = 'ok';
      newpass = await UtilityClass.Decryptword(newpass);
      if (result > 0) {
        const EmailContenForKycApprove = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 1049 limit 1', {});
        const ChangedPassword = await db.queryOne(DB, 'select * from tbl_smsaction where id = 1053 limit 1', {});
        if (!ChangedPassword || !EmailContenForKycApprove) throw NRE();
        const ChangedMessage = await UtilityClass.FindingSmsContentWithUserIdPassword(username, col(ChangedPassword, 'sms_content'), '', newpass, 40, 0, 0, '',
          '', 0, 0, newpass, getselectedval);
        const EmailSubject = col(EmailContenForKycApprove, 'email_subject');
        const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(username, col(EmailContenForKycApprove, 'email_content'), '', newpass, 43,
          newpass, '', 0, 0, '', '', 0, 0, 0, getselectedval);
        if (Number(col(EmailContenForKycApprove, 'email_send_status')) === 1) {
          // new Thread(...).Start() => fire-and-forget
          (async () => {
            const em = col(Row, 'emailid');
            if (em === null || em === undefined) throw NRE();
            await UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', String(em).toLowerCase(), EmailSubject, DynamicMsg, null);
          })().catch((e) => console.error('[Change_Password_by_Admin] mail thread:', e.message));
        }
        if (Number(col(ChangedPassword, 'sms_send_status')) === 1) {
          (async () => { await UtilityClass.SendSMSWithAPI(col(Row, 'mobile'), ChangedMessage, '1'); })()
            .catch((e) => console.error('[Change_Password_by_Admin] sms thread:', e.message));
        }
      }
      let PasswordType = '';
      const Statuspass = getselectedval;
      if (Statuspass === '1') PasswordType = 'LoginPassword';
      else PasswordType = 'TransactionPassword';
      await history(req, Number(col(Row, 'regno')), OldPasswordOrTransactPassword, newpass, ConfirmPassord, resValue, PasswordType, username, getselectedval);
    } else {
      ret = 'Error occurred. Please try later';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'ChangePassword');
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

module.exports = router;
