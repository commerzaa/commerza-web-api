'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/GeneologyDetails.cs  (GeneologyDetailsController, 6 actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid / req.user.username ; TempData["ParentID"]/["side"] -> utils/sessionStore 'TempData.ParentID' / 'TempData.side'
const express = require('express');
const router = express.Router();
const { queryOne, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');

const DB = 'affiliate';
const BASE = '/member/GeneologyDetails';
const BIND_PROPS = ['PARENTREGNO', 'CHILDREGNO', 'side', 'loginID', 'NAME', 'regNo', 'spID', 'SPNAME', 'RegDate', 'DOC', 'Title', 'leftMembers', 'rightMembers', 'directMembers',
  'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName', 'PBV', 'DLBV', 'DRBV', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV',
  'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV', 'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'USERNAME', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate', 'SPUSERNAME', 'FLUSHINCOME', 'GENDER',
  'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'memStatus', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER'];
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };

// Index
// route-config: referral/TQzVrV0o3J2c2FmEZnQtYQtr==  (id optional)
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/TQzVrV0o3J2c2FmEZnQtYQtr=={/:id}'], auth, asyncHandler(async (req, res) => {
  const Regno = String(req.user.plid);
  const Name = req.user.username === undefined || req.user.username === null ? '' : String(req.user.username);
  res.json({ view: '~/Views/CustomerPanel/GeneologyDetails/Index.cshtml', ViewBag: { RegNo: Regno, Name } });
}));

// bindParentId(string parentRegno, int side): TempData for the next request (no session check in C#; per-user store => auth)
// auth
router.all(`${BASE}/bindParentId{/:id}`, auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'TempData.ParentID', req.p.parentRegno);
  sessionStore.set(req, 'TempData.side', parseInt(req.p.side, 10));
  res.json('ok');
}));

// getmemberregno(string Regno): C# dereferences a null member (NullReferenceException => 500) when LOGINID is unknown
// auth
router.all(`${BASE}/getmemberregno{/:id}`, auth, asyncHandler(async (req, res) => {
  const mm = await queryOne(DB, 'select regno from member_master where loginid = @regno limit 1', { regno: req.p.Regno });
  if (!mm) throw new Error('Object reference not set to an instance of an object.');
  res.json(mm.regno);
}));

// BindDetailsByUser(string username)
// auth
router.all(`${BASE}/BindDetailsByUser{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_binddetailsbyusername_loginid', { login_id: req.p.username });
  res.json(mapRows(rows, BIND_PROPS));
}));

// GetUserName(string mode): SqlQuery<string> => first column of the first row
// auth
router.all(`${BASE}/GetUserName{/:id}`, auth, asyncHandler(async (req, res) => {
  const Mode = Number(req.p.mode);
  if (req.p.mode === undefined || req.p.mode === null || req.p.mode === '' || !Number.isInteger(Mode)) throw new Error('Input string was not in a correct format.');
  const Regno = parseInt(req.user.plid, 10);
  const rows = await proc(DB, 'usp_getusername', { regno: Regno, mode: Mode });
  let UserName = rows.length ? rows[0][Object.keys(rows[0])[0]] : null;
  if (UserName === null || UserName === undefined) UserName = 'N/A';
  res.json(UserName);
}));

// GetPerticularUnsettledBusiness(string username)
// auth
router.all(`${BASE}/GetPerticularUnsettledBusiness{/:id}`, auth, asyncHandler(async (req, res) => {
  const m = await queryOne(DB, 'select loginid from member_master where username = @username limit 1', { username: req.p.username });
  const LoginId = m ? m.loginid : null;
  // PORT-NOTE: @TATALLEFTVALUE / @TATALRIGHTVALUE OUT are read from the first result row
  const rows = await proc(DB, 'unsettled_business', { loginid: LoginId });
  let TotalLeftValume;
  let TotalRightValume;
  if (rows.length > 0) {
    TotalLeftValume = String(Number(outv(rows[0], 'tatalleftvalue')));
    TotalRightValume = String(Number(outv(rows[0], 'tatalrightvalue')));
  } else {
    TotalLeftValume = 0;
    TotalRightValume = 0;
  }
  res.json({ LeftBusiness: TotalLeftValume, RighBusiness: TotalRightValume });
}));

module.exports = router;
