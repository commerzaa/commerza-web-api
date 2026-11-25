'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\MakePaymentForPackageController.cs
 * Actions: Index, Success, Failure, ProceedToPayment, Generatehash512, Generatetxnid (6)
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const SendMail = require('../../lib/franchise/SendMail');
const CS = require('../../lib/franchise/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const pad2 = (n) => String(n).padStart(2, '0');
const todayDMY = () => { const d = new Date(); return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; };
const num2 = (v) => Number(v || 0).toFixed(2);
const esc = (s) => String(s === null || s === undefined ? '' : s);

function Generatehash512(text) {
  return crypto.createHash('sha512').update(Buffer.from(text, 'utf8')).digest('hex');
}
function Generatetxnid() {
  const strHash = Generatehash512(String(Math.random()) + new Date().toString());
  return strHash.substring(0, 20);
}

function remotePostHtml(url, inputs, method = 'post', formName = 'form1') {
  let h = '<html><head>';
  h += `</head><body onload="document.${formName}.submit()">`;
  h += `<form name="${formName}" method="${method}" action="${url}" >`;
  for (const [k, v] of inputs) h += `<input name="${k}" type="hidden" value="${v}">`;
  h += '</form>';
  h += '</body></html>';
  return h;
}

function ProceedToPayment(OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId) {
  const Key = String(config.app.MERCHANT_KEY || '');
  const Salt = String(config.app.SALT || '');
  const inputs = [];
  const url = String(config.app.PAYU_URL || '');
  inputs.push(['key', Key]);
  inputs.push(['txnid', OrderId]);
  inputs.push(['amount', esc(Amount)]);
  inputs.push(['productinfo', ProductInfo]);
  inputs.push(['firstname', UserName]);
  inputs.push(['phone', PhoneNo]);
  inputs.push(['email', EmailId]);
  inputs.push(['surl', `https://${CompanySettings.CompanyURL}/merchant/payment-successful`]);
  inputs.push(['furl', `https://${CompanySettings.CompanyURL}/merchant/transection-failure`]);
  inputs.push(['service_provider', 'payu_paisa']);
  const hashString = `${Key}|${OrderId}|${Amount}|${ProductInfo}|${UserName}|${EmailId}|||||||||||${Salt}`;
  inputs.push(['hash', Generatehash512(hashString)]);
  return remotePostHtml(url, inputs);
}

async function SendConfirmationEmail(req, ToEmail, Username, Text, Orderid, AllPackageNames) {
  let send = 0;
  let TASMID = 0;
  try {
    const Regno = req.user.did;
    let InvoiceStructure = '';
    const row = await db.queryOne(DB, 'SELECT tasmid FROM Tbl_AllSubscriptionMaster WHERE Transaction_id=@oid LIMIT 1', { oid: Orderid });
    if (row) TASMID = row.tasmid;
    const InvoicePrintLi = await db.proc(DB, 'USP_USERINVOICE', { PLID: Regno, SFDID: TASMID });
    InvoiceStructure = `

  <style>
        .invoice-box {
            max-width: 800px;
            margin: auto;
            padding: 20px;
            border: 1px solid #eee;
            box-shadow: 0 0 10px rgba(0, 0, 0, .15);
            font-size: 14px;
            line-height: 24px;
        }

        .divTable {
            font-family: Roboto;
        }
    </style>
<table border='0' cellspacing='0'  cellpadding='0'  style='font-family:Arial, Helvetica, sans-serif; font-size:12px; border-top:1px solid #ddd; margin-top:30px;'>
  <tr>
    <td style=' border-bottom:1px solid #ddd; font-weight:bold; border-right:1px solid #ddd;  border-left:1px solid #ddd; padding:8px; width:50px;'>S No. </td>
    <td style=' border-bottom:1px solid #ddd; font-weight:bold; border-right:1px solid #ddd; padding:8px; width:200px; text-align:left;'>Description of Work </td>
    <td style=' border-bottom:1px solid #ddd; font-weight:bold;  border-right:1px solid #ddd; padding:8px; width:80px; '>Amount (£) </td>
  </tr>`;
    for (const Item of InvoicePrintLi) {
      const PackageType = String(Item.allpackagetype).split('~');
      const PackageName = String(Item.allpackagename).split(',');
      const PackageAmount = String(Item.allpackageamount).split('~');
      const PackageId = String(Item.allpackageid).split('~');
      for (let i = 0; i < PackageType.length; i++) {
        InvoiceStructure += `<tr><td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; border-left:1px solid #ddd; padding:8px;vertical-align:top;'> ${i + 1}</td>`;
        let Query = '';
        if (PackageType[i] === '1') {
          Query = await db.scalar(DB, 'Select SubscriptionDetails From Tbl_SubscriptionMaster Where TSMID=@id LIMIT 1', { id: PackageId[i] });
        }
        InvoiceStructure += `<td style=' border-bottom:1px solid #ddd;line-height:20px;vertical-align:top;  border-right:1px solid #ddd; padding:8px; text-align:left;'>${PackageName[i]} <br/>`;
        InvoiceStructure += `${Query === null || Query === undefined ? '' : Query}</td>`;
        InvoiceStructure += `<td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>${PackageAmount[i]} </td></tr>`;
      }
      InvoiceStructure += ` <tr>
    <td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd;border-left:1px solid #ddd; padding:8px;'>&nbsp;</td>
    <td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; padding:8px; text-align:left;'>Thank you for giving us the opportunity to provide you the

services</td>
    <td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>&nbsp;</td>
  </tr>
  <tr>
    <td >&nbsp;</td>
    <td>Subtotal</td>
    <td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>${num2(Item.with_out_tax_amount)}</td></tr>`;
      InvoiceStructure += `<tr>
    <td >&nbsp;</td>
    <td>Service tax  ${num2(Item.service_tax_per)}% </td><td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>${num2(Item.service_tax)}</td></tr>`;
      InvoiceStructure += `<tr><td>&nbsp;</td><td><strong>Total Amount </strong></td><td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>${num2(Item.totalpayableamount)}</td> </tr><tr>   <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr> <tr><td>&nbsp;</td> <td>&nbsp;</td><td>&nbsp;</td></tr> <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>`;
    }

    const subject = `${CompanySettings.CompanyName} Support Center`;
    const Date_ = todayDMY();
    if (send === 0) {
      const icon = "border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;";
      let mailtxt = `<div class='invoice-box' style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; text-align:center; padding-bottom:10px;'>
  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>

    <table cellpadding='0' cellspacing='0' style='width: 100%'>
      <tbody>
        <tr>
          <td><table style='width:100%;'>
              <tbody>
                <tr>
                  <td colspan='2'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'></a></td>
                </tr>
              </tbody>
            </table></td>
        </tr>
        <tr>
          <td><div>
              <div class='clear'></div>
              <table style='padding-bottom: 10px;   width: 100%; '>
                <tbody>
                  <tr>
                    <td><h1 style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #000'></h1>
                      <strong style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000; padding-top:'>Subscription Acknowledgment Order ID $$lblOrderid$$</strong>
                      <p style='text-align:left; margin-bottom:0px;'>Dear $$lblname$$,</p>
                      <p style='font-size: 14px; font-weight: normal; text-align:left; line-height:20px; margin:10px 0px 20px 0px; color: #000'> Thank you for choosing $$AllPackageName$$ as your subscription pack. Your order has been submitted to the accounts department. Once it will be approved/ rejected, it will be notified to you within 24hrs.</p>

                      <div style='clear: both'></div>
                      <div style='clear: both'></div>

                      <div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top:0px'>${InvoiceStructure}<center>
                          <img src='http://webwebmail.mlmkabila.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'>
                        </center>
                      </div>
                      <div style='clear: both'></div>

<div style='margin-right: 7px; text-align:left; border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
<h5 style = 'margin:0; font-size:18px; font-weight:normal; padding-bottom:5px;'> Need Support ?</h5>
<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif,

Helvetica, sans-serif; color: #000'>
If you have any issues,
we will be happy to help you.You can contact us on <a href = 'mailto:$$CompanySupportEmailID$$' target = '_blank'

style = 'color:#00a0a8;'> $$CompanySupportEmailID$$ </a>

</p>

</div>

<div style = 'clear: both'></div>

</td>

</tr>

<tr>

<td>

<table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>

<tbody>

<tr>

<td>

<p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>

<h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>

</td>

<td>

<div style = 'margin-right: 7px; text-align:right'>

<a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png' style = '${icon}'> </a>

<a href = 'javascript:void(0)' style = 'color:#55acee; ${icon}' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = '${icon}'></a>

<a href = 'javascript:void(0)' style = 'color:#dd4b39; ${icon}' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png' style = '${icon}'> </a>

<a href = 'javascript:void(0)' style = 'color: #0072a4; ${icon}' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg' style = '${icon}'></a>

<a href = 'javascript:void(0)' style = 'color:#cb2027; ${icon}' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png' style = '${icon} '></a>

</div>

</td>

</tr>

</tbody>

</table>

</td>

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
        <p style = 'font-family:arial; font-size:14px; padding-top:10px;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>
    </div>
`;
      mailtxt = rep(mailtxt, '$$AllPackageName$$', AllPackageNames);
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$lblOrderid$$', Orderid);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    console.error(exp.message);
  }
}

// auth
router.all('/franchise/MakePaymentForPackage/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const ObjOnlinePaymentForPackage = sessionStore.get(req, 'PaymentForOrder');
  if (ObjOnlinePaymentForPackage) {
    const RegNo = parseInt(req.user.did, 10);
    const OrderId = Generatetxnid();
    const ObjUserMaster = await db.queryOne(DB, 'SELECT FNAME,PHONE,EMAILID FROM PORTAL_LOGIN Where PLID=@plid LIMIT 1', { plid: RegNo });
    const ProductInfo = ObjOnlinePaymentForPackage.AllPackageName;
    const UserName = ObjUserMaster.fname, PhoneNo = ObjUserMaster.phone, EmailId = ObjUserMaster.emailid;
    let Amount = Number(ObjOnlinePaymentForPackage.TotalPayableAmount);
    Amount = Amount + ((Amount * 15) / 100); // Service Charge
    Amount = Amount + ((Amount * 1) / 100); // Processing Fee
    return res.type('html').send(ProceedToPayment(OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId));
  }
  return res.json({});
}));

// auth
router.all('/franchise/MakePaymentForPackage/Success{/:id}', auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const o = sessionStore.get(req, 'PaymentForOrder');
  if (o) {
    let ReturnOutput = 'success';
    const RegNo = parseInt(req.user.did, 10);
    const { TotalPayableAmount, PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, ReferenceNumber, TransactionPassword, GoogleAuthenticationCode, WalletId, AllPackageId, AllPackageType, AllPackageAmount, AllPackageName } = o;
    try {
      const loginid = String(req.user.loginid);
      let Imgchallen = '';
      if (String(ChallanImage).trim() !== '') {
        let base64String = ChallanImage;
        let ChallenImage = `${loginid}&${RegNo}&${ReferenceNumber}`;
        ChallenImage = ChallenImage.trim();
        ChallenImage = ChallenImage.split('&amp;').join('And');
        ChallenImage = ChallenImage.split('&').join(' And ');
        ChallenImage = ChallenImage.replace(/[^\w\d]/g, '');
        ChallenImage = ChallenImage.split(' ').join('-');
        Imgchallen = `${ChallenImage}-${RegNo}${ReferenceNumber}.jpg`;
        const SavePaths = String(config.app.ChallenImagePath || 'Challan');
        const dir = path.join(config.uploadDir, SavePaths.replace(/^[~\/\\]+/, ''));
        fs.mkdirSync(dir, { recursive: true });
        const full = path.join(dir, Imgchallen);
        if (base64String.includes('base64,')) base64String = base64String.substring(base64String.indexOf(',') + 1);
        const b = Buffer.from(base64String, 'base64');
        if (fs.existsSync(full)) fs.unlinkSync(full);
        // PORT-NOTE: legacy halved the image dimensions (System.Drawing thumbnail) when the file was > 10KB; the decoded image is saved as-is.
        fs.writeFileSync(full, b);
      }
      const Plid = req.user.did;
      const r = await db.procOne(DB, 'Usp_AllSubscriptionMaster', {
        TotalPayableAmount, PaymentMode, ModeName, CommentORRemark, RegNo, ImageName: Imgchallen, BankName, BranchName, ReferenceDate, ReferenceNumber, WalletId, TransactionPassword, GoogleAuthenticationCode, AllPackageId, AllPackageType, AllPackageAmount, PLID: Plid, AllPackageName, ProcessingFee: '0.00',
      });
      ReturnOutput = r ? String(r.intresult) : 'null';
      const Orderid = r ? String(r.tranids) : '';
      if (parseInt(ReturnOutput, 10) > 0) {
        try {
          const AllPackageNames = String(AllPackageName).split('~').join(',');
          const Obj = await db.queryOne(DB, "Select coalesce(Phone,'') As Phone,EmailID,UserName From Portal_Login where plid = @plid LIMIT 1", { plid: Plid });
          if (Obj && (Obj.emailid !== '' || Obj.emailid !== null)) {
            const Message = `Dear ${Obj.username},\r\nThanks for Purchasing ${AllPackageNames} subscription.\r\nYour Order will be confirmed once your payment gets approved from our account department.\r\nPlease note your subscription order id is ${Orderid}`;
            if (Obj.phone !== null && Obj.phone !== '') {
              await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
              // admin notification SMS (MobileNo 9718355334) was commented out in legacy
            }
            await SendConfirmationEmail(req, Obj.emailid, Obj.username, 'Thank you for purchasing subscription. Your request is sent to Admin for verification.', Orderid, AllPackageNames);
          }
        } catch (Ex) {
          ViewBag.Message = Ex.message;
        }
      }
    } catch (Exp) {
      ViewBag.Message = Exp.message;
      ReturnOutput = `Some Exception Occur : ${Exp.message}`;
    }
    ViewBag.Message = ReturnOutput;
  } else {
    ViewBag.Message = 'Your Payment Rejected';
  }
  res.json(ViewBag);
}));

// auth
router.all('/franchise/MakePaymentForPackage/Failure{/:id}', auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'PaymentForOrder', null);
  res.json({});
}));

// auth
router.all('/franchise/MakePaymentForPackage/ProceedToPayment{/:id}', auth, asyncHandler(async (req, res) => {
  const { OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId } = req.p;
  res.type('html').send(ProceedToPayment(OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId));
}));

// auth
router.all('/franchise/MakePaymentForPackage/Generatehash512{/:id}', auth, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatehash512(String(req.p.text === undefined ? '' : req.p.text)));
}));

// auth
router.all('/franchise/MakePaymentForPackage/Generatetxnid{/:id}', auth, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatetxnid());
}));

module.exports = router;
