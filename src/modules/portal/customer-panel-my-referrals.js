'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyReferrals.cs
// (class MyReferralsController => /portal/MyReferrals/...). Database: shopping (Db_Shopping).
// PORT-NOTE: GetEwalletAmount / GetEwalletDetails / GetReferralList / GetCouponList / updatereamrk / deleteCoupon are public methods that do not
// return an ActionResult. MVC turned their return value into a ContentResult (Convert.ToString(value)): a List<T> became the literal type name
// (e.g. "System.Collections.Generic.List`1[ewalletAmount]") and null became an empty response. Reproduced as text responses.
// PORT-NOTE: the controller field `msg` (private int msg = 0) is per-request in MVC (a new controller instance per request) => local variable.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ReferrelDal = require('../../lib/portal/ReferrelDal');
const SendMail = require('../../lib/portal/SendMail');
const { CompanySettings } = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, view, content, customerContentOr, str, toNumber, background, nStr } = require('./_shared/batch-06-common');

const router = express.Router();
const listName = (t) => 'System.Collections.Generic.List`1[' + t + ']';
const nz = (v) => (v === undefined ? null : v);

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/myreferrals" -> MyReferrals/Index
router.all(['/portal/MyReferrals/Index{/:id}', '/portal/MyReferrals', '/portal/referral/myreferrals{/:id}'], ps.customerAuth,
  asyncHandler(async (req, res) => {
    // refralcheck(); (commented out in legacy)
    view(res, '~/Views/CustomerPanel/MyReferrals/Index.cshtml');
  }));

// ---------------------------------------------------------------- generatecoupon(string price, string quantity) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all('/portal/MyReferrals/generatecoupon{/:id}', ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  let ret = '0';
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  ret = await dal.GenerateCoupon(plid, toNumber(nStr(req.p.price)), toNumber(nStr(req.p.quantity)));
  res.json(ret);
}));

// ---------------------------------------------------------------- generateReferal(string CatName) : JsonResult
// auth (Session["Plid"] == null => Json("expired"))
router.all('/portal/MyReferrals/generateReferal{/:id}', ...ps.customerOr('expired'), asyncHandler(async (req, res) => {
  let msg = 0;
  let ret = '';
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  ret = await dal.GenerateReferrel(nz(req.p.CatName), plid);

  if (ret === '1') {
    msg = 1;
    // db._Portal_Login.Where(a => a.PLID == plid).FirstOrDefault()
    const plogin = await db.queryOne(DB, 'SELECT * FROM portal_login WHERE plid = @plid LIMIT 1', { plid });
    if (plogin != null) {
      let body = '';
      const subject = '' + CompanySettings.CompanyName + '  Support Center';
      const bcc = '';
      const cc = '';
      const to = str(plogin.loginid);
      const from1 = '';
      // SendMail SendMailobj = new SendMail();
      body = REFERRAL_MAIL_BODY;
      body = body.split('$$user$$').join(str(plogin.username));
      background(() => SendMail.Send1(from1, to, cc, bcc, subject, body));
    } else {
      msg = 2;
    }
    return res.json(msg);
  }
  return res.json(msg);
}));

// ---------------------------------------------------------------- GetEwalletAmount() : List<ewalletAmount>
// auth (Session["Plid"] == null => return null => empty response)
router.all('/portal/MyReferrals/GetEwalletAmount{/:id}', ...customerContentOr(null), asyncHandler(async (req, res) => {
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  const ObjewalletAmount = await dal.GetEwalletAmount(plid);
  content(res, ObjewalletAmount == null ? null : listName('ewalletAmount'));
}));

// ---------------------------------------------------------------- GetEwalletDetails(fromdate, toDate, pageno, pagesize) : List<EwalletReport>
// auth (Session["Plid"] == null => return null)
router.all('/portal/MyReferrals/GetEwalletDetails{/:id}', ...customerContentOr(null), asyncHandler(async (req, res) => {
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  const ObjEwalletReportList = await dal.GetEwalletDetails(plid, nz(req.p.fromdate), nz(req.p.toDate), nz(req.p.pageno), nz(req.p.pagesize));
  content(res, ObjEwalletReportList == null ? null : listName('EwalletReport'));
}));

// ---------------------------------------------------------------- GetReferralList(fromdate, toDate, pageno, pagesize) : List<ReferalList>
// auth (Session["Plid"] == null => return null)
router.all('/portal/MyReferrals/GetReferralList{/:id}', ...customerContentOr(null), asyncHandler(async (req, res) => {
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  const ObjReferalList = await dal.GetReferralList(plid, nz(req.p.fromdate), nz(req.p.toDate), nz(req.p.pageno), nz(req.p.pagesize));
  content(res, ObjReferalList == null ? null : listName('ReferalList'));
}));

// ---------------------------------------------------------------- GetCouponList(fromdate, toDate, pageno, pagesize) : List<CouponList>
// auth (Session["Plid"] == null => return null)
router.all('/portal/MyReferrals/GetCouponList{/:id}', ...customerContentOr(null), asyncHandler(async (req, res) => {
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  const ObjCouponList = await dal.GetCouponList(plid, nz(req.p.fromdate), nz(req.p.toDate), nz(req.p.pageno), nz(req.p.pagesize));
  content(res, ObjCouponList == null ? null : listName('CouponList'));
}));

// ---------------------------------------------------------------- updatereamrk(string aid, string area) : string
// auth (Session["Plid"] == null => return "login")
router.all('/portal/MyReferrals/updatereamrk{/:id}', ...customerContentOr('login'), asyncHandler(async (req, res) => {
  let ret = '0';
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  ret = await dal.updatereamrk(plid, nz(req.p.aid), nz(req.p.area));
  content(res, ret);
}));

// ---------------------------------------------------------------- deleteCoupon(string cpid) : string
// auth (Session["Plid"] == null => return "login")
router.all('/portal/MyReferrals/deleteCoupon{/:id}', ...customerContentOr('login'), asyncHandler(async (req, res) => {
  let ret = '0';
  const dal = new ReferrelDal();
  ret = await dal.deleteCoupon(nz(req.p.cpid));
  content(res, ret);
}));

// #region mail body (verbatim)
const REFERRAL_MAIL_BODY = `<div>
        <table width='700' style='background: #17c5db; margin: 0px auto; padding: 50px 0px;'>
            <tr>
                <td>

                    <table cellpadding='0' cellspacing='0' style='background: #fff; border: 7px solid #c3f1f6; color: #333; font-family: Arial,Helvetica,sans-serif; margin: 0px 50px; outline: 1px solid #c3ecf0; width: 585px;'>
                        <tr>

                            <td valign='top' style='height: 4px; padding: 0px;'>
                                <img src='http://qlook.bz/images/topborder.png' />
                            </td>
                        </tr>

                        <tr>
                            <td>

                                <table width='585'>
                                    <tr>
                                        <td style='width: 350px; height: 70px;'><a href='http://qlook.bz/'>
                                            <img src='http://qlook.bz/images/logo.png' height='45' border='0' style='margin-top: 15px; margin-left: 5px;' />    </td>
                                        <td style='text-align: right; font-size: 17px; padding-right: 5px; color: #eb480b; font-family: Arial,Helvetica,sans-serif; width: 250px;'></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <div>
                                    <div class='clear'></div>

                                    <table style='background: #ebfafb; font-family: Arial; height: auto; padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px; border: 1px solid #d2f5f9;'>
                                        <tr>
                                            <td>
                                                <h1 style='font-size: 17px; font-family: Arial; font-weight: normal; margin: 15px 0px

15px; color: #3f3f42;'>Hello $$user$$,</h1>
                                                <strong style='font-size: 17px; font-family: Arial; font-weight: normal; margin: 0px; color: #eb480b;'>Thanks for creating your referral link for Qlook.bz.
                                                </strong>

                                                <div style='font-size: 15px; color: #333; font-family: Arial; padding: 10px 0 18px;'>
                                                    Now, you can invite your friends on Qlook by providing the given link.
                                                </div>

                                                <div style='clear: both'></div>
                                                <table border='0' width='147px' height='32px' style='background: #eb480b; border: 1px solid #f00; margin: 0; cursor:pointer;'>

                                                    <tr>
                                                        <td style='padding: 2px 2px;'><a href='http://qlook.bz/portalpanel/referal-program.aspx' style='padding: 0 12px; font-size: 14px; text-decoration: none; font-family: Arial; float: left; color: #fff;'>Invite Your friends</a>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <div style='clear: both'></div>

                                                <div style='clear: both'></div>
                                                <p style='font-size: 14px; font-weight: normal; margin: 15px 0px 15px 0px; font-family: Arial; color: #3f3f42;'>
                                                    After successfully log in with your provided link to other user the benefit would be credited in your qlook account.
                                                </p>
                                                <strong style='font-size: 15px; font-family: Arial; font-weight: normal; margin: 0px; color: #5b5b5e;'>You can also mail us on <span style='color: #eb480b;'>support@qlook.bz </span>in case of any problem regarding the referral link.
If you want to know more about the referral link, so you can visit <span style='color: #eb480b;'>http://qlook.bz/referralprogram.</span>
                                                </strong>
                                                <div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px;'>
                                                    <center>
                                                        <img src='http://qlook.bz/images/divider.png' />
                                                    </center>
                                                </div>

                                                <div style='clear: both'></div>

                                                <div style='clear: both'></div>
                                            </td>
                                        </tr>

                                        <tr>
                                            <td>
                                                <table width='554'>
                                                    <tr>
                                                        <td>

                                                            <p style='font-size: 15px; font-family: Arial; font-weight: normal; margin: 6px 0px 7px 0px; float: left; color: #3f3f42;'>
                                                                Thanks and Regards
                <br />
                                                                Qlook Team
                                                            </p>
                                                        </td>
                                                        <td style='width: 280px; text-align: right;'>

                                                            <div style='margin-right: 7px;'>

                                                                <a href='https://www.facebook.com/QLooK.bz' style='border: none; text-decoration: none;'>
                                                                    <img src='http://qlook.bz/images/mailer-facebook.png' border='0px' style='width: 25px !important; margin-top: 5px;' />
                                                                </a>
                                                                <a href='https://twitter.com/Qlook_bz' style='border: none; text-decoration: none;'>
                                                                    <img src='http://qlook.bz/images/mailer-twitter.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://plus.google.com/+Qlook-Bz/posts' style='border: none; text-decoration: none;'>
                                                                    <img src='http://qlook.bz/images/mailer-gplus.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://www.youtube.com/user/QLookGroup' style='border: none; text-decoration: none;'>
                                                                    <img src='http://qlook.bz/images/mailer-youtube.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://www.pinterest.com/QLooK_bz/' style='border: none; text-decoration: none;'>
                                                                    <img src='http://qlook.bz/images/mailer-pintrest.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://myspace.com/qlook' style='border: none; text-decoration: none;'>
                                                                    <img src='http://qlook.bz/images/mailer-share.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                        </tr>
                                    </table>
                                    <div class='clear'></div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </div>`;

module.exports = router;
