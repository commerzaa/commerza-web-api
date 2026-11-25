'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Coupon_Request.cs (Coupon_RequestController) */
const express = require('express');
const { query, queryOne, scalar, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const GetIP = require('../../lib/member/GetIP');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Coupon_Request';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e && e.message)); };

// EwalletType(): ViewBag.ewallet = usp_TypeofWallet @Mode=2
async function EwalletType() {
  const row = await procOne(DB, 'usp_typeofwallet', { mode: 2 });
  return row ? str(row[Object.keys(row)[0]]) : null;
}

// route-config: referral/9P1ssmoPPRy7o2vG5R3I7g==
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/9P1ssmoPPRy7o2vG5R3I7g=='], auth, asyncHandler(async (req, res) => {
  const ViewBag = { status: 0 };
  sessionStore.set(req, 'SessionOTP', null);
  ViewBag.ewallet = await EwalletType();
  const rows = await query(DB, "select TSMID,coalesce(subscriptionheading,'') as packages from TBL_SUBSCRIPTIONMASTER where ISACTIVE=true");
  res.json({ Model: mapRows(rows, ['TSMID', 'packages']), ViewBag });
}));

// auth
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const OTP = String(UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const UserName = req.user.userName || req.user.username;
  let Mobile = req.user.mobile;
  if (Mobile === undefined) {
    const mm = await queryOne(DB, 'select mobile from member_master where regno = @p limit 1', { p: Number(req.user.plid) });
    Mobile = mm ? mm.mobile : null;
  }
  // legacy condition (Mobile != null || Mobile != "") is always true
  const msg = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 1067 limit 1');
  if (!msg) throw NRE();
  Mobilestatus = msg.sms_send_status;
  if (Mobilestatus === 1) {
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(UserName, msg.sms_content, '', OTP, 55);
    bg(() => UtilityClass.SendSMSWithAPI(Mobile, messg, '1'));
  }
  if (Mobilestatus === 0) returnmessage = 'OTP BYPASS';
  else returnmessage = 'OTP SENT';
  res.json(returnmessage);
}));

// auth
router.all(`${P}/TotalNoOfCouponValue{/:id}`, auth, asyncHandler(async (req, res) => {
  const NoOfCoupon = parseInt(req.p.NoOfCoupon, 10);
  const PackageID = parseInt(req.p.PackageID, 10);
  const PackagAmt = Number(await scalar(DB, 'select coalesce(PRICE,0) as PRICE from TBL_SUBSCRIPTIONMASTER where TSMID=@t limit 1', { t: PackageID })) || 0;
  res.json(NoOfCoupon * PackagAmt);
}));

// auth
router.all(`${P}/SubmitCouponRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const NoOfCoupon = parseInt(req.p.NoOfCoupon, 10);
  const PackageID = parseInt(req.p.PackageID, 10);
  let OTPCODE = req.p.OTPCODE;
  const Plid = Number(req.user.plid);
  const msg = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 1067 limit 1');
  await queryOne(DB, 'select * from tbl_emailaction where EID = 5 limit 1');
  if (!msg) throw NRE();
  if (msg.sms_send_status === 1) {
    if (OTPCODE === null || OTPCODE === undefined) OTPCODE = '0';
    const so = sessionStore.get(req, 'SessionOTP');
    if (so === undefined || so === null) throw NRE();
    if (String(so) !== OTPCODE) return res.json('You have entered wrong OTP.');
  }
  const IpAddress = await GetIP.GetLocalIP(req);
  const out = await procOne(DB, 'usp_couppon_request', { regno: Plid, noofcoupon: NoOfCoupon, kid: PackageID, ip: IpAddress });
  const OutputResult = str(out && out.strresult);
  sessionStore.set(req, 'SessionOTP', null);
  res.json(OutputResult);
}));

// auth (public void action in legacy: sets ViewBag only)
router.all(`${P}/EwalletType{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json({ ViewBag: { ewallet: await EwalletType() } });
}));

module.exports = router;
