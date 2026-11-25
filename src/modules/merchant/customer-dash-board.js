'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\CustomerDashBoard.cs  (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const SendMail = require('../../lib/merchant/SendMail');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const P = '/merchant/CustomerDashBoard';

const BindLeadList = ['MAILDATE', 'TYPE', 'CCEMAILID', 'CCNAME', 'MOBILE', 'SUBJECT', 'MESSAGE'];
const SalesSummary = ['SALEDATE', 'SALEAMOUNT', 'COLOR'];

// protected void SendConfirmationEmail(string ToEmail, string Username)  - not an action (protected), ported as internal function
async function SendConfirmationEmail(ToEmail, Username) {
  let send = 0;
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    let mailtxt = '';
    if (send === 0) {
      mailtxt = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Merchant Panel Registration Confirmation
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear $$lblname$$, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> This is a confirmation email about your merchant panel account registration.Thanks for registering your account for merchant panel.</p>
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
<a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
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
      mailtxt = mailtxt.split('$$lblname$$').join(Username);
      mailtxt = mailtxt.split('$$CompanyDomain$$').join(CompanySettings.CompanyDomain);
      mailtxt = mailtxt.split('$$SupportEmailId$$').join(CompanySettings.CompanySupportEmailId);
      mailtxt = mailtxt.split('$$CompanyName$$').join(CompanySettings.CompanyName);
      mailtxt = mailtxt.split('$$CompanyURL$$').join(CompanySettings.CompanyURL);

      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message;
  }
}

// auth ; route-config: merchant/dashBoard
router.all([`${P}/Index{/:id}`, P, '/merchant/dashBoard'], ...guard, asyncHandler(async (req, res) => {
  // Session["FavoriteURL"] -> Response.Redirect(...)
  const fav = sessionStore.get(req, 'FavoriteURL');
  if (fav != null) return res.json({ redirect: String(fav) });

  const ViewBag = {};
  if (sessionStore.get(req, 'LoginwithMobile') != null) {
    ViewBag.masterpageshow = 'MobileLogin';
  } else {
    ViewBag.masterpageshow = '';
  }

  const PLID = parseInt(req.user.plid, 10);
  const PMID = parseInt(req.user.pmid, 10);
  const rows = await db.proc(DB, 'usp_showenquirylist', { PLID, PMID });
  res.json({ Model: mapRows(rows, BindLeadList), ViewBag, ...ViewBag });
}));

// auth (legacy: "Session has been expired" when no session)
router.all(`${P}/AccceptanceConfirm{/:id}`, ...guard, asyncHandler(async (req, res) => {
  let Sponsor = req.p.Sponsor;
  Sponsor = '';
  const PLID = parseInt(req.user.plid, 10);
  // PORT-NOTE: ExecuteSqlCommand's rows-affected (>0 => send welcome SMS/mail) is not available from a function call; "success" in @Result (the only
  // branch of USP_MerchantPanelAcceptance that runs the UPDATE/INSERT statements) is used as the equivalent.
  const r = await db.procOne(DB, 'usp_merchantpanelacceptance', { sponser: Sponsor, plid: PLID });
  const outKey = r ? Object.keys(r).find((k) => k.toLowerCase() === 'result') : undefined;
  const Result = r ? String(r[outKey !== undefined ? outKey : Object.keys(r)[0]] === null ? '' : r[outKey !== undefined ? outKey : Object.keys(r)[0]]) : '';
  let Memname = '';
  const row = await db.queryOne(DB, 'SELECT username FROM portal_login WHERE plid = @plid LIMIT 1', { plid: PLID });
  if (row != null) Memname = row.username;
  const ReturnOutput = Result.toLowerCase() === 'success' ? 1 : 0;
  if (ReturnOutput > 0) {
    try {
      // new Thread(...) => fire and forget
      (async () => {
        try {
          const Obj = await db.queryOne(DB, "Select coalesce(Phone,'') As Phone,EmailID,UserName,Password From Portal_Login where plid = @plid LIMIT 1", { plid: String(PLID) });
          const Message = 'Dear ' + Memname + ',\r\n Welcome To ' + CompanySettings.CompanyName + '’s Merchant Panel.Your account is now linked with our Merchant Panel Program.\r\n Thank you.';
          if (Obj.phone != null && Obj.phone !== '') {
            await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
          }
          if (Obj.emailid != null && Obj.username != null) {
            await SendConfirmationEmail(Obj.emailid, Obj.username);
          }
        } catch (e) { console.error(e.message); }
      })();
    } catch (Ex) {
      // ViewBag.Message = Ex.Message;
    }
  }
  return res.json(Result.toLowerCase());
}));

// auth (null session => RedirectToAction("Index","Home"))
router.all(`${P}/MerchantSalesSummary{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getsalessummary_merchant_dashboard', { REGNO: req.user.plid });
  return res.json(mapRows(rows, SalesSummary));
}));

module.exports = router;
