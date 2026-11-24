'use strict';
const DB = 'shopping';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const config = require('../../config');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const SendMail = require('../../lib/merchant/SendMail');
const CS = require('../../lib/merchant/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;
// Port of Merchant Panel Controllers/KYCCheck.cs (4 actions: Index, InsertKYCViaCs, InsertKYCViaJquery, getdetails)
const loginid = '';
const s = (v) => (v === undefined || v === null ? '' : String(v));
const rep = (t, k, v) => t.split(k).join(v === undefined || v === null ? '' : String(v));

function mailBody(Username, Text) {
  let mailtxt = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyDomain$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td>
<div class='clear'></div>
<table style='padding-bottom: 10px; width: 100%; '>
<tbody>
<tr>
<td>
<tr>
<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> KYC Documents Verification Process
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear $$lblname$$, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Thanks for Submitting your KYC documents. Your Referral Program will be working only after your KYC documents are approved by our Verification Team. </p>
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>We will process the documents and update the status within next 48hrs. Please be patience.</p>
</div>
<div style='clear: both'></div>
<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,
we will be happy to help you. You can contact us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>
</div>
</td>
</tr>
<div style = 'clear: both'></div>
<div style = 'clear: both'></div>
</td>
</tr>
<tr>
<td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>
<tbody>
<tr>
<td>
<p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>
<h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>
</td>
<td>
<div style = 'margin-right: 7px; text-align:right'>
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https:/$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
</div></td>
</tr>
</tbody>
</table></td>
</tr>
</tbody>
</table>
<div class='clear'></div>
</div>
</td>
</tr>
</tbody>
</table>
</div>
<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
  const d = new Date();
  const Date_ = String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
  mailtxt = rep(mailtxt, '$$lblname$$', Username);
  mailtxt = rep(mailtxt, '$$datetime$$', Date_);
  mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
  mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
  mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
  mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
  mailtxt = rep(mailtxt, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
  mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
  mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
  mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
  mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
  mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
  return mailtxt;
}

async function SendConfirmationEmail(ToEmail, Username, Text) {
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    const mailtxt = mailBody(Username, Text);
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) {
    console.error('KYCCheck.SendConfirmationEmail', exp.message);
  }
}

/** Shared tail of both Insert actions: send the "all 4 KYC docs" mail */
async function notifyIfComplete(Plid) {
  const row = await db.queryOne(DB, 'select emailid, username, regno from member_master where plid=@plid limit 1', { plid: Plid });
  if (row) {
    const kyc_count = Number(await db.scalar(DB, 'select count(*) from kyc_distributor where regno=@r and isaprove=0 and kyctype=1', { r: row.regno }));
    if (kyc_count === 4) await SendConfirmationEmail(row.emailid, row.username, 'Thank you accepting the referral program.');
  }
}

/** returns the saved image name ('' when no base64 image was sent) */
async function saveImage(MemberImg) {
  let ImgName = '';
  if (s(MemberImg).trim() !== '' && MemberImg.includes('base64,')) {
    const SavePaths = config.app.KYC_Images;
    const r = await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC');
    ImgName = r === undefined || r === null ? '' : String(r);
  }
  return ImgName;
}
function removeTemp() {
  // legacy deleted Server.MapPath(KYC_Images)/<random name> which never matched the saved file name; nothing is saved before the failure point
}

// auth
router.all('/merchant/KYCCheck/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const out = {
    PancardDeails: '/images/uploadkyc.png',
    IDProofDeails: '/images/uploadkyc.png',
    Photograph: '/images/uploadkyc.png',
    Bank_Passbook: '/images/uploadkyc.png',
    PancardMessage: '', PancardApprovalStatus: 0,
    PhotographMessage: '', PhotographApprovalStatus: 0,
    IDProofMessage: '', IDProofApprovalStatus: 0,
    Bank_PassbookMessage: '', Bank_PassbookApprovalStatus: 0,
    PancardImageMessage: 'Image Not Uploaded',
    PhotographImageMessage: 'Image Not Uploaded',
    IDProofImageMessage: 'Image Not Uploaded',
    Bank_PassbookImageMessage: 'Image Not Uploaded',
  };
  const Plid = req.user.plid;
  const row = await db.queryOne(DB, 'select * from bank_accounts where regno=@p and active=true limit 1', { p: Plid });
  if (row) {
    out.AcountHolderName = s(row.accountholdername);
    out.Acountno = s(row.accountno);
    out.Bankname = s(row.bankname);
    out.Branchname = s(row.branchname);
    out.IFSCCode = s(row.ifsccode);
    out.Panno = s(row.pancardno);
  }
  if (out.Panno === undefined || out.Panno === null || out.Panno === '') {
    const pn = await db.scalar(DB, 'Select PANNO From PORTAL_LOGIN Where PLID=@p limit 1', { p: Plid });
    out.Panno = pn === undefined ? null : pn;
  }
  const f = await db.queryOne(DB, "Select to_char(DOB,'MM-DD-YYYY') As DOB,IdType,IdRefNo From Portal_Login Where PLID=@p limit 1", { p: Plid });
  if (f) {
    out.DOB = f.dob;
    out.IdType = f.idtype;
    out.IdRefNo = f.idrefno;
  }
  res.json(out);
}));

// Core of InsertKYCViaCs / InsertKYCViaJquery up to the USP_INSERTKYC call
async function insertKyc(Plid, GetThis, MemberImg, Id, Mode) {
  const ImgName = await saveImage(MemberImg);
  const r = await db.procOne(DB, 'usp_insertkyc', { PLID: Plid, TYPE: GetThis, Image: ImgName, Id, MODE: Mode });
  return (r && r.strresult !== undefined && r.strresult !== null ? String(r.strresult) : '').toLowerCase();
}

// auth
router.all('/merchant/KYCCheck/InsertKYCViaCs{/:id}', auth, asyncHandler(async (req, res) => {
  const { Typetext, MemberImg, Get_This } = req.p;
  const Mode = parseInt(req.p.Mode, 10);
  const Id = parseInt(req.p.Id, 10);
  const Plid = Number(req.p.Plid);
  let ret = '';
  try {
    ret = await insertKyc(Plid, Get_This, MemberImg, Id, Mode);
    await notifyIfComplete(Plid);
  } catch (Exp) {
    removeTemp();
    return res.send(Exp.message);
  }
  return res.send(ret);
}));

// auth
router.all('/merchant/KYCCheck/InsertKYCViaJquery{/:id}', auth, asyncHandler(async (req, res) => {
  const { Typetext, MemberImg, GetThisId, FirstValue, SecondValue } = req.p;
  const Mode = parseInt(req.p.Mode, 10);
  const Id = parseInt(req.p.Id, 10);
  const Plid = req.user.plid;
  let ret = '';
  try {
    ret = await insertKyc(Plid, GetThisId, MemberImg, Id, Mode);
    if (String(ret) === 'ok') {
      if (Typetext === 'Pancard-Details' || Typetext === 'IDProof') {
        const r = await db.procOne(DB, 'usp_editcontactdetails', {
          PLID: Plid, CPERTITLE: '', CPERDESIGNATION: '', CPERMOBILENO: '', CPEREMAILID: '', FIRSTNAME: '', LASTNAME: '',
          USERNAME: '', DOB: (Typetext === 'Pancard-Details' ? s(SecondValue) : ''), FatherOrMotherName: '', Gender: '',
          HighestQualification: '', Mode: '0', IsVerified: '', IdType: (Typetext === 'IDProof' ? s(FirstValue) : ''),
          IdRefNo: (Typetext === 'IDProof' ? s(SecondValue) : ''), PANNO: (Typetext === 'Pancard-Details' ? s(FirstValue) : ''),
        });
        const ResValue = r && r.intresult !== undefined && r.intresult !== null ? String(r.intresult) : '';
        if (ResValue === '3') ret = ResValue;
      }
    }
    await notifyIfComplete(Plid);
  } catch (Exp) {
    removeTemp();
    return res.json(Exp.message);
  }
  return res.json(ret);
}));

// auth
router.all('/merchant/KYCCheck/getdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const newid = parseInt(req.p.newid, 10);
  const rows = await db.query(DB, 'SELECT ID,REGNO,TYPE,IMAGE FROM KYC WHERE KYCTYPE=1 AND ID=@id', { id: newid });
  res.json(mapRows(rows, ['id', 'Regno', 'Type', 'Image']));
}));

module.exports = router;
