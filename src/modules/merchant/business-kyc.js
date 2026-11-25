'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Business_KYC.cs (Business_KYCController)
 * Actions: Index, InsertKYCViaJquery, getdetails, GetBankDetailsPincode, SaveBankDetails (5). DB: 'shopping'
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const SendMail = require('../../lib/merchant/SendMail');
const CS = require('../../lib/merchant/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;

const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const rep = (str, k, v) => str.split(k).join(s(v));
const pad2 = (n) => String(n).padStart(2, '0');
const todayDMY = () => { const d = new Date(); return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; };
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); };
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const toInt = (v) => { const n = parseInt(v, 10); if (Number.isNaN(n)) throw new Error('Invalid integer parameter'); return n; };

// CommonController.updatemerchantkyc (public static, not an MVC action; inlined, identical to Merchant CommonController.cs)
async function updatemerchantkyc(plid) {
  const id = Number(plid);
  const countkyc = Number(await db.scalar(DB, 'Select count(1) from kyc where isaprove = 0 and regno = @id', { id })) || 0;
  const countbankverifyied = Number(await db.scalar(DB, 'Select count(1) from bank_accounts_merchant where plid = @id and active = true and isaprove = 0', { id })) || 0;
  const et = await db.scalar(DB, 'Select distinct entitytype from tbl_businesskycdetails where plid = @id limit 1', { id });
  const Entitype = et === null || et === undefined ? 0 : Number(et);
  if (Entitype === 1 && countkyc === 2 && countbankverifyied === 1) {
    await db.exec(DB, 'Update portal_login set iskycapproved = 3 where plid = @id and active = true', { id });
    return 1;
  }
  if (Entitype === 3 && countkyc === 6 && countbankverifyied === 1) {
    await db.exec(DB, 'Update portal_login set iskycapproved = 3 where plid = @id and active = true', { id });
    return 1;
  }
  return 0;
}

// protected void SendConfirmationEmail(...) - not routed
async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    let mailtxt = '';
    const Date_ = todayDMY();
    if (send === 0) {
      mailtxt = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
<link href='http://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Business KYC Verification Process
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear Sir/ Ma’am, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Thanks for Submitting your Business KYC. </p>
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>We will process the documents and update the status within two working days. Please keep patience.</p>
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
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'http://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a  href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'http://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'http://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'http://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'http://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
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
<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2017-2018 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$$CompanyDomain$$', CompanySettings.CompanyDomain); // legacy typo ($$$) kept
      mailtxt = rep(mailtxt, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
      mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
      mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
      mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
      mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    console.error(exp.message);
  }
}

// route-config: merchant/businesskyc -> Index
// auth
router.all(['/merchant/Business_KYC/Index{/:id}', '/merchant/businesskyc'], auth, asyncHandler(async (req, res) => {
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
  const Plid = Number(req.user.plid);
  const act = await db.scalar(DB, 'select iskycapproved from PORTAL_LOGIN where plid = @plid LIMIT 1', { plid: Math.trunc(Plid) });
  ViewBag.Active = act === null || act === undefined ? 0 : Number(act);
  const BANK = ['ACID', 'PLID', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ACTIVE', 'DTM_DATE', 'DTM_UPDATE_DATE', 'PancardNo',
    'Cancelled_Cheque_img', 'Address', 'State', 'City', 'KYCTYPE', 'ISAPROVE', 'CommentorRemark'];
  const ObjBank_Master = mapRows(await db.query(DB, 'SELECT * FROM BANK_ACCOUNTS_MERCHANT WHERE PLID=@plid AND ACTIVE=true', { plid: Plid }), BANK);
  const ObjBusinessKycDetails = mapRows(await db.query(DB,
    "Select to_char(DOI,'MM-DD-YYYY') As DOI,PANNO,EntityType,Type From Tbl_BusinessKycDetails Where PLID=@plid", { plid: Plid }), ['EntityType', 'PANNO', 'DOI', 'Type']);
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
}));

// auth
router.all('/merchant/Business_KYC/InsertKYCViaJquery{/:id}', auth, asyncHandler(async (req, res) => {
  const { Typetext, MemberImg, GetThisId, FirstValue, SecondValue, EntityType, AddressType, AddressTypeNumber } = req.p;
  const Mode = toInt(req.p.Mode);
  const Id = toInt(req.p.Id);
  let ret = '';
  let result = 0;
  const Plid = Number(req.user.plid);
  const ViewBag = {};
  try {
    let ImgName = '';
    if (MemberImg === undefined || MemberImg === null) throw NRE();
    if (String(MemberImg).trim() !== '' && String(MemberImg).includes('base64,')) {
      const SavePaths = String(config.app.KYC_Images || 'KYC_Images');
      ImgName = String(await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC') || '');
    } else {
      ImgName = MemberImg;
      ImgName = String(ImgName).split('/KYC_Images/').join('');
    }
    // PORT-NOTE: legacy strValidFullName (a random, never-created file under KYC_Images) is only deleted in the catch; nothing to clean up here.
    const pan = s(FirstValue);
    const COUNTPAN = Number(await db.scalar(DB, 'Select 1 From Tbl_BusinessKycDetails Where PANNO = @pan AND Type = @type AND PLID <> @plid LIMIT 1', { pan, type: s(Typetext), plid: Plid })) || 0;
    const COUNTPAN1 = Number(await db.scalar(DB, 'Select 1 From Tbl_BusinessKycDetails Where PANNO = @pan AND Type <> @type LIMIT 1', { pan, type: s(Typetext) })) || 0;
    if (FirstValue !== '') {
      if (COUNTPAN === 1 || COUNTPAN1 === 1) {
        ret = 'Already Exist';
        return res.json(ret);
      }
    }
    const r = await db.procOne(DB, 'usp_insertkyc', { plid: Plid, type: GetThisId, image: ImgName, id: Id, mode: Mode, kyctype: 2, addresstype: AddressType, addresstypenumber: AddressTypeNumber });
    // PORT-NOTE: @STRRESULT OUT is read from the 'strresult' column of the result row
    ret = s(r ? r.strresult : '').toLowerCase();
    if (ret === 'ok' && FirstValue !== '') {
      const o = await db.procOne(DB, 'usp_updatebusinesskycdetails', { plid: Plid, entitytype: EntityType, panno: FirstValue, doi: SecondValue, type: Typetext });
      const ResValue = s(o ? o.intresult : '');
      if (ResValue === '3') { ret = 'Already Exist'; return res.json(ret); }
      if (ResValue === '1') { ret = 'Insert'; return res.json(ret); }
      if (ResValue === '2') { ret = 'Update'; return res.json(ret); }
    }
    let emailid = '', mobile = '';
    const username = '';
    const row = await db.queryOne(DB, 'SELECT emailid, phone FROM portal_login WHERE plid = @plid LIMIT 1', { plid: Plid });
    result = await updatemerchantkyc(Plid);
    if (row) {
      emailid = row.emailid;
      mobile = row.phone;
      if (result === 1) {
        await SendConfirmationEmail(emailid, username, 'Thanks For Uploading Business KYC.');
        bg(() => UtilityClass.SendMsgOnMobile(mobile, 'Dear Sir/ Ma\u2019m \r\n Thanks for Submitting your Business KYC. \r\n ' + CompanySettings.CompanyName + ' Team '));
      }
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
    return res.json(Exp.message);
  }
  return res.json({ ret, result });
}));

// auth (legacy had no session check, but it reads KYC rows - acts on logged-in merchant data)
router.all('/merchant/Business_KYC/getdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const newid = toInt(req.p.newid);
  const rows = await db.query(DB, 'SELECT ID,REGNO,TYPE,IMAGE FROM KYC WHERE KYCTYPE=2 AND ID=@newid', { newid });
  res.json(mapRows(rows, ['ID', 'REGNO', 'TYPE', 'IMAGE']));
}));

// auth
router.all('/merchant/Business_KYC/GetBankDetailsPincode{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Baseurl = `https://ifsc.razorpay.com/${req.p.IFSCCODE}`;
    const r = await axios.get(Baseurl, { responseType: 'text', transformResponse: (d) => d });
    res.json(r.data);
  } catch (Ex) {
    res.json('Not Found');
  }
}));

// auth
router.all('/merchant/Business_KYC/SaveBankDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const { Name, BranchName, AccountNo, Ifsccode, BankName, Cancelled_Cheque_img, Address, state, city } = req.p;
  const EntityType = toInt(req.p.EntityType);
  let ret = '';
  let result = 0;
  let imgname = '';
  const Plid = Number(req.user.plid);
  const SavePaths = String(config.app.KYC_Images || 'KYC_Images');
  if (Cancelled_Cheque_img === undefined || Cancelled_Cheque_img === null) throw NRE();
  if (String(Cancelled_Cheque_img).includes('base64,')) {
    imgname = String(await UtilityClass.ImageUploadMasterMethod(Cancelled_Cheque_img, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'Kyc_Images') || '');
  } else {
    imgname = String(Cancelled_Cheque_img).split('/KYC_Images/').join('');
  }
  const r = await db.procOne(DB, 'usp_insertbankdetaismerchant', {
    plid: Plid, holdername: Name, acountno: AccountNo, bankname: BankName, branchname: BranchName, iesccode: Ifsccode,
    pancardno: Ifsccode, address: Address, state, city, cancelled_cheque_img: imgname, kyctype: EntityType,
  });
  // PORT-NOTE: @INTRESULT OUT is read from the 'intresult' column of the result row
  ret = s(r ? r.intresult : '').toLowerCase();
  if (ret === '2') {
    let emailid = '', mobile = '';
    const username = '';
    const row = await db.queryOne(DB, 'SELECT emailid, phone FROM portal_login WHERE plid = @plid LIMIT 1', { plid: Plid });
    result = await updatemerchantkyc(Plid);
    if (result === 1) {
      if (row) {
        emailid = row.emailid;
        mobile = row.phone;
        await SendConfirmationEmail(emailid, username, 'Thanks For Uploading Business KYC.');
        bg(() => UtilityClass.SendMsgOnMobile(mobile, 'Dear Sir/ Ma\u2019m \r\n Thanks for Submitting your Business KYC. \r\n ' + CompanySettings.CompanyName + ' Team '));
      }
    }
  }
  res.json({ ret, result });
}));

module.exports = router;
