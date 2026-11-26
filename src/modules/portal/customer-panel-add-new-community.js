// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AddNewCommunity.cs (class AddNewCommunityController => /portal/AddNewCommunity/...)
'use strict';
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const GetIP = require('../../lib/portal/GetIP');
const Extension = require('../../lib/portal/Extension');
const { nullRef, mvcStr, toStr } = require('./_shared/batch-03-common');
const { view } = require('./_shared/batch-06-common');
const { mapPath, keepTempData } = require('./_shared/batch-02-common');
const { csSubstring, safeJoin, saveThumbProfileImage } = require('./_shared/batch-22-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/AddNewCommunity';

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/addcommunity" -> AddNewCommunity/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/addcommunity'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Plid = Number(req.user.plid);
  const row = await db.queryOne(DB, 'select communityside from portal_login where plid = @Plid limit 1', { Plid });
  if (row !== null) ViewBag.side = await Extension.ToIntOrZero(row.communityside);
  return view(res, '~/Views/CustomerPanel/AddNewCommunity/Index.cshtml', undefined, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult AddNewMember(...)
// public (no session check in legacy; reads Session["CountryName"] and TempData R1/R2 => ps.portalSession)
router.all(`${C}/AddNewMember{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const SponsorIDs = mvcStr(req, 'SponsorIDs'); const PlacementIDs = mvcStr(req, 'PlacementIDs'); const Side = mvcStr(req, 'Side');
  const Title = mvcStr(req, 'Title'); const UserName = mvcStr(req, 'UserName'); const FirstName = mvcStr(req, 'FirstName');
  const LastName = mvcStr(req, 'LastName'); const PhoneNo = mvcStr(req, 'PhoneNo'); const EmailIdLoginId = mvcStr(req, 'EmailIdLoginId');
  const Password = mvcStr(req, 'Password'); const Desigantion = mvcStr(req, 'Desigantion'); const ImageName = mvcStr(req, 'ImageName');
  const R1 = mvcStr(req, 'R1'); const R2 = mvcStr(req, 'R2');

  // #region RegionForSendOtpOdp
  const Result = Number(await DAL_RegistrationOrLogin.VerifyDuplicateUser(EmailIdLoginId, UserName, PhoneNo));
  if (Result === 2) return res.json('Email Id Already Exist.');
  if (Result === 5) return res.json('Username Already Exist.');
  if (Result === 6) return res.json('Mobile Already Exist.');
  if (R1 === '' && R2 === '') {
    const R11 = 100000 + Math.floor(Math.random() * (555555 - 100000)); // Generator.Next(100000, 555555)
    const R21 = 666666 + Math.floor(Math.random() * (999999 - 666666)); // Generator.Next(666666, 999999)
    ps.tempDataSet(req, 'R1', R11);
    ps.tempDataSet(req, 'R2', R21);
    // background Thread (IsBackground): mail + SMS, errors swallowed
    setImmediate(() => {
      Promise.resolve()
        .then(() => SendMail.Send1('', EmailIdLoginId, '', '', 'Verification Code', 'Verification Code:' + R21 + ' Please Use This Verification Code  For  Verify Your Mobile No. '))
        .then(() => UtilityClass.SendMsgOnMobile(PhoneNo, 'Verification Code:' + R11 + ' Please Use This Verification Code For  Verify Your Email Id.'))
        .catch((e) => console.error('[AddNewCommunity.AddNewMember otp]', e && e.message));
    });
  }
  // #endregion RegionForSendOtpOdp
  let IsVerified = 0;
  const keep = () => keepTempData(req, ['R1', 'R2']); // TempData.Keep()
  if (R1 === '' && R2 === '') { keep(); return res.json('Mobile And Email'); }
  if (R1 === '') { keep(); return res.json('Mobile'); }
  if (R2 === '') { keep(); return res.json('Email'); }
  if (R1 !== '') {
    if (R1 !== toStr(ps.tempDataGet(req, 'R1'))) {
      keep();
      IsVerified = 0;
      return res.json('13');
    }
    IsVerified = 1;
  }
  if (R2 !== '') {
    if (R2 !== toStr(ps.tempDataGet(req, 'R2'))) {
      keep();
      IsVerified = 0;
      return res.json('14');
    }
    IsVerified = 1;
  }
  if (R1 !== '' && R2 !== '' && IsVerified === 1) IsVerified = 1;

  // #region Member Image
  let imgname = '';
  if (ImageName === null) nullRef();
  if (ImageName.trim() !== '') {
    let SavePaths = '';
    let base64String = '';
    SavePaths = (config.app && config.app.MemberImagePath) || '';
    if (ImageName !== '') {
      base64String = ImageName;
      if (EmailIdLoginId === null) nullRef();
      let ProfileImage = EmailIdLoginId;
      ProfileImage = ProfileImage.trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '-' + toStr(UserName) + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = safeJoin(mapPath(SavePaths), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      csSubstring(base64String, IndexNo, lastIndexNo - IndexNo); // ImageExt
      const IndexNo1 = base64String.indexOf(',') + 1;
      const Pathlength1 = base64String.length;
      base64String = csSubstring(base64String, IndexNo1, Pathlength1 - IndexNo1);
      // > 500 KB => 300px thumbnail (JPEG), else saved as is
      await saveThumbProfileImage(base64String, strValidFullName, 500);
    } else {
      imgname = ImageName.replace(/^\/+/, '');
    }
  }
  // #endregion Member Image

  const ip_address = await GetIP.GetLocalIP(req);
  const validate_Var = await DAL_RegistrationOrLogin.validate(EmailIdLoginId, UserName, Password);
  if (validate_Var !== 'ok') return res.json(validate_Var);
  if (ps.sessionGet(req, 'CountryName') === null) return res.json('expired');
  const IntOutPutResult = Number(await DAL_RegistrationOrLogin.AddNewCommunity('', EmailIdLoginId, Password, 'Rs', toStr(ps.sessionGet(req, 'CountryName')),
    UserName, ip_address, PhoneNo, SponsorIDs, PlacementIDs, Side, Title, FirstName, LastName, Desigantion, imgname));
  if (IntOutPutResult === 1) return res.json('success');
  if (IntOutPutResult === 2) return res.json('Email Id Already Exist.');
  if (IntOutPutResult === 5) return res.json('Username Already Exist.');
  if (IntOutPutResult === 6) return res.json('Mobile Already Exist.');
  return res.json('Failed');
}));

module.exports = router;
