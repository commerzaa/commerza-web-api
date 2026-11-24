'use strict';
// Ported from Member\Controllers\CustomerPanel\MemberTaskList.cs (11 public actions + protected sendmail helper) - database: affiliate (Db_Affiliate)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const SendMail = require('../../lib/member/SendMail');
const commonLib = require('../../lib/member/common');
const DB = 'affiliate';
const P = '/member/MemberTaskList';
const CommonClass = commonLib.common || commonLib;
const nz = (v) => (v === undefined || v === null ? '' : String(v));
const fire = (fn) => { setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }); }; // legacy System.Threading.Thread(...).Start()
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req ? req.path : '');
  } catch (e) { console.error(e.message); }
}
const dmy = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; // DateTime.Now.ToString("dd-MM-yyyy")

// protected void sendmail(Int64 plid, string email1, string referallink, string SenderName)  (helper, not an action)
async function sendmail(plid, email1, referallink, SenderName, req) {
  try {
    const SoftUrl = await db.queryOne(DB, 'select * from TBL_COMPANYMASTER where COMID=1 limit 1');
    if (SoftUrl == null) throw new Error('Object reference not set to an instance of an object.');
    const SoftwareUrl = SoftUrl.software_url;
    const CompanyName = SoftUrl.name;
    const subject = 'User Refferal Link';
    const Date_ = dmy(new Date());
    const UrlLink = SoftwareUrl;
    const ImgUrl = '' + SoftwareUrl + '/images/Admin-1.png';
    const CompanyNmaeForEmail = CompanyName;
    referallink = '' + SoftwareUrl + '/referral-signup';
    let mailtxt = `<div>
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
    await SendMail.Send(0, '', email1, '', '', subject, mailtxt, SenderName); // result "s" => sent, anything else => return (no further action)
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'sendmail', req);
  }
}

// auth
// route-config: referral/2LnlbAZTWFEnTaskcUxhPvG2Cw== -> Index
router.all([P + '/Index{/:id}', '/member/referral/2LnlbAZTWFEnTaskcUxhPvG2Cw=='], auth, asyncHandler(async (req, res) => {
  res.json({ username: null }); // @ViewBag.username = Session[""]
}));

// auth (public List<managerDirect> method of the controller; no session read in legacy but it exposes member downline data)
router.all(P + '/Direct_List{/:id}', auth, asyncHandler(async (req, res) => {
  const LoginID = req.p.LoginID;
  let li = [];
  try {
    const checkmanager = await db.queryOne(DB, 'select RANKID from member_master where regno::text = @l limit 1', { l: nz(LoginID) });
    if (checkmanager != null && Number(checkmanager.rankid) > 0) {
      // (legacy also selected member_master rows by SPONSERID into an unused variable)
      li = mapRows(await db.proc(DB, 'usp_directMamageMeber', { loginid: LoginID }), ['loginid', 'email']);
    }
  } catch (ex) { /* legacy: swallowed */ }
  res.json(li);
}));

// auth
router.all(P + '/TaskBind{/:id}', auth, asyncHandler(async (req, res) => {
  const task = mapRows(await db.proc(DB, 'USP_CHECKMEMBERSTATUS', { REGNO: Number(req.user.plid) }), ['GiveID', 'Status']);
  res.json(task); // ViewBag.ReferralID = Session UserName (not part of the JSON)
}));

// auth
router.all(P + '/Save{/:id}', auth, asyncHandler(async (req, res) => {
  const GID = parseInt(req.p.GID, 10);
  if (Number.isNaN(GID)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'GID'" });
  const o = await db.procOne(DB, 'USP_SAVETASK', { GID, URL: req.p.URL, EMP_Id: Number(req.user.plid) });
  const k = o && Object.keys(o).find((x) => x.toLowerCase() === 'strresult');
  res.json(k && o[k] !== null ? String(o[k]) : '');
}));

// auth (legacy returned "expired" when the session was missing; the auth middleware answers 401 instead)
router.all(P + '/MakeDefualtUrl{/:id}', auth, asyncHandler(async (req, res) => {
  const RLID = parseInt(req.p.RLID, 10);
  if (Number.isNaN(RLID)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'RLID'" });
  const PLID = Number(req.user.plid);
  let ret = '';
  const row = await db.queryOne(DB, 'select plid from portal_login where PLID=@plid limit 1', { plid: PLID });
  if (row != null) {
    await db.exec(DB, 'update portal_login set DefaultLandingUrl=@rlid where PLID=@plid', { rlid: RLID, plid: PLID });
    ret = 'Successfully set your default promotioal url.';
  } else {
    ret = 'Some Error Occured !';
  }
  res.json(ret);
}));

// auth
router.all(P + '/BtnSubmitSide{/:id}', auth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  const ret = await new CommonClass().UpdateReferrelSide(PLID, req.p.Side);
  res.json(ret);
}));

// auth
router.all(P + '/AccceptReferralProgram{/:id}', auth, asyncHandler(async (req, res) => {
  const Sponsor = ''; // legacy overwrites the parameter with ""
  const PLID = Number(req.user.plid);
  const o = await db.procOne(DB, 'USP_NEWACCEPTREFERRALPROGRAM', { Sponser: Sponsor, PLID });
  const k = o && Object.keys(o).find((x) => x.toLowerCase() === 'result');
  const Result = k && o[k] !== null ? String(o[k]) : '';
  // PORT-NOTE: legacy used ExecuteSqlCommand's affected-row count (> 0) to start a background thread that only re-read Portal_Login
  // (its mail/SMS bodies are commented out), so that observable-effect-free thread is not reproduced.
  res.json(Result.toLowerCase());
}));

// auth
router.all(P + '/UpdateReferrel{/:id}', auth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  res.json(await new CommonClass().UpdateReferrel(PLID, req.p.ReferrelName));
}));

// auth
router.all(P + '/IsDefault{/:id}', auth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  res.json(await new CommonClass().IsDefault(PLID, req.p.ReferrelName));
}));

// auth
router.all(P + '/btnsendmail{/:id}', auth, asyncHandler(async (req, res) => {
  const plid = Number(req.user.plid);
  const { email1, SenderName } = req.p;
  let referallink = req.p.referallink;
  let ret = '0';
  referallink = 'http://login.qcxtoken.com/referral-signup' + nz(referallink);
  try {
    ret = '1';
    fire(() => sendmail(plid, email1, referallink, SenderName, req)); // background thread
  } catch (ExpObj) {
    ret = ExpObj.message;
    await errorInsert(ExpObj, 'btnsendmail', req);
  }
  res.json(ret);
}));

// auth
router.all(P + '/BtnSendSmsForReferAndEarn{/:id}', auth, asyncHandler(async (req, res) => {
  let { MobileNo } = req.p;
  const { Reflinks } = req.p;
  let ret = '0';
  try {
    if (MobileNo === undefined || MobileNo === null) throw new Error('Object reference not set to an instance of an object.');
    MobileNo = String(MobileNo).replace(/,+$/, '');
    MobileNo = MobileNo.replace(/^,+/, '');
    ret = '1';
    const m = MobileNo;
    fire(() => UtilityClass.SendMsgOnMobile(m, 'Hurry Up !!\r\nWe help you to earn money by refer link to your friends \r\n' + nz(Reflinks) + '\r\nFor more details visit Our Website'));
  } catch (ExpObj) {
    ret = ExpObj.message;
    await errorInsert(ExpObj, 'BtnSendSmsForReferAndEarn', req);
  }
  res.json(ret);
}));

module.exports = router;
