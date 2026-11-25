'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/NewCustomerDashBoard.cs
// (class NewCustomerDashBoardController => /portal/NewCustomerDashBoard/...). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const { CompanySettings } = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, view, outVal, s, str, background } = require('./_shared/batch-06-common');

const router = express.Router();

/** Controllers/CustomerPanel/CustomerDashBoard.cs class BindLeadList */
const BINDLEADLIST_PROPS = ['MAILDATE', 'TYPE', 'CCEMAILID', 'CCNAME', 'MOBILE', 'SUBJECT', 'MESSAGE'];
/** Controllers/UserPanel/Orders.cs class AllOrderList (only the members the SELECT below provides are listed) */
const ALLORDERLIST_SELECTED = ['orderDate', 'orderID', 'Product_Name', 'OStatus'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/dashBoard" -> NewCustomerDashBoard/Index
router.all(['/portal/NewCustomerDashBoard/Index{/:id}', '/portal/NewCustomerDashBoard', '/portal/customer/dashBoard'], ps.customerAuth,
  asyncHandler(async (req, res) => {
    const FavoriteURL = ps.sessionGet(req, 'FavoriteURL');
    if (FavoriteURL !== null && FavoriteURL !== undefined) {
      // Response.Redirect(url) ends the response immediately (ThreadAbortException)
      return res.json({ redirect: String(FavoriteURL) });
    }
    const objAllClass = { LiBindLeadList: null, LiAllOrderList: null };
    const objBindLeadList = [];
    const PLID = Number(req.user.plid);
    const PMID = Number(req.user.pmid || 0);
    const Obj = mapRows(await db.proc(DB, 'usp_showenquirylist', { PLID, PMID }), BINDLEADLIST_PROPS);
    objAllClass.LiBindLeadList = Obj;
    const orderRows = await db.query(DB, `SELECT om.orderdate, om.orderid, pom.product_name, om.status AS ostatus
      FROM tbl_order_master om LEFT JOIN tbl_product_order_master pom ON om.orderid = pom.orderid LEFT JOIN portal_login brm ON brm.plid = om.branchid
      ORDER BY orderdate DESC LIMIT 5`);
    // PORT-NOTE (legacy bug reproduced): Db.Database.SqlQuery<AllOrderList>(...) requires a column for EVERY AllOrderList property
    // (MobileNo, netPayblePrice, ... are not selected) and orderDate is a string mapped from a datetime column, so EF threw
    // "The data reader is incompatible with the specified 'AllOrderList'..." and this page always ended in the error page.
    // The query is still executed; the same exception is raised.
    if (orderRows !== null) {
      throw new Error("The data reader is incompatible with the specified 'AllOrderList'. A member of the type, 'MobileNo', does not have a "
        + 'corresponding column in the data reader with the same name.');
    }
    const objAllOrderList = mapRows(orderRows, ALLORDERLIST_SELECTED);
    objAllClass.LiBindLeadList = objBindLeadList; // legacy overwrote the enquiry list with an empty list
    objAllClass.LiAllOrderList = objAllOrderList;
    return view(res, '~/Views/CustomerPanel/CustomerDashBoard/Index.cshtml', objAllClass);
  }));

// ---------------------------------------------------------------- AccceptanceConfirm(string Sponsor) : JsonResult
// auth (Session["Plid"] == null => Json("Session has been expired, Please try again !"))
router.all('/portal/NewCustomerDashBoard/AccceptanceConfirm{/:id}', ...ps.customerOr('Session has been expired, Please try again !'),
  asyncHandler(async (req, res) => {
    const Sponsor = ''; // legacy overwrote the parameter with ""
    const PLID = Number(req.user.plid);
    const out = await db.procOne(DB, 'usp_customerpanelacceptance', { Sponser: Sponsor, PLID });
    const Result = str(outVal(out, 'result'));
    // PORT-NOTE: ExecuteSqlCommand returned the number of rows the procedure changed. PostgreSQL functions do not report it; the procedure
    // only updates/inserts rows on its 'success' path (the "already linked" path changes nothing), so ReturnOutput = 1 when @RESULT = 'success'.
    const ReturnOutput = Result.toLowerCase() === 'success' ? 1 : 0;
    let Memname = '';
    const row = await db.queryOne(DB, 'SELECT username FROM portal_login WHERE plid = @PLID LIMIT 1', { PLID });
    if (row != null) Memname = row.username;
    if (ReturnOutput > 0) {
      try {
        // ConfirmationThread (background, errors never reach the response)
        // PORT-NOTE: the legacy thread used the DbContext after it was disposed (ObjectDisposedException could kill the thread);
        // here the thread body runs with its own connection.
        background(async () => {
          const Obj = await db.queryOne(DB, `SELECT coalesce(phone, '') AS phone, emailid, username, password FROM portal_login
            WHERE plid::text = @PLID LIMIT 1`, { PLID: String(PLID) });
          if (!Obj) throw new Error('Object reference not set to an instance of an object.');
          const Message = 'Dear ' + s(Memname) + ",\r\n Welcome to " + CompanySettings.CompanyName
            + '’s Customer Panel.Your account is now linked with our Customer Panel Program.\r\n Thank you.';
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
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    let mailtxt = '';
    if (send === 0) {
      mailtxt = CONFIRMATION_MAIL_BODY;
      mailtxt = mailtxt.split('$$lblname$$').join(s(Username));
      mailtxt = mailtxt.split('$$CompanyName$$').join(s(CompanySettings.CompanyName));
      mailtxt = mailtxt.split('$$CompanyURL$$').join(s(CompanySettings.CompanyURL));
      mailtxt = mailtxt.split('$$CompanyDomain$$').join(s(CompanySettings.CompanyDomain));
      mailtxt = mailtxt.split('$$CompanySupportEmailId$$').join(s(CompanySettings.CompanySupportEmailId));
      // mm.Body = mailtxt;
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

// #region mail body (verbatim)
const CONFIRMATION_MAIL_BODY = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
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
<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Customer Panel Registration Confirmation
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear $$lblname$$, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> This is a confirmation email about your customer panel account registration.Thanks for registering your account for customer panel.</p>
</div>
<div style='clear: both'></div>
<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> If you have any issues,
we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> support@jewria.com </a></p>
</a></p>
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
