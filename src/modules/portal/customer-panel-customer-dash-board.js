// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/CustomerDashBoard.cs (CustomerDashBoardController => /portal/CustomerDashBoard/...)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const CS = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, s, outCol, toInt32, rep, view, background } = require('./_shared/batch-24-common');

const CompanySettings = CS.CompanySettings || CS;
const router = express.Router();
const P = '/portal/CustomerDashBoard';
/** class BindLeadList */
const BINDLEADLIST_PROPS = ['MAILDATE', 'TYPE', 'CCEMAILID', 'CCNAME', 'MOBILE', 'SUBJECT', 'MESSAGE'];

// [CheckResellerTimeout] on the controller: body commented out in legacy => no check (ps.CheckResellerTimeout = portalSession)

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/dashBoard -> CustomerDashBoard/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/dashBoard'], ps.customerAuth, asyncHandler(async (req, res) => {
  const FavoriteURL = ps.sessionGet(req, 'FavoriteURL');
  if (FavoriteURL !== null && FavoriteURL !== undefined) {
    // Response.Redirect(url) ends the response (ThreadAbortException)
    return res.json({ redirect: String(FavoriteURL) });
  }
  const PLID = toInt32(Number(req.user.plid));
  const PMID = toInt32(req.user.pmid === undefined || req.user.pmid === null ? 0 : Number(req.user.pmid));
  const Obj = mapRows(await db.proc(DB, 'usp_showenquirylist', { PLID, PMID }), BINDLEADLIST_PROPS);
  return view(res, '~/Views/CustomerPanel/MerchantDashBoard/Index.cshtml', Obj);
}));

// ---------------------------------------------------------------- AccceptanceConfirm(string Sponsor) : JsonResult
// auth (Session["Plid"] == null => Json("Session has been expired, Please try again !"))
router.all(`${P}/AccceptanceConfirm{/:id}`, ...ps.customerOr('Session has been expired, Please try again !'), asyncHandler(async (req, res) => {
  const Sponsor = ''; // legacy overwrote the parameter with ""
  const PLID = Number(req.user.plid);
  const out = await db.procOne(DB, 'usp_merchantpanelacceptance', { SPONSER: Sponsor, PLID });
  const Result = s(outCol(out, 'result'));
  // PORT-NOTE: ExecuteSqlCommand returned the number of rows the procedure changed; PostgreSQL functions do not report it.
  // The procedure only changes rows on its 'success' path, so ReturnOutput = 1 when @RESULT = 'success', else 0.
  const ReturnOutput = Result.toLowerCase() === 'success' ? 1 : 0;
  let Memname = '';
  const row = await db.queryOne(DB, 'SELECT username FROM portal_login WHERE plid = @PLID LIMIT 1', { PLID });
  if (row != null) Memname = row.username;
  if (ReturnOutput > 0) {
    try {
      // ConfirmationThread (errors never reached the response)
      background(async () => {
        const Obj = await db.queryOne(DB, `SELECT coalesce(phone, '') AS phone, emailid, username, password FROM portal_login
          WHERE plid::text = @PLID LIMIT 1`, { PLID: String(PLID) });
        const Message = 'Dear ' + s(Memname) + ',\r\n Welcome to ' + s(CompanySettings.CompanyName)
          + '’s Merchant Panel.Your account is now linked with our Merchant Panel Program.\r\n Thank you.';
        if (!Obj) throw new TypeError('Object reference not set to an instance of an object.');
        if (Obj.phone != null && Obj.phone !== '') {
          await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
        }
        if (Obj.emailid != null && Obj.username != null) {
          await SendConfirmationEmail(Obj.emailid, Obj.username);
        }
      });
    } catch (Ex) {
      // ViewBag.Message = Ex.Message (not part of the Json result)
    }
  }
  res.json(Result.toLowerCase());
}));

/** protected void SendConfirmationEmail(string ToEmail, string Username) - not an action */
async function SendConfirmationEmail(ToEmail, Username) {
  let send = 0;
  try {
    const subject = '' + s(CompanySettings.CompanyName) + ' Support Center';
    let mailtxt = '';
    if (send === 0) {
      mailtxt = MAIL_BODY;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message
  }
}

// #region mail body (verbatim from the C# source)
const MAIL_BODY = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
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
we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a></p>
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
<a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'https://www.linkedin.com/company/ATCShopping' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
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

module.exports = router;
