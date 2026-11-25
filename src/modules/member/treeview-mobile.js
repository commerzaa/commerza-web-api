'use strict';
// Ported from Member\Controllers\CustomerPanel\treeview_mobile.cs (treeview_mobileController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/treeview_mobile';
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const sset = (req, k, v) => sessionStore.set(req, k.toLowerCase(), v);
const BIND = ['PARENTREGNO', 'CHILDREGNO', 'side', 'loginID', 'NAME', 'regNo', 'spID', 'SPNAME', 'RegDate', 'DOC', 'Title', 'leftMembers', 'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName', 'PBV', 'DLBV', 'DRBV', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV', 'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'USERNAME', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate', 'SPUSERNAME', 'FLUSHINCOME', 'GENDER', 'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'memStatus', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER'];

// route-config: referral/treeview-mobile
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/treeview-mobile'], ...guard, asyncHandler(async (req, res) => {
  const Regno = String(req.user.plid);
  const Name = req.user.name === undefined || req.user.name === null ? '' : String(req.user.name);
  res.json({ ViewBag: { RegNo: Regno, Name } });
}));

// auth
router.all(`${P}/bindParentId{/:id}`, ...guard, asyncHandler(async (req, res) => {
  sset(req, 'ParentID', req.p.parentRegno); // TempData["ParentID"]
  sset(req, 'side', parseInt(req.p.side, 10)); // TempData["side"]
  res.json('ok');
}));

// auth
router.all(`${P}/getmemberregno{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const mm = await db.queryOne(DB, 'select regno from member_master where loginid = @l limit 1', { l: req.p.Regno });
  if (!mm) throw NRE();
  res.json(mm.regno);
}));

// auth
router.all(`${P}/BindDetailsByUser{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_binddetailsbyusername', { USERNAME: req.p.username });
  res.json(mapRows(rows, BIND));
}));

// auth
router.all(`${P}/GetUserName{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Mode = parseInt(req.p.mode, 10);
  if (Number.isNaN(Mode)) throw new TypeError('Input string was not in a correct format.');
  const Regno = parseInt(req.user.plid, 10);
  const rows = await db.proc(DB, 'usp_getusername', { Regno, Mode });
  let UserName = rows && rows.length ? rows[0][Object.keys(rows[0])[0]] : null;
  if (UserName === null || UserName === undefined) UserName = 'N/A';
  res.json(UserName);
}));

module.exports = router;
