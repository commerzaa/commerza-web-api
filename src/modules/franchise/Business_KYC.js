'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\Business_KYC.cs (Business_KYCController)
 * Actions: Index, InsertKYCViaJquery, getdetails, GetBankDetailsPincode, SaveBankDetails (5)
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const SendMail = require('../../lib/franchise/SendMail');
const CS = require('../../lib/franchise/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const pad2 = (n) => String(n).padStart(2, '0');
const todayDMY = () => { const d = new Date(); return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; };
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); };

// CommonController.updatemerchantkyc (static, inlined: lib owner of CommonController not guaranteed)
async function updatemerchantkyc(plid) {
  let result = 0;
  const countkyc = Number(await db.scalar(DB, 'Select count(distinct 1) from KYC_DISTRIBUTOR where IsAprove=0 and Regno=@plid', { plid })) || 0;
  const countbankverifyied = Number(await db.scalar(DB, 'Select count(1) from BANK_ACCOUNTS_DISTRIBUTOR where DID=@plid and ACTIVE=1 and ISAPROVE=0', { plid })) || 0;
  const Entitype = Number(await db.scalar(DB, 'Select distinct EntityType from Tbl_BusinessKycDetails_DISTRIBUTOR where DID=@plid LIMIT 1', { plid })) || 0;
  if (Entitype === 1 && countkyc === 2 && countbankverifyied === 1) {
    await db.exec(DB, 'Update TBL_DISTRIBUTOR set iskycapproved=2 where DID=@plid and ACTIVE=1', { plid });
    result = 1;
  } else if (Entitype === 3 && countkyc === 6 && countbankverifyied === 1) {
    await db.exec(DB, 'Update TBL_DISTRIBUTOR set iskycapproved=2 where DID=@plid and ACTIVE=1', { plid });
    result = 1;
  } else {
    result = 0;
  }
  return result;
}

async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = `${CompanySettings.CompanyName} Reseller Kyc Submission Notification.`;
    const Date_ = todayDMY();
    if (send === 0) {
      const ic = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;';
      let mailtxt = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>
<link href='http://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center' style='background:#2d2a24'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='$$CompanyResellerurl$$/images/dealsinvicta-8.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
<td align='center'><strong style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Business KYC Verification Process
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear Reseller, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> Thanks for Submitting your Business KYC. </p>
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'>We will process the documents and update the status within two working days. Please keep patience.</p>
</div>
<div style='clear: both'></div>
<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,
we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailID$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailID$$ </a></p>
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
<a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyResellerurl$$/images/mailer-facebook.png'  style = '${ic}'> </a>

<a href = 'javascript:void(0)' style = 'color:#55acee; ${ic}' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyResellerurl$$/images/mailer-twitter.png' style = '${ic}'></a>

<a href = 'javascript:void(0)' style = 'color:#dd4b39; ${ic}' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyResellerurl$$/images/mailer-gplus.png'  style = '${ic}'> </a>

<a href = 'javascript:void(0)' style = 'color: #0072a4; ${ic}' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyResellerurl$$/images/mailer-linkeden.jpg'  style = '${ic}'></a>

<a href = 'javascript:void(0)' style = 'color:#cb2027; ${ic}' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyResellerurl$$/images/mailer-pintrest.png'  style = '${ic} '></a>
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
<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2019-2020 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
      mailtxt = rep(mailtxt, '$$CompanyResellerurl$$', CompanySettings.CompanyResellerURL);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    console.error(exp.message);
  }
}

// auth
const indexHandler = asyncHandler(async (req, res) => {
  const ViewBag = {};
  const up = '/images/uploadkyc.png';
  ViewBag.PancardDeails = up;
  ViewBag.AddressProofDeails = up;
  ViewBag.CompanyPancardDeails = up;
  ViewBag.Deed = up;
  ViewBag.PartnerShipDeed = up;
  ViewBag.MemorandumOfAssociation = up;
  ViewBag.IncorporationCertificate = up;
  ViewBag.Bankimage = up;
  ViewBag.CompanyAddressProofDeails = up;
  ViewBag.PancardMessage = ''; ViewBag.PancardApprovalStatus = 0;
  ViewBag.AddressProofMessage = ''; ViewBag.AddressProofApprovalStatus = 0;
  ViewBag.DeedMessage = ''; ViewBag.DeedApprovalStatus = 0;
  ViewBag.PartnerShipDeedMessage = ''; ViewBag.PartnerShipDeedApprovalStatus = 0;
  ViewBag.MemorandumOfAssociationMessage = ''; ViewBag.MemorandumOfAssociationApprovalStatus = 0;
  ViewBag.IncorporationCertificateMessage = ''; ViewBag.IncorporationCertificateApprovalStatus = 0;
  ViewBag.BankProofMessage = ''; ViewBag.BankProofApprovalStatus = 0;
  ViewBag.PancardImageMessage = 'Image Not Uploaded';
  ViewBag.AddressProofImageMessage = 'Image Not Uploaded';
  ViewBag.DeedImageMessage = 'Image Not Uploaded';
  ViewBag.PartnerShipDeedImageMessage = 'Image Not Uploaded';
  ViewBag.MemorandumOfAssociationImageMessage = 'Image Not Uploaded';
  ViewBag.IncorporationCertificateImageMessage = 'Image Not Uploaded';
  ViewBag.BankImageMessage = 'Image Not Uploaded';
  ViewBag.CompanyAddressProofImageMessage = 'Image Not Uploaded';
  ViewBag.CompanyPancardImageMessage = 'Image Not Uploaded';
  const Plid = req.user.did;
  ViewBag.EntityType = 0;
  const ObjBank_Master = await db.query(DB, 'SELECT * FROM BANK_ACCOUNTS_MERCHANT WHERE DID=@plid AND ACTIVE=true', { plid: Plid });
  const ObjBusinessKycDetails = mapRows(await db.query(DB,
    "Select to_char(DOI,'MM-DD-YYYY') As DOI,PANNO,EntityType,Type From Tbl_BusinessKycDetails_DISTRIBUTOR Where DID=@plid", { plid: Plid }), ['EntityType', 'PANNO', 'DOI', 'Type']);
  for (const row of ObjBusinessKycDetails) {
    if (row && row.Type === 'Pancard-Details') {
      ViewBag.DOI = row.DOI;
      ViewBag.PanNo = row.PANNO;
      ViewBag.EntityType = row.EntityType;
    }
    if (row && row.Type === 'Company-Pancard-Details') {
      ViewBag.CompanyDOI = row.DOI;
      ViewBag.CompanyPanNo = row.PANNO;
    }
  }
  ViewBag.ObjBank_Master = ObjBank_Master;
  res.json(ViewBag);
});
router.all('/franchise/Business_KYC/Index{/:id}', auth, indexHandler);
// route-config
router.all('/franchise/franchisee/business-kyc', auth, indexHandler);

// auth
router.all('/franchise/Business_KYC/InsertKYCViaJquery{/:id}', auth, asyncHandler(async (req, res) => {
  const { Typetext, MemberImg, GetThisId, FirstValue, SecondValue, EntityType, AddressType, AddressTypeNumber } = req.p;
  const Mode = parseInt(req.p.Mode, 10);
  const Id = parseInt(req.p.Id, 10);
  let ret = '';
  let result = 0;
  const Plid = req.user.did;
  const ViewBag = {};
  try {
    let ImgName = '';
    if (String(MemberImg).trim() !== '' && String(MemberImg).includes('base64,')) {
      const SavePaths = String(config.app.KYC_Images || 'KYC_Images');
      ImgName = String(await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC') || '');
    } else {
      ImgName = MemberImg;
      ImgName = String(ImgName).split('/KYC_Images/').join('');
    }
    const r = await db.procOne(DB, 'USP_INSERTKYC_reseller', { PLID: Plid, TYPE: GetThisId, Image: ImgName, Id, MODE: Mode, KYCTYPE: 2, AddressType, AddressTypeNumber });
    ret = String(r ? r.strresult : '').toLowerCase();
    if (ret === 'ok' && FirstValue !== '') {
      const o = await db.procOne(DB, 'USP_UPDATEBUSINESSKYCDETAILS_reseller', { PLID: Plid, EntityType, PANNO: FirstValue, DOI: SecondValue, Type: Typetext });
      const ResValue = String(o ? o.intresult : '');
      if (ResValue === '3') { ret = 'Already Exist'; return res.json(ret); }
      if (ResValue === '1') { ret = 'Insert'; return res.json(ret); }
      if (ResValue === '2') { ret = 'Update'; return res.json(ret); }
    }
    let emailid = '', mobile = '';
    const username = '';
    const row = await db.queryOne(DB, 'SELECT emailid, phone FROM portal_login WHERE did=@plid LIMIT 1', { plid: Plid });
    result = await updatemerchantkyc(Plid);
    if (row) {
      emailid = row.emailid;
      mobile = row.phone;
      if (result === 1) {
        await SendConfirmationEmail(emailid, username, 'Thanks For Uploading Business KYC.');
        bg(() => UtilityClass.SendMsgOnMobile(mobile, `Dear Reseller, \r\nThank you for submitting your Business KYC. \r\nThe ${CompanySettings.CompanyName} Team`));
      }
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
    return res.json(Exp.message);
  }
  return res.json({ ret, result });
}));

// auth
router.all('/franchise/Business_KYC/getdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const newid = parseInt(req.p.newid, 10);
  const rows = await db.query(DB, 'SELECT ID,REGNO,TYPE,IMAGE FROM KYC_DISTRIBUTOR WHERE KYCTYPE=2 AND ID=@newid', { newid });
  res.json(mapRows(rows, ['ID', 'REGNO', 'TYPE', 'IMAGE']));
}));

// auth
router.all('/franchise/Business_KYC/GetBankDetailsPincode{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Baseurl = `https://ifsc.razorpay.com/${req.p.IFSCCODE}`;
    const r = await axios.get(Baseurl, { responseType: 'text', transformResponse: (d) => d });
    res.json(r.data);
  } catch (Ex) {
    res.json('Not Found');
  }
}));

// auth
router.all('/franchise/Business_KYC/SaveBankDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const { Name, BranchName, AccountNo, Ifsccode, BankName, Cancelled_Cheque_img, Address, state, city } = req.p;
  const EntityType = parseInt(req.p.EntityType, 10);
  let ret = '';
  let result = 0;
  let imgname = '';
  const Plid = req.user.did;
  const SavePaths = String(config.app.KYC_Images || 'KYC_Images');
  if (String(Cancelled_Cheque_img).includes('base64,')) {
    imgname = String(await UtilityClass.ImageUploadMasterMethod(Cancelled_Cheque_img, SavePaths, SavePaths, UtilityClass.ImageMode.Thumbnail, 'Kyc_Images') || '');
  } else {
    imgname = String(Cancelled_Cheque_img).split('/KYC_Images/').join('');
  }
  const r = await db.procOne(DB, 'USP_INSERTBANKDETAIS_reseller', { PLID: Plid, HOLDERNAME: Name, ACOUNTNO: AccountNo, BANKNAME: BankName, BRANCHNAME: BranchName, IESCCODE: Ifsccode, Address, state, city, Cancelled_Cheque_img: imgname, Kyctype: EntityType });
  ret = String(r ? r.intresult : '').toLowerCase();
  if (ret === '2') {
    let emailid = '', mobile = '';
    const username = '';
    const row = await db.queryOne(DB, 'SELECT emailid, phone FROM portal_login WHERE did=@plid LIMIT 1', { plid: Plid });
    result = await updatemerchantkyc(Plid);
    if (result === 1) {
      if (row) {
        emailid = row.emailid;
        mobile = row.phone;
        await SendConfirmationEmail(emailid, username, 'Thanks For Uploading Business KYC.');
        bg(() => UtilityClass.SendMsgOnMobile(mobile, `Dear Reseller, \r\n Thank you for submitting your business KYC. \r\nThe ${CompanySettings.CompanyName} Team `));
      }
    }
  }
  res.json({ ret, result });
}));

module.exports = router;
