'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const config = require('../../config');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const SendMail = require('../../lib/franchise/SendMail');
const BlockChainAPI = require('../../lib/franchise/BlockChainAPI');
const CS = require('../../lib/franchise/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;
// Port of Franchise\Controllers\CustomerPanel\SubscribeUs.cs (5 actions: Index, PurchaseKitOrPackage, GetPoundToBitcoinConvertor, PayByPayYouMoney, SaveChallanImage)
// (friendly route merchant/subscribe-us is commented out in RouteConfig.cs)
// PORT-NOTE: stored procs with OUT params (@IntResult, @TranIds) return them as columns "intresult"/"tranids" of the first row.
// PORT-NOTE: System.Drawing re-encoding of the challan image is not available; decoded image bytes are written unchanged.
const s = (v) => (v === undefined || v === null ? '' : String(v));
const rep = (t, k, v) => t.split(k).join(v === undefined || v === null ? '' : String(v));

const KitMaster = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME', 'BINARYINCOME', 'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const EmailPackMaster = ['TEPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'ST', 'TotalAmount', 'NoOfEmail', 'NoOfDaysValidity'];
const SmsPackMaster = ['TSPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfSMS', 'NoOfDaysValidity'];
const SubscriptionMaster = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail', 'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price', 'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable'];
const WhatsUpPackMaster = ['TWUPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfMessages', 'NoOfDaysValidity'];
const TrafficBoosterPackMaster = ['TTBID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfHits', 'NoOfDaysValidity'];
const InvoicePrint = ['AllPackageType', 'AllPackageName', 'AllPackageAmount', 'AllPackageId', 'With_out_tax_Amount', 'service_tax_per', 'service_tax', 'TotalPayableAmount'];
const fix = (v) => (v === undefined || v === null ? '0.00' : Number(v).toFixed(2));

async function PoundToBitcoinConvertor(Amount) {
  try {
    const BaseUrl = 'https://blockchain.info/tobtc?currency=GBP&value=' + Amount;
    const r = await axios.get(BaseUrl, { responseType: 'text', transformResponse: (d) => d });
    const str = String(r.data).split(/\r?\n/)[0];
    const n = Number(str);
    if (str.trim() === '' || Number.isNaN(n)) throw new Error('format');
    return n;
  } catch (e) {
    return 0;
  }
}

async function SaveChallanImage(ChallanImage, ReferenceNumber, RegNo, loginid, RandomNo) {
  let Imgchallen = '';
  if (ChallanImage.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.ChallenImagePath;
    if (ChallanImage !== '') {
      base64String = ChallanImage;
      let ChallenImage = loginid + '&' + RegNo + '&' + ReferenceNumber + '&' + RandomNo;
      ChallenImage = ChallenImage.trim();
      ChallenImage = ChallenImage.split('&amp;').join('And');
      ChallenImage = ChallenImage.split('&').join(' And ');
      ChallenImage = ChallenImage.replace(/[^\w\d]/g, '');
      ChallenImage = ChallenImage.split(' ').join('-');
      Imgchallen = ChallenImage + '-' + RegNo + ReferenceNumber + RandomNo + '.jpg';
    } else {
      Imgchallen = ' ';
    }
    const dir = path.join(config.uploadDir, s(SavePaths).replace(/^[~/\\]+/, ''));
    const StrValidFullName = path.join(dir, Imgchallen);
    if (base64String.includes('base64,')) base64String = base64String.substring(base64String.indexOf(',') + 1);
    const b = Buffer.from(base64String, 'base64');
    if (b.length === 0) throw new Error('Parameter is not valid.');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(StrValidFullName)) fs.unlinkSync(StrValidFullName);
    fs.writeFileSync(StrValidFullName, b);
  }
  return Imgchallen;
}

async function SendConfirmationEmail(req, ToEmail, Username, Text, Orderid, AllPackageNames) {
  try {
    const Regno = req.user.did;
    let TASMID = 0;
    const row = await db.queryOne('shopping', 'select tasmid from tbl_allsubscriptionmaster where transaction_id=@t limit 1', { t: Orderid });
    if (row) TASMID = row.tasmid;
    const InvoicePrintLi = mapRows(await db.proc('shopping', 'usp_userinvoice', { PLID: Regno, SFDID: TASMID }), InvoicePrint);
    let InvoiceStructure = `

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
    <td style=' border-bottom:1px solid #ddd; font-weight:bold;  border-right:1px solid #ddd; padding:8px; width:80px; '>Amount (\u00A3) </td>
  </tr>`;
    for (const Item of InvoicePrintLi) {
      const PackageType = Item.AllPackageType.split('~');
      const PackageName = Item.AllPackageName.split(',');
      const PackageAmount = Item.AllPackageAmount.split('~');
      const PackageId = Item.AllPackageId.split('~');
      for (let i = 0; i < PackageType.length; i++) {
        InvoiceStructure += `<tr><td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; border-left:1px solid #ddd; padding:8px;vertical-align:top;'> ` + (i + 1) + '</td>';
        let Query = '';
        if (PackageType[i] === '1') {
          const q = await db.scalar('shopping', 'Select SubscriptionDetails From Tbl_SubscriptionMaster Where TSMID=@id limit 1', { id: PackageId[i] });
          Query = q === undefined || q === null ? '' : q;
        }
        InvoiceStructure += `<td style=' border-bottom:1px solid #ddd;line-height:20px;vertical-align:top;  border-right:1px solid #ddd; padding:8px; text-align:left;'>` + PackageName[i] + ' <br/>';
        InvoiceStructure += Query + '</td>';
        InvoiceStructure += `<td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>` + PackageAmount[i] + ' </td></tr>';
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
    <td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>` + fix(Item.With_out_tax_Amount) + '</td></tr>';
      InvoiceStructure += `<tr>
    <td >&nbsp;</td>
    <td>Service tax  ` + fix(Item.service_tax_per) + `% </td><td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>` + fix(Item.service_tax) + '</td></tr>';
      InvoiceStructure += `<tr><td>&nbsp;</td><td><strong>Total Amount </strong></td><td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>` + fix(Item.TotalPayableAmount) + '</td> </tr><tr>   <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr> <tr><td>&nbsp;</td> <td>&nbsp;</td><td>&nbsp;</td></tr> <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>';
    }

    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    const d = new Date();
    const Date_ = String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
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

                      <div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top:0px'>` + InvoiceStructure + `<center>
                          <img src='http://webwebmail.mlmkabila.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'>
                        </center>
                      </div>
                      <div style='clear: both'></div>

<div style='margin-right: 7px; text-align:left; border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
                                                    <h5 style = 'margin:0; font-size:18px; font-weight:normal; padding-bottom:5px;'> Need Support ?</h5>

                                                         <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif,

Helvetica, sans-serif; color: #000'>
                                                        If you have any issues,
                                                        we will be happy to help you.You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank'

style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a>

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

                                                                                           <a href = '$$CompanyFacebookLink$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                                                                      <a href = '$$CompanyTwitterLink$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                                                                 <a href = '$$CompanyGooglePlusLink$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

                                                                                                                            <a href = '$$CompanyLinkedinLink$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

                                                                                                                                       <a href = '$$CompanyPinterestLink$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>

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
        <p style = 'font-family:arial; font-size:14px; padding-top:10px;'>\u00A9 2016-2017 All Rights Reserved | $$CompanyURL$$</p>
    </div>
`;
    mailtxt = rep(mailtxt, '$$AllPackageName$$', AllPackageNames);
    mailtxt = rep(mailtxt, '$$lblname$$', Username);
    mailtxt = rep(mailtxt, '$$datetime$$', Date_);
    mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
    mailtxt = rep(mailtxt, '$$lblOrderid$$', Orderid);
    mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
    mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
    mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    mailtxt = rep(mailtxt, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
    mailtxt = rep(mailtxt, '$$CompanyFacebookLink$$', CompanySettings.CompanyFacebookLink);
    mailtxt = rep(mailtxt, '$$CompanyTwitterLink$$', CompanySettings.CompanyTwitterLink);
    mailtxt = rep(mailtxt, '$$CompanyGooglePlusLink$$', CompanySettings.CompanyGooglePlusLink);
    mailtxt = rep(mailtxt, '$$CompanyLinkedinLink$$', CompanySettings.CompanyLinkedinLink);
    mailtxt = rep(mailtxt, '$$CompanyPinterestLink$$', CompanySettings.CompanyPinterestLink);
    await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
  } catch (exp) {
    console.error('SubscribeUs.SendConfirmationEmail', exp.message);
  }
}

// auth
router.all('/franchise/SubscribeUs/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const TempPlid = parseInt(req.user.did, 10);
  const mode = async (m, props) => mapRows(await db.proc('shopping', 'usp_managesubscription', { Mode: String(m), PLID: TempPlid }), props);
  res.json({
    LiKitMaster: await mode(1, KitMaster),
    LiEmailPackMaster: await mode(2, EmailPackMaster),
    LiSmsPackMaster: await mode(3, SmsPackMaster),
    LiSubscriptionMaster: await mode(4, SubscriptionMaster),
    LiWhatsUpPackMaster: await mode(5, WhatsUpPackMaster),
    LiTrafficBoosterPackMaster: await mode(6, TrafficBoosterPackMaster),
  });
}));

// auth
router.all('/franchise/SubscribeUs/PurchaseKitOrPackage{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const { TotalPayableAmount, PaymentMode, ModeName, CommentORRemark, ChallanImage, ChallanImage1, ChallanImage2, ChallanImage3, BankName, BranchName,
    ReferenceDate, TransactionPassword, GoogleAuthenticationCode, WalletId, AllPackageId, AllPackageType, AllPackageAmount, AllPackageName, BTCTransactionId } = p;
  let ReferenceNumber = p.ReferenceNumber;
  let ReturnOutput = 'success';
  const RegNo = parseInt(req.user.did, 10);
  if (PaymentMode === '1' || PaymentMode === '2') {
    const Obj = {
      Regno: RegNo, TotalPayableAmount, PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, ReferenceNumber,
      TransactionPassword, GoogleAuthenticationCode, WalletId, AllPackageId, AllPackageType, AllPackageAmount, AllPackageName,
    };
    sessionStore.set(req, 'PaymentForOrder', Obj);
    return res.json('PayYouMoney');
  } else if (PaymentMode === '11') {
    const CompanyWalletAddress = await db.scalar('shopping', "Select CLUBCOND From SETTINGS WHERE CAPTION='BTCAddress' limit 1");
    const BitCoinAmount = await PoundToBitcoinConvertor(Number(TotalPayableAmount));
    const obj_APIStatus = await BlockChainAPI.GetTransactionStatus(BTCTransactionId, CompanyWalletAddress);
    if (obj_APIStatus === null || obj_APIStatus === undefined) return res.json('9^Invalid Transaction ID or Hash Code.');
    else if (String(obj_APIStatus.Status).toLowerCase() !== 'success') return res.json('8^Invalid Transaction ID or Hash Code.');
    else if (obj_APIStatus.Toaddress !== CompanyWalletAddress) return res.json('7^You have deposit BTC in wrong wallet address.');
    else if (Number(obj_APIStatus.Value) !== BitCoinAmount) return res.json('6^You did not deposit ' + BitCoinAmount + ' Bitcoin Sorry.');
    ReferenceNumber = BTCTransactionId;
  }

  try {
    const loginid = s(req.user.loginid);
    let AllImageName = '';
    const rnd = () => Math.floor(Math.random() * 999999);
    if (ChallanImage !== '') AllImageName = await SaveChallanImage(ChallanImage, ReferenceNumber, RegNo, loginid, rnd());
    if (ChallanImage1 !== '') AllImageName = AllImageName + ',' + await SaveChallanImage(ChallanImage1, ReferenceNumber, RegNo, loginid, rnd());
    if (ChallanImage2 !== '') AllImageName = AllImageName + ',' + await SaveChallanImage(ChallanImage2, ReferenceNumber, RegNo, loginid, rnd());
    if (ChallanImage3 !== '') AllImageName = AllImageName + ',' + await SaveChallanImage(ChallanImage3, ReferenceNumber, RegNo, loginid, rnd());

    const Plid = Number(req.user.did);
    const r = await db.procOne('shopping', 'usp_allsubscriptionmaster', {
      TotalPayableAmount, PaymentMode, ModeName, CommentORRemark, RegNo, ImageName: AllImageName, BankName, BranchName, ReferenceDate, ReferenceNumber,
      WalletId, TransactionPassword, GoogleAuthenticationCode, AllPackageId, AllPackageType, AllPackageAmount, PLID: Plid, AllPackageName, ProcessingFee: '0.00',
    });
    ReturnOutput = r && r.intresult !== undefined && r.intresult !== null ? String(r.intresult) : '';
    const Orderid = r && r.tranids !== undefined && r.tranids !== null ? String(r.tranids) : '';
    // PORT-NOTE: ExecuteSqlCommand's affected-row count (> 0) is approximated by "the procedure returned a result row".
    if (r) {
      try {
        const AllPackageNames = String(AllPackageName).split('~').join(',');
        const Obj = await db.queryOne('shopping', "Select coalesce(Phone,'') As Phone,EmailID,UserName From Portal_Login where plid = @plid limit 1", { plid: String(Plid) });
        if (Obj) {
          const MobileNo = '9718355334';
          const Msg = 'New Payment received from\r\nUser name: ' + Obj.username + ',\r\nPackage name: ' + AllPackageNames + ',\r\nAmount: ' + AllPackageAmount + ',\r\nRef No.: ' + ReferenceNumber;
          const Message = 'Dear ' + Obj.username + ',\r\nThanks for Purchasing ' + AllPackageNames + ' subscription.\r\nYour Order will be confirmed once your payment gets approved from our account department.\r\nPlease note your subscription order id is ' + Orderid;
          if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
            await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
            const host = req.hostname;
            if (!host.includes('mvp.clusteroffer.com') && host !== 'localhost') {
              await UtilityClass.SendMsgOnMobile(MobileNo, Msg);
            }
          }
          await SendConfirmationEmail(req, Obj.emailid, Obj.username, 'Thank you for purchasing subscription. Your request is sent to Admin for verification.', Orderid, AllPackageNames);
        }
      } catch (Ex) {
        // legacy: ViewBag.Message = Ex.Message (not returned)
      }
    }
  } catch (ExpObj) {
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return res.json(ReturnOutput);
}));

// auth
router.all('/franchise/SubscribeUs/GetPoundToBitcoinConvertor{/:id}', auth, asyncHandler(async (req, res) => {
  const TotalPayableAmount = req.p.TotalPayableAmount;
  const CompanyBTCAddress = await db.scalar('shopping', "Select CLUBCOND From SETTINGS WHERE CAPTION='BTCAddress' limit 1");
  try {
    const BaseUrl = 'https://blockchain.info/tobtc?currency=GBP&value=' + TotalPayableAmount;
    const r = await axios.get(BaseUrl, { responseType: 'text', transformResponse: (d) => d });
    const Str = String(r.data).split(/\r?\n/)[0];
    return res.json(Str + '^' + CompanyBTCAddress);
  } catch (e) {
    return res.json('0.00000000^' + CompanyBTCAddress);
  }
}));

// auth
router.all('/franchise/SubscribeUs/PayByPayYouMoney{/:id}', auth, asyncHandler(async (req, res) => {
  let ReturnOutput = 'PayYouMoney';
  try {
    sessionStore.set(req, 'PaymentForOrder', req.body && Object.keys(req.body).length ? req.body : req.p.all());
  } catch (ExpObj) {
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  res.send(ReturnOutput);
}));

// auth
router.all('/franchise/SubscribeUs/SaveChallanImage{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  res.send(await SaveChallanImage(s(p.ChallanImage), s(p.ReferenceNumber), parseInt(p.RegNo, 10), s(p.loginid), Number(p.RandomNo)));
}));

module.exports = router;
