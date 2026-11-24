'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/TreeView.cs (TreeViewController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc, query, queryOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');

const router = express.Router();
const DB = 'affiliate';

const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return null;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : f[k];
};

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/binary-tree  (TreeView / Index, optional id)
// auth
router.all(['/member/TreeView/Index{/:id}', '/member/referral/binary-tree{/:id}'], auth, asyncHandler(async (req, res) => {
  const Regno = String(req.user.plid);
  return res.json({ view: '~/Views/CustomerPanel/TreeView/Index.cshtml', ViewBag: { RegNo: Regno } });
}));

// ---- BindParentId --------------------------------------------------------------------------------------
// TempData["ParentID"] / TempData["side"] kept in the server-side store
// auth (stores per-user state; legacy had no session check)
router.all('/member/TreeView/BindParentId{/:id}', auth, asyncHandler(async (req, res) => {
  const parentRegno = req.p.parentRegno;
  const side = parseInt(req.p.side, 10);
  sessionStore.set(req, 'ParentID', parentRegno === undefined ? null : parentRegno);
  sessionStore.set(req, 'side', Number.isNaN(side) ? null : side);
  return res.json('ok');
}));

// ---- GetMemberRegno ------------------------------------------------------------------------------------
// auth (legacy had no session check but it reads member data on behalf of a logged-in member)
router.all('/member/TreeView/GetMemberRegno{/:id}', auth, asyncHandler(async (req, res) => {
  const Regno = req.p.Regno;
  const Objmm = await queryOne(DB, 'SELECT REGNO FROM member_master WHERE LOGINID = @Regno LIMIT 1', { Regno });
  // legacy: Objmm.REGNO throws NullReferenceException when no row (=> 500)
  if (!Objmm) throw new Error('Object reference not set to an instance of an object.');
  return res.json(Objmm.regno);
}));

// ---- BindTreeIcon --------------------------------------------------------------------------------------
// auth
router.all('/member/TreeView/BindTreeIcon{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, "SELECT coalesce(TYPE,'') AS TYPE, coalesce(IMG_MALE,'') AS IMG_MALE, coalesce(IMG_FEMALE,'') AS IMG_FEMALE FROM TBL_TREEICON");
  return res.json(mapRows(rows, ['TYPE', 'IMG_MALE', 'IMG_FEMALE']));
}));

// ---- GetPerticularUnsettledBusiness --------------------------------------------------------------------
// auth
router.all('/member/TreeView/GetPerticularUnsettledBusiness{/:id}', auth, asyncHandler(async (req, res) => {
  const username = req.p.username;
  const m = await queryOne(DB, 'SELECT LOGINID FROM member_master WHERE USERNAME = @username LIMIT 1', { username });
  const LoginId = m ? m.loginid : null;
  // PORT-NOTE: @TATALLEFTVALUE / @TATALRIGHTVALUE OUT params are read from the first result row (columns tatalleftvalue, tatalrightvalue).
  const rows = await proc(DB, 'unsettled_business', { loginid: LoginId });
  let TotalLeftValume;
  let TotalRightValume;
  if (rows.length > 0) {
    TotalLeftValume = String(Number(outOf(rows, 'TATALLEFTVALUE')));
    TotalRightValume = String(Number(outOf(rows, 'TATALRIGHTVALUE')));
  } else {
    TotalLeftValume = 0;
    TotalRightValume = 0;
  }
  return res.json({ LeftBusiness: TotalLeftValume, RighBusiness: TotalRightValume });
}));

module.exports = router;
