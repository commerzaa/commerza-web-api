'use strict';
// Port of Member\Common\Controllers\CustomerPanel\MyReferrals.cs (MyReferralsController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const ReferrelDal = require('../../lib/member/ReferrelDal');
const SendMail = require('../../lib/member/SendMail');
const DB = 'affiliate';

const REFERRAL_MAIL_BODY = `<div>
        <table width='700' style='background: #17c5db; margin: 0px auto; padding: 50px 0px;'>
            <tr>
                <td>

                    <table cellpadding='0' cellspacing='0' style='background: #fff; border: 7px solid #c3f1f6; color: #333; font-family: Arial,Helvetica,sans-serif; margin: 0px 50px; outline: 1px solid #c3ecf0; width: 585px;'>
                        <tr>

                            <td valign='top' style='height: 4px; padding: 0px;'>
                                <img src='https://qlook.bz/images/topborder.png' />
                            </td>
                        </tr>

                        <tr>
                            <td>

                                <table width='585'>
                                    <tr>
                                        <td style='width: 350px; height: 70px;'><a href='https://qlook.bz/'>
                                            <img src='https://qlook.bz/images/logo.png' height='45' border='0' style='margin-top: 15px; margin-left: 5px;' />    </td>
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
                                                        <td style='padding: 2px 2px;'><a href='https://qlook.bz/portalpanel/referal-program.aspx' style='padding: 0 12px; font-size: 14px; text-decoration: none; font-family: Arial; float: left; color: #fff;'>Invite Your friends</a>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <div style='clear: both'></div>

                                                <div style='clear: both'></div>
                                                <p style='font-size: 14px; font-weight: normal; margin: 15px 0px 15px 0px; font-family: Arial; color: #3f3f42;'>
                                                    After successfully log in with your provided link to other user the benefit would be credited in your qlook account.
                                                </p>
                                                <strong style='font-size: 15px; font-family: Arial; font-weight: normal; margin: 0px; color: #5b5b5e;'>You can also mail us on <span style='color: #eb480b;'>support@qlook.bz </span>in case of any problem regarding the referral link.
If you want to know more about the referral link, so you can visit <span style='color: #eb480b;'>https://qlook.bz/referralprogram.</span>
                                                </strong>
                                                <div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px;'>
                                                    <center>
                                                        <img src='https://qlook.bz/images/divider.png' />
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
                                                                    <img src='https://qlook.bz/images/mailer-facebook.png' border='0px' style='width: 25px !important; margin-top: 5px;' />
                                                                </a>
                                                                <a href='https://twitter.com/Qlook_bz' style='border: none; text-decoration: none;'>
                                                                    <img src='https://qlook.bz/images/mailer-twitter.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://plus.google.com/+Qlook-Bz/posts' style='border: none; text-decoration: none;'>
                                                                    <img src='https://qlook.bz/images/mailer-gplus.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://www.youtube.com/user/QLookGroup' style='border: none; text-decoration: none;'>
                                                                    <img src='https://qlook.bz/images/mailer-youtube.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://www.pinterest.com/QLooK_bz/' style='border: none; text-decoration: none;'>
                                                                    <img src='https://qlook.bz/images/mailer-pintrest.png' border='0px' style='width: 25px !important' />
                                                                </a>
                                                                <a href='https://myspace.com/qlook' style='border: none; text-decoration: none;'>
                                                                    <img src='https://qlook.bz/images/mailer-share.png' border='0px' style='width: 25px !important' />
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

// route-config: referral/myreferrals -> MyReferrals/Index
// auth
router.all(['/member/MyReferrals/Index{/:id}', '/member/referral/myreferrals'], auth, asyncHandler(async (req, res) => {
  res.json({});
}));

// auth (legacy returned "expired" when the session was null; handled by the auth middleware)
router.all('/member/MyReferrals/generatecoupon{/:id}', auth, asyncHandler(async (req, res) => {
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  const ret = await dal.GenerateCoupon(plid, Number(req.p.price), Number(req.p.quantity));
  res.json(ret);
}));

// auth
router.all('/member/MyReferrals/generateReferal{/:id}', auth, asyncHandler(async (req, res) => {
  let msg = 0; // private int msg = 0 (per request controller instance)
  const plid = Number(req.user.plid);
  const dal = new ReferrelDal();
  const ret = await dal.GenerateReferrel(req.p.CatName, plid);
  if (ret === '1') {
    msg = 1;
    const plogin = await db.queryOne(DB, 'select * from portal_login where plid=@plid limit 1', { plid });
    if (plogin !== null) {
      const subject = 'Crypto Inbox  Support Center';
      const bcc = '';
      const cc = '';
      const to = String(plogin.loginid);
      const from1 = '';
      const body = REFERRAL_MAIL_BODY.split('$$user$$').join(String(plogin.username));
      // background e-mail thread
      Promise.resolve().then(() => SendMail.Send1(from1, to, cc, bcc, subject, body)).catch(() => {});
    } else {
      msg = 2;
    }
    return res.json(msg);
  }
  return res.json(msg);
}));

// auth (List<ewalletAmount> returned as JSON; legacy returned null when the session was null)
router.all('/member/MyReferrals/GetEwalletAmount{/:id}', auth, asyncHandler(async (req, res) => {
  const dal = new ReferrelDal();
  res.json(await dal.GetEwalletAmount(Number(req.user.plid)));
}));

// auth
router.all('/member/MyReferrals/GetEwalletDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const dal = new ReferrelDal();
  res.json(await dal.GetEwalletDetails(Number(req.user.plid), req.p.fromdate, req.p.toDate, req.p.pageno, req.p.pagesize));
}));

// auth
router.all('/member/MyReferrals/GetReferralList{/:id}', auth, asyncHandler(async (req, res) => {
  const dal = new ReferrelDal();
  res.json(await dal.GetReferralList(Number(req.user.plid), req.p.fromdate, req.p.toDate, req.p.pageno, req.p.pagesize));
}));

// auth
router.all('/member/MyReferrals/GetCouponList{/:id}', auth, asyncHandler(async (req, res) => {
  const dal = new ReferrelDal();
  res.json(await dal.GetCouponList(Number(req.user.plid), req.p.fromdate, req.p.toDate, req.p.pageno, req.p.pagesize));
}));

// auth (returns a plain string)
router.all('/member/MyReferrals/updatereamrk{/:id}', auth, asyncHandler(async (req, res) => {
  const dal = new ReferrelDal();
  const ret = await dal.updatereamrk(Number(req.user.plid), req.p.aid, req.p.area);
  res.type('text/plain').send(String(ret === undefined || ret === null ? '' : ret));
}));

// auth (returns a plain string)
router.all('/member/MyReferrals/deleteCoupon{/:id}', auth, asyncHandler(async (req, res) => {
  const dal = new ReferrelDal();
  const ret = await dal.deleteCoupon(req.p.cpid);
  res.type('text/plain').send(String(ret === undefined || ret === null ? '' : ret));
}));

module.exports = router;
