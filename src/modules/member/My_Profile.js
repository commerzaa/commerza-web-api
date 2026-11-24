'use strict';
// Ported from Member/Controllers/CustomerPanel/My_Profile.cs  (DB: affiliate)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../../config');
const { proc, procOne, query, queryOne, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const Security_Key = require('../../lib/member/Security_Key');
const Base32Encoder = require('../../lib/member/Base32Encoder');
const Country = require('../../lib/member/Country');
// PORT-NOTE: C# class GetCountry (DAL/Country.cs) statics are attached to the shared CountryModel only by ../../lib/Country; load it so Country.SettingVisitor / InitializeVisitorCountrySession exist.
require('../../lib/Country');

const DB = 'affiliate';
// class MemberProfile
const MemberProfile = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'Password', 'ImageName', 'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender', 'HighestQualification', 'CID', 'SID', 'CTID', 'Atc_WalletAddress', 'CityName', 'MarriageAnniversary', 'SponserName', 'ACTIVE', 'PINCODE', 'NOMINEEMNAME', 'NOMINEEMREL', 'NOMINEEDOB', 'NOMINEECONTACT', 'FACEBOOKLINK', 'maritalstatus', 'Address', 'SponsorUsername', 'Town_post', 'Qualification', 'occupation'];
const CheckForProfileUpdateDynamicProps = ['FID', 'Status', 'VALIDATIONACTIVE', 'ISEDIT'];

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const str = (v) => (v == null ? '' : String(v)); // Convert.ToString / ToStringOrEmpty
const bg = (p) => { Promise.resolve(p).catch((e) => console.error('background task failed', e && e.message)); };
async function ErrorInsert(req, ex, PROCEDURENAME) {
  try { await new DataUtility().ErrorInsert(0, ex && ex.message, PROCEDURENAME, 0, req.path); } catch (_) { /* ignore */ }
}
// Session["SessionOTP"].ToString()
function sessOtp(req) {
  const v = sessionStore.get(req, 'SessionOTP');
  if (v == null) throw NRE();
  return String(v);
}
// Convert.ToInt32(string)
const int32 = (v) => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
};
const countProfileField = async (name) => Number(await scalar(DB, 'select count(1) from TBL_DETAILSPAGEMASTERFORPROFILEUPDATION where FIELDNAME = @n and SHOWACTIVE = 1', { n: name })) || 0;
const smsAction = (id) => queryOne(DB, 'select * from tbl_smsaction where id = @id limit 1', { id });
const emailAction = (id) => queryOne(DB, 'select * from tbl_emailaction where eid = @id limit 1', { id });
const memberByRegno = (regno) => queryOne(DB, 'select * from member_master where regno = @regno limit 1', { regno });
const usernameOf = async (regno) => scalar(DB, 'SELECT USERNAME FROM MEMBER_MASTER WHERE REGNO = @regno limit 1', { regno });

// ---- the four profile pages ----------------------------------------------------------------------------------------

async function profileModel(Plid) {
  const row = await procOne(DB, 'usp_getcontactdetails', { plid: Plid });
  return row ? mapRow(row, MemberProfile) : null;
}

// Index1 / Index share the same flow (Index also checks KYC)
async function simpleIndex(req, res, withKyc) {
  const ViewBag = {};
  const Layout = '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml';
  const View = '~/Views/CustomerPanel/My_Profile/ReferralMyProfile.cshtml';
  try {
    const Plid = Number(req.user.plid);
    if (withKyc) {
      const k = await procOne(DB, 'usp_check_kyc', { plid: Plid });
      ViewBag.status = k && k.strresult != null ? String(k.strresult) : '';
    }
    const memdetails = await profileModel(Plid);
    if (memdetails != null) return res.json({ View, Layout, Model: memdetails, ViewBag });
    return res.json({ View, Layout, ViewBag });
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'USP_GETCONTACTDETAILS');
    ViewBag.Message = ExpObj.message;
    return res.json({ View, Layout, ViewBag });
  }
}

async function profilePage(req, res, kind) {
  const isReferral = kind === 'ReferralIndex';
  let PROCEDURENAME = '';
  let profile_type = req.p.profile_type;
  const ViewBag = {};
  const View = '~/Views/CustomerPanel/My_Profile/ReferralMyProfile.cshtml';
  try {
    if (str(profile_type) === '') profile_type = '';
    ViewBag.profile_type = str(profile_type);
    const Plid = Number(req.user.plid);
    let regno = 0;
    PROCEDURENAME = 'Usp_check_kyc';
    const k = await procOne(DB, 'usp_check_kyc', { plid: Plid });
    ViewBag.status = k && k.strresult != null ? String(k.strresult) : '';

    const row = await queryOne(DB, 'select regno from member_master where regno = @Plid limit 1', { Plid });
    if (row != null) regno = row.regno;
    ViewBag.pancarfDeails = '../../KYC_Images/NoImage.jpg';
    ViewBag.ProofresidencyDeails = '../../KYC_Images/NoImage.jpg';
    ViewBag.IDProofDeails = '../../KYC_Images/NoImage.jpg';
    ViewBag.photograph = '../../KYC_Images/NoImage.jpg';
    ViewBag.bank_passbook = '../../KYC_Images/NoImage.jpg';
    ViewBag.FormBackDeails = '../../KYC_Images/NoImage.jpg';
    ViewBag.OtherDeails = '../../KYC_Images/NoImage.jpg';
    const row1 = await queryOne(DB, 'select * from bank_accounts where regno = @regno and active = true limit 1', { regno });
    if (row1 != null) {
      ViewBag.acountholdername = str(row1.accountholdername);
      ViewBag.acountno = str(row1.accountno);
      ViewBag.bankname = str(row1.bankname);
      ViewBag.branchname = str(row1.branchname);
      ViewBag.ifsccode = str(row1.ifsccode);
      ViewBag.panno = str(row1.pancardno);
    }
    PROCEDURENAME = 'USP_GETCONTACTDETAILS';
    const memdetails = await profileModel(Plid);
    if (isReferral) {
      if (memdetails != null) {
        ViewBag.EmailId = memdetails.CPer_EmailID;
        ViewBag.Mobile = memdetails.Phone;
      }
      const ProfileDetails = (await query(DB, "SELECT coalesce(FIELDNAME,'') AS FIELDNAME FROM TBL_DETAILSPAGEMASTERFORPROFILEUPDATION ORDER BY DISPLAYSHOW ASC")).map((r) => r.fieldname);
      ViewBag.Details = ProfileDetails;
    }
    const Layout = isReferral ? '~/Views/Shared/_ReferralLayout.cshtml' : '~/Views/Shared/_OuterSearchLayout.cshtml';
    if (memdetails != null) return res.json({ View, Layout, Model: memdetails, ViewBag });
    return res.json({ View, Layout, ViewBag });
  } catch (ExpObj) {
    ViewBag.Message = ExpObj.message;
    await ErrorInsert(req, ExpObj, PROCEDURENAME);
    return res.json({ View, Layout: '~/Views/Shared/_ReferralLayout.cshtml', ViewBag });
  }
}

// auth (legacy: Session["Plid"] == null -> redirect Home/Index)
router.all(['/member/My_Profile/Index1{/:id}'], auth, asyncHandler((req, res) => simpleIndex(req, res, false)));
// auth
router.all(['/member/My_Profile/Index{/:id}', '/member/My_Profile'], auth, asyncHandler((req, res) => simpleIndex(req, res, true)));
// auth. route-config: urls "referral/my-profile/{profile_type}" and "referral/my-profile" -> My_Profile/ReferralIndex
router.all(['/member/My_Profile/ReferralIndex{/:profile_type}', '/member/referral/my-profile{/:profile_type}'], auth, asyncHandler((req, res) => profilePage(req, res, 'ReferralIndex')));
// auth
router.all('/member/My_Profile/CustomerIndex{/:profile_type}', auth, asyncHandler((req, res) => profilePage(req, res, 'CustomerIndex')));

// ---- bank / ifsc / newsletter -------------------------------------------------------------------------------------------

// public (proxy to the razorpay IFSC lookup)
router.all('/member/My_Profile/checkifsccode{/:id}', asyncHandler(async (req, res) => {
  try {
    const baseurl = 'https://ifsc.razorpay.com/' + str(req.p.ifsccode);
    const Result = (await axios.get(baseurl, { responseType: 'text', transformResponse: (d) => d })).data;
    return res.json(Result);
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'checkifsccode');
    return res.json(' Not Found');
  }
}));

// auth
router.all('/member/My_Profile/Insert_BankDetail{/:id}', auth, asyncHandler(async (req, res) => {
  const { HolderName, AccountNo, BankName, BranchName, IFSCCode } = req.p;
  let PanCard = req.p.PanCard;
  const Plid = Number(req.user.plid);
  if (PanCard == null) PanCard = '';
  const cid = await queryOne(DB, 'select cid from portal_login where plid = @Plid limit 1', { Plid });
  if (cid == null) throw NRE();
  const out = await procOne(DB, 'usp_insertbankdetais', {
    plid: Plid, holdername: HolderName, acountno: AccountNo, bankname: BankName, branchname: BranchName, iesccode: IFSCCode, pancard: PanCard,
  });
  const ResValue = int32(out && out.intresult != null ? String(out.intresult) : '');
  if (ResValue > 0) {
    await queryOne(DB, "SELECT coalesce(PHONE,'') AS PHONE,EMAILID,USERNAME FROM PORTAL_LOGIN WHERE PLID = @Plid limit 1", { Plid }); // legacy fetched but did not use it
    return res.json(ResValue);
  }
  return res.json(0);
}));

// public (newsletter subscription)
router.all('/member/My_Profile/insert_email_newsletter{/:id}', asyncHandler(async (req, res) => {
  const emaild = req.p.emaild;
  let Result = '';
  if (sessionStore.get(req, 'COUNTRYID') == null) {
    try {
      const sess = {};
      if (typeof Country.SettingVisitor === 'function') await Country.SettingVisitor('');
      if (typeof Country.InitializeVisitorCountrySession === 'function') await Country.InitializeVisitorCountrySession(sess);
      for (const k of Object.keys(sess)) sessionStore.set(req, k, sess[k]);
    } catch (ExpObj) {
      await ErrorInsert(req, ExpObj, 'insert_email_newsletter');
    }
  }
  const cn = sessionStore.get(req, 'COUNTRYNAME');
  if (cn == null) throw NRE();
  const CountryName = String(cn);
  const ip = sessionStore.get(req, 'IPADDRESS');
  if (ip == null) throw NRE();
  const IPAddress = String(ip);
  if (emaild == null) throw NRE(); // emaild.Trim()
  if (String(emaild).trim() !== '') {
    const out = await procOne(DB, 'usp_subscribenewsletter', { emailid: String(emaild).toLowerCase(), ipaddress: IPAddress, ipcountry: CountryName });
    Result = out && out.strresult != null ? String(out.strresult) : '';
  }
  // else: legacy built Json("Enter Email ID ") but discarded it
  return res.json(Result);
}));

// ---- mobile / email OTP update ------------------------------------------------------------------------------------------

// auth
router.all('/member/My_Profile/GenerateOTPForMobileUpdate{/:id}', auth, asyncHandler(async (req, res) => {
  const MobileNumber = req.p.MobileNumber == null ? '' : req.p.MobileNumber;
  const OTP = String(UtilityClass.RandomNumberStringByLength(4));
  sessionStore.set(req, 'SessionOTP', OTP);
  let returnmessage = 'OTP SENT';
  try {
    await emailAction(17); // EmailWLCMsg, unused
    const msg = await smsAction(21);
    const IsSMSactive = msg.sms_send_status;
    const Plid = Number(req.user.plid);
    const mm = await queryOne(DB, 'select mobile from member_master where regno = @Plid limit 1', { Plid });
    const OldMobile = mm ? mm.mobile : null;
    const Username = await usernameOf(Plid);
    const IsAuthentication = await countProfileField('Mobile Authentication');
    const IsVerification = await countProfileField('Mobile Verification');
    if (IsAuthentication !== 0 || IsVerification !== 0) {
      if ((IsAuthentication === 1 && MobileNumber !== '') || (IsVerification === 1 && MobileNumber !== '')) {
        if (IsSMSactive === 1) {
          const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(Username, msg.sms_content, '', OTP, 9);
          bg(UtilityClass.SendSMSWithAPI(OldMobile, messg, '1'));
        }
      }
    } else {
      returnmessage = 'OTP BYPASS';
    }
  } catch (ex) { /* legacy: empty catch */ }
  res.json(returnmessage);
}));

// auth
router.all('/member/My_Profile/GenerateOTPForEmailUpdate{/:id}', auth, asyncHandler(async (req, res) => {
  const EmailId = req.p.EmailId == null ? '' : req.p.EmailId;
  const OTP = String(UtilityClass.RandomNumberStringByLength(6));
  sessionStore.set(req, 'SessionOTP', OTP);
  let returnmessage = 'OTP SENT';
  try {
    const EmailWLCMsg = await emailAction(17);
    await smsAction(21); // msg, only Sms_Content/Sms_Send_Status read (unused)
    const Plid = Number(req.user.plid);
    const mm = await queryOne(DB, 'select emailid from member_master where regno = @Plid limit 1', { Plid });
    const OldEmailid = mm ? mm.emailid : null;
    const Username = await usernameOf(Plid);
    const IsEmailAuthenticated = await countProfileField('Email Authentication');
    const IsEmailVerification = await countProfileField('Email Verification');
    if (EmailWLCMsg.email_send_status === 1) {
      if (IsEmailAuthenticated !== 0 || IsEmailVerification !== 0) {
        if (IsEmailAuthenticated === 1) {
          if (EmailId !== '') {
            const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(Username, EmailWLCMsg.email_content, OldEmailid, OTP, 9, '');
            bg(UtilityClass.CallBackAddress(OldEmailid.toLowerCase(), 'Email Updation', DynamicMsg));
          }
        } else {
          returnmessage = '';
        }
      } else {
        returnmessage = 'OTP BYPASS';
      }
    } else {
      returnmessage = 'OTP BYPASS';
    }
  } catch (ex) { /* legacy: empty catch */ }
  res.json(returnmessage);
}));

// auth
router.all('/member/My_Profile/GenerateOtpForVerification{/:id}', auth, asyncHandler(async (req, res) => {
  const { Otp, MobileNumber } = req.p;
  let returnmessage = 'OTP SENT';
  try {
    const Plid = Number(req.user.plid);
    const mm = await queryOne(DB, 'select mobile from member_master where regno = @Plid limit 1', { Plid });
    const OldMobile = mm ? mm.mobile : null;
    if (MobileNumber !== OldMobile) {
      returnmessage = "Mobile Number dose't match from Registered Mobile Number ";
    } else {
      const SessonOtp = sessOtp(req);
      if (Otp === SessonOtp) {
        returnmessage = 'success';
      } else if (Otp === '') {
        returnmessage = 'Please Enter OTP';
      } else {
        returnmessage = 'You have entered wrong otp';
      }
    }
  } catch (ex) { /* legacy: empty catch */ }
  res.json(returnmessage);
}));

// auth
router.all('/member/My_Profile/MobileVerification{/:id}', auth, asyncHandler(async (req, res) => {
  const MobileNumber = req.p.MobileNumber;
  let returnmessage = '';
  try {
    const OTP = String(UtilityClass.RandomNumberStringByLength(4));
    sessionStore.set(req, 'SessionOTP', OTP);
    const Plid = Number(req.user.plid);
    await emailAction(17); // EmailWLCMsg, unused
    const msg = await smsAction(21);
    const IsSMSactive = msg.sms_send_status;
    const Username = await usernameOf(Plid);
    const IsVerification = await countProfileField('Mobile Verification');
    await countProfileField('Email Authentication'); // IsEmailAuthenticated, unused
    if (IsVerification === 1) {
      if (IsSMSactive === 1) {
        await UtilityClass.FindingSmsContentWithUserIdPassword(Username, msg.sms_content, '', OTP, 9); // messg, unused (legacy sends the fixed text below)
        const Msg = 'Dear ' + Username + ',Use this One Time Password ' + OTP + ' Verify your Mobile. Regards, CLUSTER LEVEL MARKETING';
        bg(UtilityClass.SendSMSWithAPIz(MobileNumber, Msg, '1'));
        returnmessage = 'OTP SENT';
      } else {
        returnmessage = 'OTP BYPASS';
      }
    } else {
      returnmessage = 'OTP BYPASS';
    }
  } catch (ex) { /* legacy: empty catch */ }
  res.json(returnmessage);
}));

// auth
router.all('/member/My_Profile/VerifyMobileFirstTiem{/:id}', auth, asyncHandler(async (req, res) => {
  let { MobileNo, Emailid } = req.p;
  const Otp = req.p.Otp;
  const Mode = int32(req.p.Mode);
  let intresult = '';
  if (Emailid === '') {
    Emailid = 'FirstAttemptMobile';
  } else if (MobileNo === '') {
    MobileNo = 'FristAttempEmail';
  }
  const msg = await smsAction(21);
  const EmailWLCMsg = await emailAction(17);
  if (Mode === 1) {
    if (msg.sms_send_status === 1) {
      const IsEmailAuthcation = await countProfileField('Mobile Authentication');
      const IsEmailVerificaton = await countProfileField('Mobile Verification');
      if (IsEmailAuthcation === 1 || IsEmailVerificaton === 1) {
        if (sessOtp(req) !== Otp) return res.json('You have entered wrong otp');
      }
    } else if (msg.sms_send_status === 0) {
      const ByPssOTP = '1234';
      if (ByPssOTP !== Otp) return res.json('You have entered wrong otp');
    }
  } else if (Mode === 2) {
    const IsEmailVerification = await countProfileField('Email Verification');
    if (IsEmailVerification === 1) {
      if (EmailWLCMsg.email_send_status === 1) {
        if (sessOtp(req) !== Otp) return res.json('You have entered wrong otp');
      }
    }
  }
  const Plid = Math.trunc(Number(req.user.plid));
  const out = await procOne(DB, 'usp_changemobileandemailid', { plid: Plid, mobilenumber: MobileNo, emailid: Emailid, mode: Mode });
  intresult = out && out.intresult != null ? String(out.intresult) : '';
  if (intresult === '0') intresult = 'Mobile No. AllReady Exist !';
  else if (intresult === '3') intresult = 'Email Id AllReady Exist !';
  res.json(intresult);
}));

// auth
router.all('/member/My_Profile/UpdateMobile{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MobileNumber = p.MobileNumber; const Otp = p.Otp;
  let intresult = '';
  try {
    const IsAdminAuthenticate = p.IsAdminAuthenticate == null ? 0 : int32(p.IsAdminAuthenticate);
    const IsAdminVerify = p.IsAdminVerify == null ? 0 : int32(p.IsAdminVerify);
    const Mode = p.Mode == null ? 0 : int32(p.Mode);
    const EmailId = p.EmailId == null ? '' : p.EmailId;
    const NewEmailid = p.NewEmailid == null ? '' : p.NewEmailid;
    const NewMobileNumber = p.NewMobileNumber == null ? '' : p.NewMobileNumber;
    const Plid = Number(req.user.plid);
    const mm = await queryOne(DB, 'select mobile from member_master where regno = @Plid limit 1', { Plid });
    const OldMobile = mm ? mm.mobile : null;
    const IsVerification = await countProfileField('Mobile Verification');
    const IsEmailVerification = await countProfileField('Email Verification');
    if (IsEmailVerification === 1) {
      if (EmailId !== NewEmailid) return res.json("Your new Eamil Id does't match from current Email Id");
    }
    if (IsVerification === 1) {
      if (OldMobile === NewMobileNumber) return res.json("Your new Mobile number does't match from current Mobile number");
    }
    if (IsAdminAuthenticate !== 0 || IsAdminVerify !== 0) {
      if (IsAdminAuthenticate === 0 && MobileNumber !== '' && Otp !== '') {
        if (sessOtp(req) !== Otp) return res.json('You have entered wrong otp');
      }
      if (IsAdminAuthenticate === 1 && IsAdminVerify === 0) {
        // nothing
      } else if (IsAdminAuthenticate === 0 && IsAdminVerify === 1) {
        if (sessOtp(req) !== Otp) return res.json('You have entered wrong otp');
      } else if (IsAdminAuthenticate === 1 && IsAdminVerify === 1) {
        if (Otp !== sessOtp(req)) return res.json('You have entered wrong otp');
      } else if (Otp !== sessOtp(req)) {
        return res.json('You have entered wrong otp');
      }
    }
    const out = await procOne(DB, 'usp_changemobileandemailid', { plid: Plid, mobilenumber: MobileNumber, emailid: EmailId, mode: Mode });
    intresult = out && out.intresult != null ? String(out.intresult) : '';
    if (intresult === '0') intresult = 'Mobile No. AllReady Exist !';
    else if (intresult === '3') intresult = 'Email Id AllReady Exist !';
  } catch (ex) { /* legacy: empty catch */ }
  res.json(intresult);
}));

// auth
router.all('/member/My_Profile/EamilAuthenticationVerify{/:id}', auth, asyncHandler(async (req, res) => {
  const { Otp, Emailid } = req.p;
  let returnmessage = '';
  try {
    const Plid = Number(req.user.plid);
    const mm = await queryOne(DB, 'select emailid from member_master where regno = @Plid limit 1', { Plid });
    const OldEmailid = mm ? mm.emailid : null;
    await countProfileField('Email Verification'); // IsEmailVerification, unused
    if (Emailid !== OldEmailid) {
      returnmessage = "Email Id does't macth from Registered Email Id ";
    } else {
      const EmailWLCMsg = await emailAction(17);
      if (EmailWLCMsg.email_send_status === 1) {
        const SessonOtp = sessOtp(req);
        returnmessage = Otp === SessonOtp ? 'success' : 'You have entered wrong otp';
      } else {
        returnmessage = 'OTP BYPASS';
      }
    }
  } catch (ex) { /* legacy: empty catch */ }
  res.json(returnmessage);
}));

// auth
router.all('/member/My_Profile/EamilVerification{/:id}', auth, asyncHandler(async (req, res) => {
  const Emailid = req.p.Emailid;
  let returnmessage = '';
  try {
    const OTP = String(UtilityClass.RandomNumberStringByLength(6));
    sessionStore.set(req, 'SessionOTP', OTP);
    const Plid = Number(req.user.plid);
    const EmailWLCMsg = await emailAction(17);
    const Username = await usernameOf(Plid);
    const IsEmailVerification = await countProfileField('Email Verification');
    if (IsEmailVerification === 1) {
      if (EmailWLCMsg.email_send_status === 1) {
        const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(Username, EmailWLCMsg.email_content, Emailid, OTP, 9, '');
        bg(UtilityClass.CallBackAddress(Emailid.toLowerCase(), 'Email Updation', DynamicMsg));
        returnmessage = 'OTP SENT';
      } else {
        returnmessage = 'OTP BYPASS';
      }
    } else {
      returnmessage = 'OTP BYPASS';
    }
  } catch (ex) { /* legacy: empty catch */ }
  res.json(returnmessage);
}));

// ---- profile update ----------------------------------------------------------------------------------------------------

// auth
router.all('/member/My_Profile/UserNameCheckAllReadyExists{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const out = await procOne(DB, 'usp_check_existsusernameforprofileupdate', { regno: Plid, username: req.p.Username });
  const Retrnval = out && out.retrunout != null ? String(out.retrunout) : '';
  res.json(Retrnval);
}));

async function UpdateimageDetailsCore(req, ImageName) {
  try {
    const Plid = Number(req.user.plid);
    const SavePaths = config.app.MemberImagePath || '';
    let imgname = '';
    if (ImageName.includes('base64,')) {
      imgname = str(await UtilityClass.ImageUploadMasterMethod(ImageName, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Member_profile'));
    } else {
      imgname = ImageName;
    }
    const out = await procOne(DB, 'usp_editimageprofile', { plid: Plid, imagename: imgname });
    return out && out.intresult != null ? String(out.intresult) : '';
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'UpdateimageDetails');
    return 'Some Error Occuered Sorry ' + ExpObj.message;
  }
}

// auth
router.all('/member/My_Profile/UpdateUserDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  try {
    const Title = int32(p.Title);
    const { Fname, Lname, ImageName, username, DOB, FatherOrMotherName, Gender, HighestQualification, IdType, IdRefNo, PANNO, MarriageAnniversary, Pincode, NomineeName, NomineeRelation, NomineeDOB, Address, MaritalStatus, townpost, Qualification, occupation } = p;
    const CountryId = int32(p.Country);
    const State = int32(p.State);
    let Cityname = p.Cityname;
    let CTName = p.CTName;
    const IsVerified = 0;
    if (ImageName != null && ImageName !== '') {
      await UpdateimageDetailsCore(req, ImageName); // result ignored
    }
    const Plid = Number(req.user.plid);
    let Retrnval = '';
    if (username !== '') {
      const spOut = await procOne(DB, 'usp_check_existsusernameforprofileupdate', { regno: Plid, username });
      Retrnval = spOut && spOut.retrunout != null ? String(spOut.retrunout) : '';
      if (Retrnval === '1') {
        Retrnval = '15';
        return res.json(Retrnval);
      }
    } else {
      return res.json('16');
    }
    if (Cityname === '' || Cityname === '-1') {
      Cityname = '0';
    } else {
      const ctid = int32(Cityname);
      const cities = await queryOne(DB, 'select * from city where ctid = @ctid limit 1', { ctid });
      if (CTName === '') {
        if (cities == null) throw NRE();
        CTName = cities.cityname;
      }
    }
    const out = await procOne(DB, 'usp_editcontactdetails', {
      plid: Plid, cpertitle: Title, cpermobileno: '', cperemailid: '', firstname: Fname, lastname: Lname,
      username, dob: DOB, fatherormothername: FatherOrMotherName, gender: Gender, highestqualification: HighestQualification,
      mode: '2', isverified: IsVerified, idtype: IdType, idrefno: IdRefNo, panno: PANNO, cid: CountryId, ctid: Cityname, sid: State,
      cityname: CTName, marriageanniversary: MarriageAnniversary, remark: '', eid: 0, pincode: Pincode, nominnename: NomineeName,
      nomineerelation: NomineeRelation, nomineedob: NomineeDOB, address: Address, maritalstatus: MaritalStatus,
      townpost, qualificationid: Qualification, occupation,
    });
    const ResValue = out && out.intresult != null ? String(out.intresult) : '';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(ResValue);
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'UpdateUserDetails');
    return res.json('Some Error Occuered Sorry ' + ExpObj.message);
  }
}));

// auth (legacy: Session["Plid"] == null -> "This page has been expired")
router.all('/member/My_Profile/UpdateimageDetails{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await UpdateimageDetailsCore(req, req.p.ImageName));
}));

// auth
router.all('/member/My_Profile/GetBtc{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_update_btc_profile', { plid: Plid, btcaddress: '', mode: 2 });
    if (!rows.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
    return res.json(rows[0].btcaddress);
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'GetBtc');
    return res.json('Some Error Occuered Sorry ' + ExpObj.message);
  }
}));

// auth
router.all('/member/My_Profile/UpdateBtc{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Plid = Number(req.user.plid);
    const out = await procOne(DB, 'usp_update_btc_profile', { plid: Plid, btcaddress: req.p.Btc, mode: 1 });
    return res.json(out && out.intresult != null ? String(out.intresult) : '');
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'UpdateBtc');
    return res.json('Some Error Occuered Sorry ' + ExpObj.message);
  }
}));

// public: public method returning TwoFactorSecret (MVC would expose it as an action); pure function of the input
router.all('/member/My_Profile/SecretKey{/:id}', asyncHandler(async (req, res) => {
  try {
    const enc = new Base32Encoder().Encode(Buffer.from(String(req.p.secret), 'ascii'));
    return res.json({ EncodedSecret: enc });
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'SecretKey');
    return res.json({ EncodedSecret: '' });
  }
}));

// auth
router.all('/member/My_Profile/Manage_Secutiry_Key{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Mode = req.p.Mode;
    let Sms = req.p.Sms; let GaKey = req.p.GaKey;
    const ActiveKey = int32(req.p.ActiveKey);
    if (ActiveKey === 1) GaKey = '';
    if (ActiveKey === 2) Sms = '';
    try {
      const obj = new Security_Key();
      const returnval = await obj.Manage_Security_Key(Number(req.user.plid), Mode, Sms, GaKey, ActiveKey);
      return res.json(returnval);
    } catch (ExpObj) {
      await ErrorInsert(req, ExpObj, 'Manage_Secutiry_Key');
      return res.json('error^Some error occured' + ExpObj.message);
    }
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'Manage_Secutiry_Key');
    return res.json('Some Error Occuered Sorry ' + ExpObj.message);
  }
}));

// public (profile-update field configuration, no session in legacy)
router.all('/member/My_Profile/CheckForProfileUpdateDynamic{/:id}', asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdatafoprofileupdate', { mode: 1 });
  res.json(rows.map((r) => mapRow(r, CheckForProfileUpdateDynamicProps)));
}));

// ---- Google authenticator ----------------------------------------------------------------------------------------------

// auth
router.all('/member/My_Profile/VerifyGoogleAuthentication{/:id}', auth, asyncHandler(async (req, res) => {
  const GAKey = req.p.GAKey == null ? '' : req.p.GAKey;
  let Password = req.p.Password == null ? '' : req.p.Password;
  const FACode = req.p.FACode == null ? '' : req.p.FACode;
  try {
    if (Password === '') return res.json('Please Enter Your Password');
    if (FACode === '') return res.json('Please Enter Google Authentication Key.');
    if (GAKey === '') return res.json('Please Enter 2FA Code.');
    const PLID = Number(req.user.plid);
    const validUser = await DAL_RegistrationOrLogin.checkUserDetailsByPLID(Math.trunc(PLID), UtilityClass.Encryptword(Password));
    if (validUser > 0) {
      const sGAKey = sessionStore.get(req, 'GAKey');
      const s2FA = sessionStore.get(req, '2FACode');
      if (sGAKey != null && s2FA != null) {
        if (GAKey !== '' && Password !== '' && FACode !== '') {
          if (GAKey === String(sGAKey)) {
            const objs = new Security_Key();
            Password = UtilityClass.Encryptword(Password);
            if (!(await objs.Check_GaKey(Math.trunc(PLID), String(s2FA), FACode))) {
              return res.json('Please Enter Valid 2FA Code!');
            }
            const RandomNo = String(s2FA);
            // update portal_login isemailverified status
            await DAL_RegistrationOrLogin.InsertGAKeyinTable(Math.trunc(PLID), GAKey, FACode, RandomNo);
            return res.json('SUCCESS');
          }
          return res.json('Invalid GA key!');
        }
        return res.json('Invalid Details!');
      }
      return res.json('Session Expired!');
    }
    return res.json('Invalid Password');
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'VerifyGoogleAuthentication');
    return res.json('Invalid Details!');
  }
}));

// auth
router.all('/member/My_Profile/DisableGoogleAuthentication{/:id}', auth, asyncHandler(async (req, res) => {
  const Password = req.p.Password == null ? '' : req.p.Password;
  const FACode = req.p.FACode == null ? '' : req.p.FACode;
  try {
    if (Password === '') return res.json('Please Enter Your Password');
    if (FACode === '') return res.json('Please Enter Google Authentication Key.');
    const PLID = Number(req.user.plid);
    const validUser = await DAL_RegistrationOrLogin.checkUserDetailsByPLID(Math.trunc(PLID), UtilityClass.Encryptword(Password));
    if (validUser > 0) {
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(Math.trunc(PLID));
      if (FACode !== '' && Password !== '') {
        const objs = new Security_Key();
        if (await objs.Check_GaKey(Math.trunc(PLID), ValidRandomNo, FACode)) {
          await DAL_RegistrationOrLogin.DisbaleGoogleAuthentication(Math.trunc(PLID));
          return res.json('SUCCESS');
        }
        return res.json('Incorrect FA Code');
      }
      return res.json('Invalid Details!');
    }
    return res.json('Invalid Password');
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'DisableGoogleAuthentication');
    return res.json('Invalid Details!');
  }
}));

// ---- SMS / e-mail authentication on/off -------------------------------------------------------------------------------

// auth
router.all('/member/My_Profile/GenerateOTPForOnSMS{/:id}', auth, asyncHandler(async (req, res) => {
  const IsSms = req.p.IsSms;
  const OTP = String(UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const PLDetails = await memberByRegno(Plid);
  const SMSAcitveFunctionlity = await smsAction(1054);
  if (PLDetails == null) throw NRE();
  const ActiveSmsFunmessg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, SMSAcitveFunctionlity.sms_content, '', OTP, 41);
  const IsSMSactiveFunc = SMSAcitveFunctionlity.sms_send_status;
  const SMSDeactiveFunctionlity = await smsAction(1055);
  const DeactiveSmsFuncSms = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, SMSDeactiveFunctionlity.sms_content, '', OTP, 42);
  // (PLDetails.MOBILE != null || PLDetails.MOBILE != "") is always true
  if (IsSms === '1' || IsSms === '0') {
    if (IsSms === '1') {
      if (IsSMSactiveFunc === 1) {
        returnmessage = 'OTP SENT';
        bg(UtilityClass.SendSMSWithAPI(PLDetails.mobile, ActiveSmsFunmessg, '1'));
      } else {
        returnmessage = 'OTP BYPASS';
      }
    } else if (IsSms === '0') {
      if (SMSDeactiveFunctionlity.sms_send_status === 1) {
        returnmessage = 'OTP SENT';
        bg(UtilityClass.SendSMSWithAPI(PLDetails.mobile, DeactiveSmsFuncSms, '1'));
      } else {
        returnmessage = 'OTP BYPASS';
      }
    }
  }
  res.json(returnmessage);
}));

// auth
router.all('/member/My_Profile/GenerateOTPForOnEamil{/:id}', auth, asyncHandler(async (req, res) => {
  const IsEmail = req.p.IsEmail;
  const OTP = String(UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const PLDetails = await memberByRegno(Plid);
  const EmaiActiveFunctionlity = await emailAction(1050);
  if (PLDetails == null) throw NRE();
  const ActiveEmailFunc = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, EmaiActiveFunctionlity.email_content, '', OTP, 44, '', '');
  const EmailDeactiveFunctionlity = await emailAction(1051);
  const DeactiveEmailFunc = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, EmailDeactiveFunctionlity.email_content, '', OTP, 44, '', '');
  if (IsEmail === '1' || IsEmail === '0') {
    if (IsEmail === '1') {
      if (EmaiActiveFunctionlity.email_send_status === 1) {
        returnmessage = 'OTP SENT';
        bg(UtilityClass.CallBackAddress(PLDetails.emailid.toLowerCase(), EmaiActiveFunctionlity.email_subject, ActiveEmailFunc));
      } else {
        returnmessage = 'OTP BYPASS';
      }
    } else if (IsEmail === '0') {
      if (EmailDeactiveFunctionlity.email_send_status === 1) {
        returnmessage = 'OTP SENT';
        bg(UtilityClass.CallBackAddress(PLDetails.emailid.toLowerCase(), EmailDeactiveFunctionlity.email_subject, DeactiveEmailFunc));
      } else {
        returnmessage = 'OTP BYPASS';
      }
    }
  }
  res.json(returnmessage);
}));

// auth
router.all('/member/My_Profile/MemberAuthenticationForSMS{/:id}', auth, asyncHandler(async (req, res) => {
  const { ISSMS, OTP, Password } = req.p;
  try {
    let returnmessage = '';
    const PLID = Number(req.user.plid);
    const validUser = await DAL_RegistrationOrLogin.checkUserDetailsByPLID(Math.trunc(PLID), UtilityClass.Encryptword(Password));
    if (validUser > 0) {
      const SMSAcitveFunctionlity = await smsAction(1054);
      const SMSDeactiveFunctionlity = await smsAction(1055);
      if (SMSAcitveFunctionlity.sms_send_status === 1 && ISSMS === '1') {
        if (sessOtp(req) !== OTP) return res.json('You have Enterd Wrong OTP');
      } else if (SMSDeactiveFunctionlity.sms_send_status === 1 && ISSMS === '0') {
        if (sessOtp(req) !== OTP) return res.json('You have Enterd Wrong OTP');
      }
      const out = await procOne(DB, 'usp_memberauthentication', { mode: 2, regno: PLID, issms: int32(ISSMS), isemail: 0 });
      returnmessage = out && out.stroutput != null ? String(out.stroutput) : '';
      if (returnmessage === '2' || returnmessage === '1') sessionStore.set(req, 'SessionOTP', null);
      return res.json(returnmessage);
    }
    returnmessage = 'Invalid Password';
    return res.json(returnmessage);
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'MemberAuthenticationForSMS');
    return res.json('');
  }
}));

// auth
router.all('/member/My_Profile/MemberAuthenticationForEmail{/:id}', auth, asyncHandler(async (req, res) => {
  const { ISEMAIL, OTP, Password } = req.p;
  try {
    let returnmessage = '';
    const PLID = Number(req.user.plid);
    const validUser = await DAL_RegistrationOrLogin.checkUserDetailsByPLID(Math.trunc(PLID), UtilityClass.Encryptword(Password));
    if (validUser > 0) {
      const EmaiActiveFunctionlity = await emailAction(1050);
      const EmailDeactiveFunctionlity = await emailAction(1051);
      if (EmaiActiveFunctionlity.email_send_status === 1 && ISEMAIL === '1') {
        if (sessOtp(req) !== OTP) return res.json('You have Enterd Wrong OTP');
      } else if (EmailDeactiveFunctionlity.email_send_status === 1 && ISEMAIL === '0') {
        if (sessOtp(req) !== OTP) return res.json('You have Enterd Wrong OTP');
      }
      const out = await procOne(DB, 'usp_memberauthentication', { mode: 3, regno: PLID, issms: 0, isemail: int32(ISEMAIL) });
      returnmessage = out && out.stroutput != null ? String(out.stroutput) : '';
      if (returnmessage === '2' || returnmessage === '1') sessionStore.set(req, 'SessionOTP', null);
      return res.json(returnmessage);
    }
    returnmessage = 'Invalid Password';
    return res.json(returnmessage);
  } catch (ExpObj) {
    await ErrorInsert(req, ExpObj, 'MemberAuthenticationForEmail');
    return res.json('');
  }
}));

module.exports = router;
