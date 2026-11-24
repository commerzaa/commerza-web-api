'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/PromoteReferral .cs (PromoteReferralController, 8 actions)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: PromoteReferral -> referral/itjM5Fo_slash_4uJx2u_slash_GuLWuegromotereferral== (Index)
 * Session["Plid"] checks => auth middleware. The protected helper sendmail() is not routed (ported inline below).
 */
const express = require('express');
const { query, queryOne, exec, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const SendMail = require('../../lib/member/SendMail');
const common = require('../../lib/member/common');

const router = express.Router();
const DB = 'affiliate';
const C = 'PromoteReferral';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const colOf = (rows, n) => {
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase());
  return k === undefined ? null : r[k];
};
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const P_LANDING = ['RowNumber', 'TLPMID', 'PageName', 'PreviewURL', 'PageURL', 'IsDefault'];
const pad = (n) => String(n).padStart(2, '0');
const ddMMyyyy = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/itjM5Fo_slash_4uJx2u_slash_GuLWuegromotereferral=='], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Plid = Number(req.user.plid);
  const ObjLanding = mapRows(await proc(DB, 'usp_managereferal', { plid: Math.trunc(Plid) }), P_LANDING);
  const row = await queryOne(DB, 'select * from portal_login where plid=@plid limit 1', { plid: Plid });
  const UserName = row.username;
  ViewBag.ReferralID = row.username;
  let RLID = 0;
  if (Number(row.defaultlandingurl) === 0) RLID = 0; else RLID = Number(row.defaultlandingurl);
  const row1 = await queryOne(DB, 'select * from referral_link where rlid=@rlid limit 1', { rlid: RLID });
  if (row1) ViewBag.DefaultUrl = s(row1.url).replace(/\/+$/, '') + '/' + UserName;
  res.json({ Model: ObjLanding, ViewBag });
}));

// ---- MakeDefualtUrl ---------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/MakeDefualtUrl{/:id}`, auth, asyncHandler(async (req, res) => {
  const RLID = parseInt(req.p.RLID, 10);
  if (Number.isNaN(RLID)) throw new Error("The parameters dictionary contains a null entry for parameter 'RLID' of non-nullable type 'System.Int32'.");
  const PLID = Number(req.user.plid);
  let ret = '';
  const row = await queryOne(DB, 'select plid from portal_login where plid=@plid limit 1', { plid: PLID });
  if (row) {
    await exec(DB, 'update portal_login set defaultlandingurl=@rlid where plid=@plid', { rlid: RLID, plid: PLID });
    ret = 'Successfully set your default promotioal url.';
  } else {
    ret = 'Some Error Occured !';
  }
  res.json(ret);
}));

// ---- BtnSubmitSide ----------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/BtnSubmitSide{/:id}`, auth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  const dal = new common();
  const ret = await dal.UpdateReferrelSide(PLID, req.p.Side);
  res.json(ret);
}));

// ---- AccceptReferralProgram -------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/AccceptReferralProgram{/:id}`, auth, asyncHandler(async (req, res) => {
  const Sponsor = '';
  const PLID = Number(req.user.plid);
  // PORT-NOTE: ExecuteSqlCommand's rows-affected value is replaced by "the procedure returned a row"; @Result OUT is the "result" column
  const out = await proc(DB, 'usp_newacceptreferralprogram', { sponser: Sponsor, plid: PLID });
  const Result = s(colOf(out, 'result'));
  const ReturnOutput = out.length;
  if (ReturnOutput > 0) {
    try {
      // legacy background thread: reads the member contact row, the confirmation SMS / mail calls are commented out in C#
      Promise.resolve().then(() => queryOne(DB, "Select coalesce(phone,'') As phone,emailid,username,password From portal_login where plid = @plid", { plid: PLID })).catch(() => {});
    } catch (ExpObj) {
      await errIns(req, ExpObj, 'AccceptReferralProgram');
    }
  }
  res.json(Result.toLowerCase());
}));

// ---- UpdateReferrel ---------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/UpdateReferrel{/:id}`, auth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  const dal = new common();
  const ret = await dal.UpdateReferrel(PLID, req.p.ReferrelName);
  res.json(ret);
}));

// ---- IsDefault --------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/IsDefault{/:id}`, auth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  const dal = new common();
  const ret = await dal.IsDefault(PLID, req.p.ReferrelName);
  res.json(ret);
}));

// ---- protected sendmail (not an action) -------------------------------------------------------------------------
async function sendmail(req, plid, email1, referallink, SenderName) {
  let send = 0;
  try {
    const SoftUrl = await queryOne(DB, 'select * from tbl_companymaster where comid=1 limit 1');
    const SoftwareUrl = SoftUrl.software_url;
    const CompanyName = SoftUrl.name;

    const subject = 'User Refferal Link';
    let mailtxt = '';
    const Date_ = ddMMyyyy(new Date());
    const email = email1;
    if (send === 0) {
      const UrlLink = SoftwareUrl;
      const ImgUrl = '' + SoftwareUrl + '/images/Admin-1.png';
      const CompanyNmaeForEmail = CompanyName;
      referallink = '' + SoftwareUrl + '/referral-signup';
      mailtxt = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 100%'>
<tbody><tr><td>
<table width='100%'><tbody><tr>
    <td style='width: 70%'><a href='$$UrlLink$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='$$ImgUrl$$' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right;   padding-right: 10px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 30%'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; margin:10px; padding-top: 6px;'><tbody><tr><td>
<h4 style=' font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #000'>Hey, have you heard of this site? I became a Member for Free and thought you might want to check it out too!
 </h4>
<p>
No matter what your product is, you are ultimately in the Products business. customers need to be
constantly Purchasing about the many advantages of doing business with you, trained to use your products more effectively,
and taught how to make never-ending improvement in their lives.</p>
<p>
A market is never saturated with a good product, but it is very quickly saturated with a bad one. All of the Products are for brand new, name brand products, all selling for less than of the retail price! You won't believe these prices! check it out at
<a href='$$ReferralLInk$$' target='_blank' style='text-decoration:none; color:#c95831;'>$$UrlLink$$</a>
or copy this url: <a id='LinkForShare' href='$$ReferralLInk$$' target='_blank' style='text-decoration:none; color:#c95831;'>$$ReferralLInk$$</a></p>
<div style='clear: both'></div>
<p style='font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px;'>
It's free to join, it's really cool and really addictive. Thanks.
</p>
<strong style=' font-weight: normal; margin: 0px;'></strong>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='100%'><tbody><tr><td>

<p style='line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
$$CompanyNmaeForEmail$$ Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<div style=''>

</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table>

    <div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;
      mailtxt = mailtxt.split('$$UrlLink$$').join(UrlLink);
      mailtxt = mailtxt.split('$$CompanyNmaeForEmail$$').join(CompanyNmaeForEmail);
      mailtxt = mailtxt.split('$$ImgUrl$$').join(ImgUrl);
      mailtxt = mailtxt.split('$$datetime$$').join(Date_);
      mailtxt = mailtxt.split('$$ReferralLInk$$').join(referallink);
      const result = await SendMail.Send(0, '', email, '', '', subject, mailtxt, SenderName);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'sendmail');
  }
}

// ---- btnsendmail ------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/btnsendmail{/:id}`, auth, asyncHandler(async (req, res) => {
  const { email1, SenderName } = req.p;
  let { referallink } = req.p;
  const plid = Number(req.user.plid);
  let ret = '0';
  referallink = 'http://login.qcxtoken.com/referral-signup' + referallink;
  try {
    ret = '1';
    Promise.resolve().then(() => sendmail(req, plid, email1, referallink, SenderName)).catch(() => {});
  } catch (ExpObj) {
    ret = ExpObj.message;
    await errIns(req, ExpObj, 'btnsendmail');
  }
  res.json(ret);
}));

// ---- BtnSendSmsForReferAndEarn ----------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/BtnSendSmsForReferAndEarn{/:id}`, auth, asyncHandler(async (req, res) => {
  let { MobileNo } = req.p;
  const { Reflinks } = req.p;
  let ret = '0';
  try {
    MobileNo = s(MobileNo).replace(/,+$/, '');
    MobileNo = MobileNo.replace(/^,+/, '');
    ret = '1';
    const mobile = MobileNo;
    Promise.resolve().then(() => UtilityClass.SendMsgOnMobile(mobile, 'Hurry Up !!\r\nWe help you to earn money by refer link to your friends \r\n' + Reflinks + '\r\nFor more details visit Our Website')).catch(() => {});
  } catch (ExpObj) {
    ret = ExpObj.message;
    await errIns(req, ExpObj, 'BtnSendSmsForReferAndEarn');
  }
  res.json(ret);
}));

module.exports = router;
