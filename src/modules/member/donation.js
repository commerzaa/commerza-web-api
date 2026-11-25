'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Donation.cs (DonationController) - 3 actions: Index, UpgradeRank, GenerateOTP */
const express = require('express');
const { queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Donation';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
// C# new Thread(delegate...) => fire and forget
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); };

// route-config: referral/AbNkEAlWVO7ysaKrSmu15lISTDonatiomBVvezU_plus_
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/AbNkEAlWVO7ysaKrSmu15lISTDonatiomBVvezU_plus_'], auth, asyncHandler(async (req, res) => {
  const plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_rankupgrademember', { rengo: plid });
  const MemberRank = mapRows(rows, ['RANKID']);
  const MaxRank = Number(await scalar(DB, 'select coalesce(max(rankid), 0) from tbl_memberrankachiver where regno = @plid', { plid }) || 0);
  sessionStore.set(req, 'HideClick', MemberRank.length); // TempData["HideClick"] (+ TempData.Keep())
  res.json({ MemberRank, MaxRank, HideClick: MemberRank.length });
}));

// auth (uses Session["Plid"])
router.all(`${P}/UpgradeRank{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = Number(req.p.Rank);
  if (req.p.Rank === undefined || req.p.Rank === null || req.p.Rank === '' || !Number.isInteger(r)) {
    throw new Error("The parameters dictionary contains a null entry for parameter 'Rank' of non-nullable type 'System.Int32'.");
  }
  const Rank = r;
  // OTPCODE bound but its validation is commented out in the legacy code
  const hc = sessionStore.get(req, 'HideClick'); // TempData["HideClick"]
  const Count = hc === undefined || hc === null ? 0 : Number(hc);
  let Upgrade = '';
  if (Rank === 1) {
    Upgrade = 'ACSSOCIATE';
  }
  // legacy quirk kept: the next chain is a separate if/else-if, so Rank 1 (and 0 / >6) end up as DIAMOND
  if (Rank === 2) {
    Upgrade = 'BRONZE';
  } else if (Rank === 3) {
    Upgrade = 'SILVER';
  } else if (Rank === 4) {
    Upgrade = 'GOLD';
  } else if (Rank === 5) {
    Upgrade = 'PEARL';
  } else if (Rank === 6) {
    Upgrade = 'RUBY';
  } else {
    Upgrade = 'DIAMOND';
  }
  if (Count + 1 !== Rank || Rank === 0) {
    return res.json("You can't Upgrade " + Upgrade);
  }
  let ReturnOutput = 'success';
  const PLID = Math.trunc(Number(req.user.plid));
  const procs = { 1: 'usp_firstlevelincome', 2: 'usp_secondlevelincome', 3: 'usp_thirdlevelincome', 4: 'usp_fourthlevelincome', 5: 'usp_fifthlevelincome', 6: 'usp_sixthlevelincome' };
  if (procs[Rank]) {
    const rows = await proc(DB, procs[Rank], { regno: PLID, rankid: Rank });
    const o = outv(rows, 'stroutput');
    if (o === undefined || o === null) throw new TypeError('Object reference not set to an instance of an object.');
    ReturnOutput = String(o);
  }
  const PLDetails = await queryOne(DB, 'select mobile, emailid, username from member_master where regno = @plid limit 1', { plid: PLID });
  if (PLDetails != null) {
    // legacy condition (MOBILE != null || MOBILE != "") is always true
    if (ReturnOutput === 'ok') {
      bg(() => UtilityClass.SendSMSWithAPI(PLDetails.mobile, 'Congratulations for your promotions as a ' + Upgrade, '1'));
    }
  }
  res.json(ReturnOutput);
}));

// auth (uses Session["plid"])
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const PLDetails = await queryOne(DB, 'select mobile, emailid, username from member_master where regno = @plid limit 1', { plid: Plid });
  if (PLDetails != null) {
    // legacy condition (MOBILE != null || MOBILE != "") is always true
    bg(() => UtilityClass.SendSMSWithAPI(PLDetails.mobile, 'Use this One Time Password ' + OTP + ' To Upgrade.', '1'));
    bg(async () => {
      // legacy condition (EMAILID != null || EMAILID != "") is always true
      await UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, 'Upgrade', 'Use this One Time Password ' + OTP + ' To Upgrade.', null, '', '');
    });
  }
  res.json('ok');
}));

module.exports = router;
