// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\My_Profile.cs (class My_ProfileController => /portal/My_Profile/...)
'use strict';
// Database: shopping (Db_Shopping; legacy DataBaseContext). [CheckResellerTimeout] has a commented-out body => no check.
// String parameters: see the PORT-NOTEs at the top of _shared/batch-19-common.js ("" kept, NULL passed for null, T-SQL '' => 0 for INT).
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const Security_Key = require('../../lib/portal/Security_Key');
const Base32Encoder = require('../../lib/portal/Base32Encoder');
const GetCountry = require('../../lib/portal/GetCountry');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const ps = require('./_shared/portal-session');
const {
  DB, s, nz, NRE, str, outAny, sqlInt, toInt32, requiredInt, mapPath, randomNext, bg, longDate, fillMail, checkMailAddress,
  tempDataKeep, appFolder, CompanySettings, T_PROFILE, T_BANK, InsertKYCViaCs,
} = require('./_shared/batch-19-common');

const router = express.Router();
const C = '/portal/My_Profile';

/** class MemberProfile (this file) */
const MEMBER_PROFILE = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'Password', 'ImageName',
  'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender', 'HighestQualification'];

const VIEW = '~/Views/CustomerPanel/My_Profile/ReferralMyProfile.cshtml';

/** db.Database.SqlQuery<MemberProfile>("USP_GETCONTACTDETAILS @PLID").FirstOrDefault() */
async function contactDetails(Plid) {
  const rows = await db.proc(DB, 'USP_GETCONTACTDETAILS', { PLID: Plid });
  return rows && rows[0] ? mapRow(rows[0], MEMBER_PROFILE) : null;
}
/** dbo.Usp_check_kyc @plid, @strResult out */
async function checkKyc(Plid) {
  const row = await db.procOne(DB, 'Usp_check_kyc', { plid: Plid });
  return outAny(row, 'strResult');
}
/** DBO.USP_EDITCONTACTDETAILS ... (18 params, @INTRESULT out) => INTRESULT.ToString() */
async function editContactDetails(p) {
  const row = await db.procOne(DB, 'USP_EDITCONTACTDETAILS', {
    PLID: p.PLID,
    CPERTITLE: p.CPERTITLE,
    CPERDESIGNATION: p.CPERDESIGNATION,
    CPERMOBILENO: p.CPERMOBILENO,
    CPEREMAILID: p.CPEREMAILID,
    FIRSTNAME: p.FIRSTNAME,
    LASTNAME: p.LASTNAME,
    USERNAME: p.USERNAME,
    DOB: p.DOB,
    FatherOrMotherName: p.FatherOrMotherName,
    Gender: sqlInt(p.Gender),
    HighestQualification: sqlInt(p.HighestQualification),
    Mode: sqlInt(p.Mode),
    IsVerified: sqlInt(p.IsVerified),
    IdType: p.IdType,
    IdRefNo: p.IdRefNo,
    PANNO: p.PANNO,
  });
  return outAny(row, 'INTRESULT');
}

/** protected void SendConfirmationEmail(...) (helper, not an action) */
async function SendConfirmationEmail(ToEmail, Username, Text, Title, Designation, Phoneno, Email, Fname, Lname, updateusername) {
  try {
    const subject = '' + s(CompanySettings.CompanyName) + '  Support Center';
    let mailtxt = '';
    const Date_ = longDate();
    // new MailMessage("" + CompanySettings.NoReplyMail + "", ToEmail) (only validated, never sent)
    checkMailAddress('' + s(CompanySettings.NoReplyMail) + '', 'from');
    checkMailAddress(ToEmail, 'to');
    mailtxt = T_PROFILE;
    mailtxt = fillMail(mailtxt, [
      ['$$lblupdateusername$$', updateusername], ['$$lblname$$', Username], ['$$datetime$$', Date_], ['$$lblmessage$$', Text],
      ['$$lblTitle$$', Title], ['$$lblFirstName$$', Fname], ['$$lblLastName$$', Lname], ['$$lblContact$$', Phoneno],
      ['$$lblemailid$$', Email], ['$$lbldesignation$$', Designation], ['$$CompanyName$$', CompanySettings.CompanyName],
      ['$$CompanyURL$$', CompanySettings.CompanyURL], ['$$CompanyDomain$$', CompanySettings.CompanyDomain],
      ['$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId],
    ]);
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) {
    // ViewBag.Message = exp.Message
  }
}

/** protected void SendConfirmationEmailForBankFetail(...) (helper, not an action) */
async function SendConfirmationEmailForBankFetail(ToEmail, Username, Text) {
  try {
    const subject = '' + s(CompanySettings.CompanyName) + '  Support Center';
    let mailtxt = '';
    const Date_ = longDate();
    checkMailAddress('' + s(CompanySettings.NoReplyMail) + '', 'from');
    checkMailAddress(ToEmail, 'to');
    mailtxt = T_BANK;
    mailtxt = fillMail(mailtxt, [
      ['$$lblname$$', Username], ['$$datetime$$', Date_], ['$$lblmessage$$', Text],
      ['$$CompanyName$$', CompanySettings.CompanyName], ['$$CompanyURL$$', CompanySettings.CompanyURL],
      ['$$CompanyDomain$$', CompanySettings.CompanyDomain], ['$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId],
    ]);
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) {
    // ViewBag.Message = exp.Message
  }
}

// ---------------------------------------------------------------- TwoFactorSecret SecretKey(string secret)
// public (no session use)
// PORT-NOTE: a non-ActionResult return value is written by MVC as Convert.ToString(value), i.e. the type name "TwoFactorSecret";
// the Base32 secret is computed (and discarded) exactly like the legacy action.
router.all(`${C}/SecretKey{/:id}`, asyncHandler(async (req, res) => {
  const secret = str(req.p.secret);
  if (secret === null) throw new Error('Value cannot be null.\r\nParameter name: chars'); // Encoding.ASCII.GetBytes(null)
  const enc = new Base32Encoder().Encode(Buffer.from(secret, 'ascii'));
  const obj = { EncodedSecret: enc };
  void obj;
  return res.type('text/html').send('TwoFactorSecret');
}));

// ---------------------------------------------------------------- JsonResult Manage_Secutiry_Key(string Mode, string Sms, string GaKey, int ActiveKey)
// auth (Session["Plid"] == null => Json("error^This page has been expired, Pleae login again !"))
router.all(`${C}/Manage_Secutiry_Key{/:id}`, ...ps.customerOr('error^This page has been expired, Pleae login again !'), asyncHandler(async (req, res) => {
  const Mode = str(req.p.Mode);
  let Sms = str(req.p.Sms);
  let GaKey = str(req.p.GaKey);
  const ActiveKey = requiredInt(req.p.ActiveKey, 'ActiveKey',
    'System.Web.Mvc.JsonResult Manage_Secutiry_Key(System.String, System.String, System.String, Int32)');
  if (s(Mode).toLowerCase() === 'add') {
    // (barcode cache check commented out in legacy)
  }
  if (ActiveKey === 1) GaKey = '';
  if (ActiveKey === 2) Sms = '';
  try {
    const obj = new Security_Key();
    const returnval = await obj.Manage_Security_Key(req.user.plid, Mode, Sms, GaKey, ActiveKey);
    return res.json(nz(returnval));
  } catch (Exp) {
    return res.json('error^Some error occured' + Exp.message);
  }
}));

// ---------------------------------------------------------------- ActionResult Index1()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all(`${C}/Index1{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = req.user.plid;
  const memdetails = await contactDetails(Plid); // catch => ViewBag.Message + rethrow
  return res.json({ view: VIEW, layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml', Model: memdetails });
}));

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "merchant/my-profile" -> My_Profile/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/my-profile{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = req.user.plid;
  const ViewBag = {};
  ViewBag.status = await checkKyc(Plid);
  const memdetails = await contactDetails(Plid);
  return res.json({ view: VIEW, layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml', Model: memdetails, ...ViewBag });
}));

/** shared body of ReferralIndex / CustomerIndex (identical except the layout) */
async function profileView(req, res, layout) {
  let profile_type = str(req.p.profile_type);
  if (s(profile_type) === '') profile_type = '';
  const ViewBag = {};
  ViewBag.profile_type = s(profile_type);
  const Plid = req.user.plid;
  let regno = 0;
  ViewBag.status = await checkKyc(Plid);
  const row = await db.queryOne(DB, 'select regno from member_master where plid = @Plid limit 1', { Plid });
  if (row !== null) regno = row.regno;
  ViewBag.pancarfDeails = '../../KYC_Images/NoImage.jpg';
  ViewBag.ProofresidencyDeails = '../../KYC_Images/NoImage.jpg';
  ViewBag.IDProofDeails = '../../KYC_Images/NoImage.jpg';
  ViewBag.photograph = '../../KYC_Images/NoImage.jpg';
  ViewBag.bank_passbook = '../../KYC_Images/NoImage.jpg';
  ViewBag.FormBackDeails = '../../KYC_Images/NoImage.jpg';
  ViewBag.OtherDeails = '../../KYC_Images/NoImage.jpg';
  // db._Bank_Details (DBO.bank_accounts).Where(a => a.regNo == regno && a.active == true).FirstOrDefault()
  const row1 = await db.queryOne(DB, `select accountholdername, accountno, bankname, branchname, ifsccode, pancardno
from bank_accounts where regno = @regno and active = true limit 1`, { regno });
  if (row1 !== null) {
    ViewBag.acountholdername = s(row1.accountholdername);
    ViewBag.acountno = s(row1.accountno);
    ViewBag.bankname = s(row1.bankname);
    ViewBag.branchname = s(row1.branchname);
    ViewBag.ifsccode = s(row1.ifsccode);
    ViewBag.panno = s(row1.pancardno);
  }
  const memdetails = await contactDetails(Plid);
  return res.json({ view: VIEW, layout, Model: memdetails, ...ViewBag });
}

// ---------------------------------------------------------------- ActionResult ReferralIndex(string profile_type)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/my-profile/{profile_type}" and "referral/my-profile" -> My_Profile/ReferralIndex
router.all([`${C}/ReferralIndex{/:id}`, '/portal/referral/my-profile/:profile_type', '/portal/referral/my-profile'], ps.customerAuth,
  asyncHandler((req, res) => profileView(req, res, '~/Views/Shared/_ReferralLayout.cshtml')));

// ---------------------------------------------------------------- ActionResult CustomerIndex(string profile_type)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/my-profile" (CustomerMy_Profile) is NOT registered here: RouteConfig maps the same URL earlier to
// Member_Profile/Index (CustomerMyProfile), so in legacy this entry was unreachable (user-panel-member-profile.js owns the URL).
router.all(`${C}/CustomerIndex{/:id}`, ps.customerAuth,
  asyncHandler((req, res) => profileView(req, res, '~/Views/Shared/_OuterSearchLayout.cshtml')));

// ---------------------------------------------------------------- JsonResult checkifsccode(string ifsccode)
// public (no session use)
router.all(`${C}/checkifsccode{/:id}`, asyncHandler(async (req, res) => {
  try {
    const baseurl = 'https://ifsc.razorpay.com/' + s(str(req.p.ifsccode));
    const r = await axios.get(baseurl, { responseType: 'text', transformResponse: (x) => x });
    const Result = s(r.data);
    return res.json(Result);
  } catch (Exp) {
    const error = ' Not Found';
    return res.json(error);
  }
}));

// ---------------------------------------------------------------- JsonResult insert_email_newsletter(string emaild)
// public (session: COUNTRYID / COUNTRYNAME / IPADDRESS, Session.SessionID)
router.all(`${C}/insert_email_newsletter{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const emaild = str(req.p.emaild);
  let Result = '';
  if (ps.sessionGet(req, 'COUNTRYID') === null) {
    try {
      const Sessionid = ps.getSid(req, res);
      await GetCountry.SettingVisitor(Sessionid);
      ps.initializeVisitorCountrySession(req);
    } catch (Exp) {
      // ViewBag.Message = Exp.Message
    }
  }
  const cn = ps.sessionGet(req, 'COUNTRYNAME');
  const ip = ps.sessionGet(req, 'IPADDRESS');
  if (cn === null || ip === null) throw NRE(); // Session["..."].ToString()
  const CountryName = String(cn);
  const IPAddress = String(ip);
  if (emaild === null) throw NRE(); // emaild.Trim()
  if (emaild.trim() !== '') {
    const row = await db.procOne(DB, 'USP_SUBSCRIBENEWSLETTER', { EMAILID: emaild, IPADDRESS: IPAddress, IPCOUNTRY: CountryName });
    Result = outAny(row, 'STRRESULT');
  } else {
    // Json("Enter Email ID ") - result discarded in legacy
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult ProfileVerification(string Phoneno, string Email, string R1, string R2, string IsSend)
// auth ((Login)Session["Plid"] cast without null check; uses TempData R1/R2 and Session["IsMobileUpdateProceed"])
router.all(`${C}/ProfileVerification{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Phoneno = str(req.p.Phoneno);
  const Email = str(req.p.Email);
  const R1 = str(req.p.R1);
  const R2 = str(req.p.R2);
  const IsSend = str(req.p.IsSend);
  let IsVerified = 4;
  let checkmobile = 0; let checkemail = 0;
  const Plid = req.user.plid;
  const loginid = req.user.loginid; void loginid;
  const DID = toInt32(s(config.app.DID));
  let ResValue = '';
  if (R1 !== '') {
    if (R1 !== s(ps.tempDataGet(req, 'R1'))) {
      tempDataKeep(req);
      IsVerified = 0;
      return res.json('2');
    }
    ResValue = await editContactDetails({
      PLID: Plid, CPERTITLE: '', CPERDESIGNATION: '', CPERMOBILENO: Phoneno, CPEREMAILID: '', FIRSTNAME: '', LASTNAME: '',
      USERNAME: '', DOB: '', FatherOrMotherName: '', Gender: '', HighestQualification: '', Mode: 2, IsVerified: '',
      IdType: '', IdRefNo: '', PANNO: '',
    });
    if (ResValue === '20') {
      IsVerified = 1;
      ps.sessionSet(req, 'IsMobileUpdateProceed', null);
    } else if (ResValue === '7') {
      IsVerified = 9;
    } else {
      IsVerified = 8;
    }
  }
  if (R2 !== '') {
    if (R2 !== s(ps.tempDataGet(req, 'R2'))) {
      tempDataKeep(req);
      IsVerified = 0;
      return res.json('3');
    }
    ResValue = await editContactDetails({
      PLID: Plid, CPERTITLE: '', CPERDESIGNATION: '', CPERMOBILENO: '', CPEREMAILID: Email, FIRSTNAME: '', LASTNAME: '',
      USERNAME: '', DOB: '', FatherOrMotherName: '', Gender: '', HighestQualification: '', Mode: 3, IsVerified: '',
      IdType: '', IdRefNo: '', PANNO: '',
    });
    if (ResValue === '30') {
      IsVerified = 1;
    } else if (ResValue === '6') {
      IsVerified = 11;
    } else {
      IsVerified = 8;
    }
  }
  if (R1 !== '' && R2 !== '' && IsVerified === 1) {
    IsVerified = 1;
  }
  if (IsSend === '1') {
    // #region RegionForSendOtpOdp
    if (Phoneno !== '' && Email === '') {
      // legacy concatenated PHONE='" + Phoneno + "' (parameterised here)
      checkmobile = Number(await db.scalar(DB, 'select count(1) from tbl_customerlogin where phone = @Phoneno and did = @DID', { Phoneno, DID })) || 0;
      if (checkmobile === 0) {
        const R11 = randomNext(100000, 555555);
        ps.tempDataSet(req, 'R1', R11);
        await UtilityClass.SendMsgOnMobile(Phoneno, 'Verification Code:' + R11 + ' Please Use This Verification Code For Update Your Contact No.');
        await UtilityClass.TrackOTP(Phoneno, 'Verification Code:' + R11 + ' Please Use This Verification Code For Update Your Contact No.', 'Profile Mobile No Verifications');
        IsVerified = 10;
      } else {
        IsVerified = 9;
      }
    }
    if (Email !== '' && Phoneno === '') {
      const validate_Var = await DAL_RegistrationOrLogin.validate(Email, '', '');
      if (validate_Var !== 'ok') {
        IsVerified = 13;
      } else {
        checkemail = Number(await db.scalar(DB, 'select count(1) from tbl_customerlogin where emailid = @Email and did = @DID', { Email, DID })) || 0;
        if (checkemail === 0) {
          const R21 = randomNext(666666, 999999);
          ps.tempDataSet(req, 'R2', R21);
          // PORT-NOTE: legacy background thread also set IsVerified = 12 after the mail was sent; the response had already been
          // built by then (race), so the returned value is unaffected - same here.
          bg(async () => {
            if (Email !== '') {
              await SendMail.Send1('', Email, '', '', 'Verification Code', 'Verification Code:' + R21 + ' Please Use This Verification Code For Update Your Email Id.');
              await UtilityClass.TrackCustomersEmails(Email, 'Verification Code:' + R21 + ' Please Use This Verification Code For Update Your Email Id.', 'Profile Email id Verification');
            }
          });
        } else {
          IsVerified = 11;
        }
      }
    }
    if (Email === '' && Phoneno === '') {
      IsVerified = 7;
    }
    // #endregion RegionForSendOtpOdp
  }
  return res.json(IsVerified);
}));

// ---------------------------------------------------------------- JsonResult UpdateUserDetails(int Title, string Fname, ... string UpdateId)
// auth (Session["Plid"] == null => Json("12"))
router.all(`${C}/UpdateUserDetails{/:id}`, ...ps.customerOr('12'), asyncHandler(async (req, res) => {
  const p = req.p;
  const Title = requiredInt(p.Title, 'Title', 'System.Web.Mvc.JsonResult UpdateUserDetails(Int32, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String)');
  const Fname = str(p.Fname); const Lname = str(p.Lname); let Phoneno = str(p.Phoneno); let Email = str(p.Email);
  const Designation = str(p.Designation); const ImageName = str(p.ImageName); void ImageName;
  const username = str(p.username); const DOB = str(p.DOB); const FatherOrMotherName = str(p.FatherOrMotherName);
  const Gender = str(p.Gender); const HighestQualification = str(p.HighestQualification); const IdType = str(p.IdType);
  const IdRefNo = str(p.IdRefNo); const PANNO = str(p.PANNO); const UpdateId = str(p.UpdateId);
  let IsVerified = 0;
  let Mode = 0;
  if (Phoneno === null) Phoneno = '';
  if (Email === null) Email = '';
  // (R1/R2 TempData checks commented out in legacy)
  IsVerified = 1;
  let ResValue = '';
  const Plid = req.user.plid;
  if (UpdateId === 'ProfileDetails') Mode = 1;
  ResValue = await editContactDetails({
    PLID: Plid, CPERTITLE: String(Title), CPERDESIGNATION: Designation, CPERMOBILENO: Phoneno, CPEREMAILID: Email,
    FIRSTNAME: Fname, LASTNAME: Lname, USERNAME: username, DOB, FatherOrMotherName, Gender, HighestQualification,
    Mode, IsVerified, IdType, IdRefNo, PANNO,
  });
  const rv = toInt32(ResValue);
  if (rv === 1) {
    try {
      // legacy concatenated plid = '" + Plid + "' (parameterised here)
      const Obj = await db.queryOne(DB, "select coalesce(phone, '') as phone, emailid, username from portal_login where plid = @Plid limit 1", { Plid });
      if (Obj !== null && (Obj.emailid !== '' && Obj.emailid !== null && Obj.emailid !== undefined)) {
        let title = '';
        if (Title === 1) title = 'Mr.';
        else if (Title === 2) title = 'Miss.';
        else if (Title === 3) title = 'Mrs.';
        else if (Title === 4) title = 'M/S.';
        if (rv !== 9 && rv !== 10 && rv !== 11) {
          await SendConfirmationEmail(Obj.emailid, Obj.username, 'Your profile details has been updated.', title, Designation, Phoneno, Email, Fname, Lname, username);
        }
      }
    } catch (Exp) {
      // ViewBag.Message = Exp.Message
    }
  } else if (rv === 9 || rv === 10 || rv === 11) {
    // #region RegionForSendOtpOdp
    const R11 = randomNext(100000, 555555);
    const R21 = randomNext(666666, 999999);
    ps.tempDataSet(req, 'R1', R11);
    ps.tempDataSet(req, 'R2', R21);
    bg(async () => {
      if (rv === 9 || rv === 11) {
        await SendMail.Send1('', Email, '', '', 'Verification Code', 'It is recommended to use the provided verification code for updating your mail id.Verification Code:' + R21 + ' ');
      }
      if (rv === 9 || rv === 10) {
        await UtilityClass.SendMsgOnMobile(Phoneno, 'Verification Code:' + R11 + ' Please Use This Verification Code For Update Your Contact No.');
      }
    });
    // #endregion RegionForSendOtpOdp
  }
  return res.json(ResValue);
}));

// ---------------------------------------------------------------- JsonResult UpdateimageDetails(string ImageName)
// auth (Session["Plid"] == null => Json("This page has been expired"))
router.all(`${C}/UpdateimageDetails{/:id}`, ...ps.customerOr('This page has been expired'), asyncHandler(async (req, res) => {
  const ImageName = str(req.p.ImageName);
  let ResValue = '';
  let oldimage = ''; let imgname = '';
  const Plid = req.user.plid;
  const SavePaths = appFolder('MemberImagePath');
  if (ImageName === null) throw NRE(); // ImageName.Contains(...)
  if (ImageName.includes('base64,')) {
    // db._Customer_Login (DBO.TBL_CUSTOMERLOGIN).Where(a => a.CLID == Plid).FirstOrDefault().IMAGENAME
    const cl = await db.queryOne(DB, 'select imagename from tbl_customerlogin where clid = @Plid limit 1', { Plid });
    if (cl === null) throw NRE();
    oldimage = s(cl.imagename);
    if (oldimage !== '') {
      const f = mapPath(SavePaths) + '/' + oldimage;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    imgname = s(await UtilityClass.ImageUploadMasterMethod(ImageName, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Member_profile'));
  }
  const row = await db.procOne(DB, 'USP_EDITimageprofile', { PLID: Plid, IMAGENAME: imgname });
  ResValue = outAny(row, 'INTRESULT');
  return res.json(ResValue);
}));

// ---------------------------------------------------------------- JsonResult Insert_BankDetail(string HolderName, ... string GetThisId)
// auth ((Login)Session["Plid"] cast without null check)
router.all(`${C}/Insert_BankDetail{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const HolderName = str(p.HolderName); const AccountNo = str(p.AccountNo); const BankName = str(p.BankName);
  const BranchName = str(p.BranchName); const IFSCCode = str(p.IFSCCode); const PanCard = str(p.PanCard);
  const PassBookChequeImage = str(p.PassBookChequeImage); const TypeText = str(p.TypeText); const Mode = str(p.Mode);
  const ID = str(p.ID); const GetThisId = str(p.GetThisId);
  let ResValue = 0;
  const Plid = req.user.plid;
  // KYCCheckController ObjKyc = new KYCCheckController(); ObjKyc.InsertKYCViaCs(...)
  const ok = await InsertKYCViaCs(TypeText, PassBookChequeImage, toInt32(Mode), toInt32(ID), GetThisId, Plid);
  if (ok !== 'ok') {
    return res.json(ok);
  }
  const cid = await db.queryOne(DB, 'select cid from portal_login where plid = @Plid limit 1', { Plid });
  if (cid === null) throw NRE(); // cid.CID
  const CID = toInt32(cid.cid); void CID;
  // positional "@PANCARD,@INTRESULT OUT" => the proc's 8th parameter is @STRRESULT
  const row = await db.procOne(DB, 'USP_INSERTBANKDETAIS', {
    PLID: Plid, HOLDERNAME: HolderName, ACOUNTNO: AccountNo, BANKNAME: BankName, BRANCHNAME: BranchName, IESCCODE: IFSCCode, PANCARD: PanCard,
  });
  ResValue = toInt32(outAny(row, 'STRRESULT', 'INTRESULT'));
  if (ResValue > 0) {
    const Obj = await db.queryOne(DB, "select coalesce(phone, '') as phone, emailid, username from portal_login where plid = @Plid limit 1", { Plid });
    if (Obj === null) throw NRE(); // Obj.EmailID
    await SendConfirmationEmailForBankFetail(Obj.emailid, Obj.username, 'Your bank details has been updated.');
    return res.json(ResValue);
  }
  return res.json(0);
}));

// ---------------------------------------------------------------- ActionResult ProceedToUpdateMobileNo()
// public (session optional: sets Session["IsMobileUpdateProceed"] only when logged in)
// route-config: "customer/ProceedToUpdateMobileNo" -> My_Profile/ProceedToUpdateMobileNo
router.all([`${C}/ProceedToUpdateMobileNo{/:id}`, '/portal/customer/ProceedToUpdateMobileNo'], ps.portalSession, asyncHandler(async (req, res) => {
  try {
    if (ps.isCustomer(req)) {
      const Plid = req.user.plid; void Plid;
      ps.sessionSet(req, 'IsMobileUpdateProceed', '1');
    }
    return res.json({ redirect: 'my-profile' });
  } catch (ex) {
    return res.json({ redirect: '/' });
  }
}));

module.exports = router;
