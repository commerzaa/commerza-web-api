'use strict';
// Port of Controllers/MemberPanelCntrl/Visitor_signInController.cs
const express = require('express');
const { query, queryOne, scalar, exec, proc, procOne } = require('../db');
const { mapRows } = require('../utils/shape');
const { signToken, auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const UtilityClass = require('../lib/UtilityClass');
const GetIP = require('../lib/GetIP');
const DAL_RegistrationOrLogin = require('../lib/DAL_RegistrationOrLogin');
const Security_Key = require('../lib/Security_Key');

const router = express.Router();

const str = (v) => (v === null || v === undefined ? '' : String(v));
/** case-insensitive column read from a PostgreSQL (lower-case) row */
const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
};
const toInt = (v) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};

/** MemberLOGINLOG (public helper in the C# controller) */
async function MemberLOGINLOG(LoginID, Password, ip, Status) {
  const r = await procOne('affiliate', 'usp_memberloginlog', {
    username: LoginID, password: Password, ipaddress: ip, status: Status,
  });
  let ReturnOutPut = '';
  if (Status === 'Failed') {
    const total = col(r, 'totalcount');
    let rem = total === null || total === undefined ? 0 : parseInt(total, 10);
    if (Number.isNaN(rem)) throw new Error('Input string was not in a correct format.');
    rem = 5 - rem;
    if (rem < 0) ReturnOutPut = '0';
    else ReturnOutPut = rem + ' Attempt Remaining';
  } else {
    ReturnOutPut = '0';
  }
  return ReturnOutPut;
}

/** SaveToken (public helper in the C# controller) */
async function SaveToken(plid, token) {
  try {
    const t = token === null || token === undefined ? '' : token;
    const d = await scalar('affiliate', 'select PN_Token from tbl_pushNotification where PN_Token = @token limit 1', { token: t });
    if (d === null || d === undefined || d === '') {
      const i = await exec('affiliate',
        'insert into tbl_pushNotification(PLID,PN_Token,CreatedOn,isActive) values(@plid,@token,now(),true)',
        { plid: str(plid), token: t });
      return i >= 1;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// public
router.post('/api/MemberSignIn', asyncHandler(async (req, res) => {
  try {
    const LoginID = req.p.LoginID;
    let Password = req.p.Password;
    // GoogleCaptcha is accepted but unused (captcha validation is commented out in the legacy code)
    Password = await UtilityClass.Encryptword(Password);
    // PORT-NOTE: legacy resolved the server host name via Dns.GetHostName/GetHostEntry (result unused) - not ported.
    const ip = await GetIP.GetLocalIP(req);
    const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip);
    let shoppingPLID = '';
    let shoppingLoginID = '';

    if (ObjLogin === null || ObjLogin === undefined) {
      await MemberLOGINLOG(LoginID, Password, ip, 'Failed');
      return res.json({ status: 'false', message: 'Login Failed! Check Username and Password' });
    }

    await MemberLOGINLOG(LoginID, Password, ip, 'Success');
    // legacy: transids is always "0" so the security key lookup always runs
    const objs = await new Security_Key().Get_Security_Key(ObjLogin.Plid);
    if (objs) {
      objs.plid = parseInt(ObjLogin.Plid, 10);
      // legacy built a "2^loginid^password" string here which was never used / returned
    }
    // legacy loaded the member menu rights into an unused local
    await proc('affiliate', 'usp_pickadminuserrights_memberpanel', { empid: 1, plid: ObjLogin.Plid });

    const data = await queryOne('shopping', 'select * from tbl_customerlogin where username = @username limit 1', { username: ObjLogin.UserName });
    if (!data) throw new Error('Object reference not set to an instance of an object.');
    shoppingPLID = str(col(data, 'clid'));
    shoppingLoginID = col(data, 'loginid');

    // user authenticates against the affiliate member table => userType 'member'
    const token = signToken({ plid: ObjLogin.Plid, userName: ObjLogin.UserName, userType: 'member', clid: col(data, 'clid') });
    return res.json({
      status: 'true',
      data: ObjLogin,
      shoppingCredential: { shoppingPLID, shoppingloginid: shoppingLoginID },
      token,
    });
  } catch (EX) {
    return res.json({ status: false, message: EX.message });
  }
}));

// public
router.post('/api/SignUpNow', asyncHandler(async (req, res) => {
  try {
    let { email, password, username, MobileNo, Sponser, VerificationCode, Cityname, FullName, GoogleCaptcha, side,
      DOB, parentid, Lastname, StateName, Otp, VerificationEmailOtp, Pincode, CouponCode, Btcaddress,
      Facebooklink, Address, pancard, MaritalStatus, fcmToken } = req.p;
    const nn = (v) => (v === undefined ? null : v);
    [email, password, username, MobileNo, Sponser, Cityname, FullName, side, DOB, parentid, Lastname, StateName,
      Pincode, CouponCode, Btcaddress, Facebooklink, Address, pancard, MaritalStatus, fcmToken] =
      [email, password, username, MobileNo, Sponser, Cityname, FullName, side, DOB, parentid, Lastname, StateName,
        Pincode, CouponCode, Btcaddress, Facebooklink, Address, pancard, MaritalStatus, fcmToken].map(nn);
    const Country = toInt(req.p.Country);
    const State = toInt(req.p.State);
    const chkreffval = toInt(req.p.chkreffval);
    const Gender = toInt(req.p.Gender);
    const Ctid = toInt(req.p.Ctid);
    const Title = toInt(req.p.Title);

    let OtpShowActive = '0';
    let EmailOtpShow = '0';
    let IsMobileVerified = 0;

    const r22 = await queryOne('affiliate', 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid = 22 limit 1');
    OtpShowActive = r22 ? str(r22.showactive) : '0';
    const r34 = await queryOne('affiliate', 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid = 34 limit 1');
    EmailOtpShow = r34 ? str(r34.showactive) : '0';
    // UserDefind (unused in legacy, query still executed)
    await scalar('affiliate', 'select typeid from tbl_user_defined where active = 1 limit 1');
    if (OtpShowActive !== '0' && MobileNo !== '') {
      IsMobileVerified = 1;
    }
    if (EmailOtpShow !== '0' && email !== '') {
      // OTP verification is commented out in the legacy code
    }
    const ip_address = await GetIP.GetLocalIP(req);
    password = await UtilityClass.Encryptword(password);

    // legacy read the "Referrelcode" cookie into an unused variable
    await DAL_RegistrationOrLogin.validate(email, username, password); // result ignored in legacy

    if (Sponser !== null && Sponser !== '') {
      const row = await procOne('affiliate', 'usp_scalerdata', { mode: 3, identity: Sponser });
      if (!row) {
        return res.json({ status: 'false', message: 'Invalid sponserID' });
      }
    }

    const currency = '';
    const IntOutPutResult = await DAL_RegistrationOrLogin.Registration(Sponser, email, password, currency, '', username,
      ip_address, MobileNo, 'referral-login', Country, State, Cityname, FullName, side, chkreffval, parentid, Gender,
      DOB, pancard, Ctid, Lastname, StateName, Pincode, CouponCode, Btcaddress, Facebooklink, Address, MaritalStatus,
      IsMobileVerified, Title);
    const Arrary = str(IntOutPutResult).split('^');
    const Result = Arrary[0];
    if (Result.toLowerCase() === 'success') {
      const a = str(IntOutPutResult).trim().split('^');
      if (a.length < 4) throw new Error('Index was outside the bounds of the array.');
      const istoken = await SaveToken(a[1], fcmToken);
      const resArr = [{ message: a[0], REGNO: a[1], username: a[2], password: a[3], istokensave: istoken }];
      // REGNO of a freshly registered member is its plid
      const token = signToken({ plid: /^\d+$/.test(a[1]) ? Number(a[1]) : a[1], userName: a[2], userType: 'member' });
      return res.json({ status: 'true', message: 'success', caredential: resArr, token });
    }
    return res.json({ status: 'false', message: Result.toString() });
  } catch (ExpObj) {
    return res.json({ status: 'false', message: 'error', _error: ExpObj.message });
  }
}));

// public
router.post('/api/GenerateOTP', asyncHandler(async (req, res) => {
  const { UserName, MobileNumber } = req.p;
  const OTP = String(await UtilityClass.RandomNumberStringByLength(4));
  let returnmessage = 'OTP SENT';

  const chk = await procOne('affiliate', 'usp_checkdynmic_mobileemailpan', { mode: 1, mobile: MobileNumber, email: '', panno: '' });
  const OutResult = str(col(chk, 'result'));
  if (OutResult !== 'success' && OutResult === 'Mobile No. Allready Exists !') {
    return res.json({ status: 'false', message: returnmessage + '^Mobile No. Already Exist!!!' });
  }
  const msg = await queryOne('affiliate', 'select * from tbl_smsaction where id = 20 limit 1');
  if (!msg) throw new Error('Object reference not set to an instance of an object.');
  const Mobilestatus = parseInt(msg.sms_send_status, 10);
  // OtpShowActive is read but unused in legacy
  await queryOne('affiliate', 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid = 22 limit 1');

  const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(UserName, msg.sms_content, UserName, OTP, 2);

  if (Mobilestatus === 1) {
    // legacy: fire-and-forget background thread
    Promise.resolve()
      .then(() => UtilityClass.SendSMSWithAPIRegistration(MobileNumber, messg, '1'))
      .catch((e) => console.error('SendSMSWithAPIRegistration failed', e.message));
    returnmessage = 'OTP SENT';
  } else {
    returnmessage = 'Please Enable for Mobile Send Status';
    return res.json({ status: 'false', message: returnmessage });
  }
  return res.json({ status: 'true', message: returnmessage, Otp: OTP });
}));

// public
router.post('/api/GetVerifySponsor', asyncHandler(async (req, res) => {
  const { SponsorID } = req.p;
  const RetMsg = 'Invalid|^';
  if (SponsorID === undefined || SponsorID === null || SponsorID === '') {
    return res.json({ status: 'false', message: 'Provide Sponsor ID' });
  }
  const RowSp = await procOne('affiliate', 'usp_scalerdata', { mode: 3, identity: SponsorID });
  if (!RowSp) {
    return res.json({ status: 'false', message: RetMsg });
  }
  const resArr = [{
    Message: 'valid',
    email: col(RowSp, 'emailid') === undefined ? null : col(RowSp, 'emailid'),
    FName: str(col(RowSp, 'fname')) + ' ' + str(col(RowSp, 'lname')) + ' ' + str(col(RowSp, 'lname')),
  }];
  return res.json({ status: 'true', data: resArr });
}));

// public
router.post('/api/AllCountryList', asyncHandler(async (req, res) => {
  const rows = await query('affiliate', 'select cid, countryname, cactive, isdcode from country where cactive = true');
  return res.json({ status: 'true', data: mapRows(rows, ['CID', 'COUNTRYNAME', 'CACTIVE', 'ISDCODE']) });
}));

// public
router.post('/api/BINDSTATEONCID', asyncHandler(async (req, res) => {
  const CID = toInt(req.p.CID);
  const rows = await query('affiliate',
    'select sid, cid, statename, scode, sactive from state where cid = @CID and sactive = true order by statename', { CID });
  return res.json(mapRows(rows, ['SID', 'CID', 'STATENAME', 'SCODE', 'SACTIVE']));
}));

// public
router.post('/api/BindCITy', asyncHandler(async (req, res) => {
  const SID = toInt(req.p.SID);
  const rows = await query('affiliate',
    'select ctid, cid, sid, cityname, active from city where sid = @SID and active = true order by cityname', { SID });
  return res.json(mapRows(rows, ['CTID', 'CID', 'SID', 'CITYNAME', 'ACTIVE']));
}));

// auth
router.post('/api/DeleteAccount', auth, asyncHandler(async (req, res) => {
  let OutputResult = '';
  try {
    const { UserName, Regno } = req.p;
    const ActiveStatus = String(req.p.ActiveStatus).toLowerCase() === 'true';
    // legacy: UtilityClass.GetDataSetSPNamed(@Regno, "dbo.usp_View_all_detail_Member")
    const rows = await proc('affiliate', 'usp_view_all_detail_member', { regno: Regno });
    const cityid = 0;

    if (rows.length > 0) {
      const d = rows[0];
      if (UserName !== str(col(d, 'USERNAME'))) {
        return res.json({ Status: false, Message: 'Invalid Action' });
      }
      const out = await procOne('affiliate', 'usp_update_basic_info_member', {
        fname: str(col(d, 'Name')),
        mobile: str(col(d, 'MOBILE')),
        emailid: str(col(d, 'EMAILID')),
        address: str(col(d, 'ADDRESS')),
        country: str(col(d, 'CID')),
        state: str(col(d, 'SID')),
        city: cityid,
        regno: Regno,
        empid: 2,
        ipaddress: '1::',
        cityname: str(col(d, 'CTID')),
        statename: str(col(d, 'STATENAME')),
        pincode: str(col(d, 'PINCODE')),
        active: ActiveStatus,
      });
      OutputResult = str(col(out, 'result'));
    } else {
      return res.json({ Status: false, Message: 'Invalid User' });
    }

    if (OutputResult === 'Success') {
      return res.json({ Status: true, Message: 'Account Deleted Successfully' });
    }
    return res.json({ Status: false, Message: OutputResult });
  } catch (ex) {
    console.error('DeleteAccount', ex.message);
    return res.json({ Status: false, Message: 'Something Went Wrong' });
  }
}));

module.exports = router;
