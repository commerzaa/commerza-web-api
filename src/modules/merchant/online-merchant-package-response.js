'use strict';
const DB = 'shopping';
// Ported from Merchant Panel Controllers/OnlineMerchantPackageResponseController.cs  (DB: shopping - Db_Shopping)
const express = require('express');
const router = express.Router();
const { queryOne, procOne } = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const SendMail = require('../../lib/merchant/SendMail');

const BASE = '/merchant/OnlineMerchantPackageResponse';
const str = (v) => (v === null || v === undefined ? '' : String(v));

const EMAIL_TEMPLATE = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>
<link href='http://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center' style='background:#2d2a24'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='$$CompanyResellerurl$$/images/eblaa_new.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
<td align='center'><strong style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> 
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear Reseller, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> Thanks for purchasing package </p>
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
<a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyResellerurl$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyResellerurl$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyResellerurl$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyResellerurl$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyResellerurl$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
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

async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = '' + CompanySettings.CompanyName + ' Purchased Package Notification.';
    const Date_ = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`; })();
    if (send === 0) {
      let mailtxt = EMAIL_TEMPLATE;
      mailtxt = mailtxt.split('$$lblname$$').join(Username);
      mailtxt = mailtxt.split('$$datetime$$').join(Date_);
      mailtxt = mailtxt.split('$$lblmessage$$').join(Text);
      mailtxt = mailtxt.split('$$CompanyDomain$$').join(CompanySettings.CompanyDomain);
      mailtxt = mailtxt.split('$$CompanyURL$$').join(CompanySettings.CompanyURL);
      mailtxt = mailtxt.split('$$CompanyName$$').join(CompanySettings.CompanyName);
      mailtxt = mailtxt.split('$$CompanySupportEmailID$$').join(CompanySettings.CompanySupportEmailId);
      mailtxt = mailtxt.split('$$CompanyResellerurl$$').join(CompanySettings.CompanyResellerURL);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) { /* ViewBag.Message = exp.Message (unused) */ }
}

// public gateway callback (session read optional; legacy NRE inside the try => error branch)
// route-config: secure-payment-gateway/package-payment-success
router.all([`${BASE}/PaymentSuccess{/:id}`, '/merchant/secure-payment-gateway/package-payment-success'], optionalAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  try {
    let refrenceid = req.p.refrenceid === undefined || req.p.refrenceid === null ? '' : req.p.refrenceid;
    let strOutput = '', strOutput2 = '', strOutput3 = '', strpackagedate = '', strPackgeAmount = '';
    if (refrenceid !== '') {
      refrenceid = await UtilityClass.Decryptword(refrenceid);
      // PORT-NOTE: OUT params read as columns of the single result row
      const r = await procOne(DB, 'usp_update_merchantonlinepackagepurchaserequests', {
        mode: 1, transid: refrenceid,
      });
      strOutput = str(r && r.stroutput);
      strOutput2 = str(r && r.strpackagename);
      strOutput3 = str(r && r.utilityname);
      strpackagedate = str(r && r.packagedate);
      strPackgeAmount = str(r && r.packageamountdata);
      if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '' && strOutput2 !== '') {
        ViewBag.PaymentStatus = 'SUCCESS';
        ViewBag.TransactionId = refrenceid;
        const Pmid = req.user.plid; // throws (TypeError) when no session, like the legacy NRE
        let emailid = '', mobile = '', username = '', ResellerName = '';
        const row = await queryOne(DB, 'select emailid, phone, fname from portal_login where plid = @plid limit 1', { plid: Pmid });
        if (row) {
          emailid = row.emailid;
          mobile = row.phone;
          ResellerName = row.fname;
          if (ResellerName.trim() === '') ResellerName = 'Reseller';
          if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '' && strOutput2 !== '') {
            await SendConfirmationEmail(emailid, username, 'you have purchased ' + strOutput2 + ' package!!.');
            // background SMS thread
            Promise.resolve().then(() => UtilityClass.SendMsgOnMobile(mobile,
              'Dear ' + ResellerName + ',\r\nYou have purchased ' + strOutput3 + ' Package on ' + strpackagedate + ' and your package Amount : ' + strPackgeAmount + ' only.\r\nThank you for purchasing ' + strOutput2 + ' package.\r\nThe ' + CompanySettings.CompanyName + ' Team')).catch(() => {});
          }
        }
      }
    } else {
      ViewBag.PaymentStatus = 'Error';
    }
    res.json({ ViewBag });
  } catch (ex) {
    try { await UtilityClass.TrackError(ex.message); } catch (e) { /* ignore */ }
    res.json({ ViewBag: { PaymentStatus: 'Something went wrong please try again!', TransactionId: 'XXXXXXXXX' } });
  }
}));

// public gateway callback
const PaymentFailed = asyncHandler(async (req, res) => {
  const ViewBag = {};
  try {
    let refrenceid = req.p.refrenceid === undefined || req.p.refrenceid === null ? '' : req.p.refrenceid;
    let strOutput = '';
    if (refrenceid !== '') {
      refrenceid = await UtilityClass.Decryptword(refrenceid);
      const r = await procOne(DB, 'usp_update_merchantpaymentsstatus', { mode: 2, transid: refrenceid });
      strOutput = str(r && r.stroutput);
      if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
        ViewBag.PaymentStatus = 'FAILED';
        ViewBag.TransactionId = refrenceid;
        // legacy: confirmation message to user is commented out
      }
    } else {
      ViewBag.PaymentStatus = 'Error';
    }
    res.json({ ViewBag });
  } catch (ex) {
    res.json({ ViewBag: { PaymentStatus: 'Something went wrong please try again!', TransactionId: 'XXXXXXXXX' } });
  }
});
router.all(`${BASE}/PaymentFailed{/:id}`, PaymentFailed);
// route-config: secure-payment-gateway/package-payment-failed
router.all('/merchant/secure-payment-gateway/package-payment-failed', PaymentFailed);
// public
// route-config: secure-payment-gateway/package-payment-inprocess
router.all([`${BASE}/PaymentInProcess{/:id}`, '/merchant/secure-payment-gateway/package-payment-inprocess'], asyncHandler(async (req, res) => {
  const refrenceid = req.p.refrenceid === undefined || req.p.refrenceid === null ? '' : req.p.refrenceid;
  res.json({ ViewBag: { PaymentInProcess: refrenceid !== '' ? 'Success' : 'Error' } });
}));

// public gateway callback
// route-config: secure-payment-gateway/package-payment-cancel
router.all([`${BASE}/PaymentCancel{/:id}`, '/merchant/secure-payment-gateway/package-payment-cancel'], asyncHandler(async (req, res) => {
  const ViewBag = {};
  try {
    let refrenceid = req.p.refrenceid === undefined || req.p.refrenceid === null ? '' : req.p.refrenceid;
    if (refrenceid !== '') {
      refrenceid = await UtilityClass.Decryptword(refrenceid);
      const r = await procOne(DB, 'usp_update_merchantpaymentsstatus', { mode: 3, transid: refrenceid });
      const strOutput = str(r && r.stroutput);
      if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
        ViewBag.PaymentStatus = 'CANCEL';
        ViewBag.TransactionId = refrenceid;
      }
    } else {
      ViewBag.PaymentStatus = 'Error';
    }
    res.json({ ViewBag });
  } catch (ex) {
    res.json({ ViewBag: { PaymentStatus: 'Something went wrong please try again!', TransactionId: 'XXXXXXXXX' } });
  }
}));

module.exports = router;
