'use strict';
/** Port of Member/Controllers/CustomerPanel/SecondPhaseTreeView.cs (SecondPhaseTreeViewController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { query, queryOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');

const router = express.Router();
const DB = 'affiliate';

const reqInt = (name, v) => {
  const n = parseInt(v, 10);
  if (v === undefined || v === null || Number.isNaN(n)) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
    e.status = 400;
    throw e;
  }
  return n;
};

// route-config: referral/TQzVrV0o3J2c2FmEZnQtYQ==second-phase -> Index
// auth
router.all(['/member/SecondPhaseTreeView/Index{/:id}', '/member/referral/TQzVrV0o3J2c2FmEZnQtYQ==second-phase'], auth, asyncHandler(async (req, res) => {
  const Regno = String(req.user.plid);
  res.json({ view: '~/Views/CustomerPanel/SecondPhaseTreeView/Index.cshtml', ViewBag: { RegNo: Regno } });
}));

// auth (legacy had no session check but it writes per-user TempData)
router.all('/member/SecondPhaseTreeView/BindParentId{/:id}', auth, asyncHandler(async (req, res) => {
  const parentRegno = req.p.parentRegno;
  const side = reqInt('side', req.p.side);
  sessionStore.set(req, 'TempData.ParentID', parentRegno); // TempData["ParentID"]
  sessionStore.set(req, 'TempData.side', side); // TempData["side"]
  res.json('ok');
}));

// auth
router.all('/member/SecondPhaseTreeView/GetMemberRegno{/:id}', auth, asyncHandler(async (req, res) => {
  const Regno = req.p.Regno;
  const MemberList = await queryOne(DB, 'SELECT regno FROM member_master WHERE loginid=@regno LIMIT 1', { regno: Regno });
  // legacy: MemberList.REGNO => NullReferenceException (HTTP 500) when no member matches
  if (!MemberList) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(MemberList.regno);
}));

// auth
router.all('/member/SecondPhaseTreeView/BindTreeIcon{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, "SELECT COALESCE(type,'') AS TYPE ,COALESCE(img_male,'') AS IMG_MALE,COALESCE(img_female,'') AS IMG_FEMALE FROM tbl_treeicon");
  res.json(mapRows(rows, ['TYPE', 'IMG_MALE', 'IMG_FEMALE']));
}));

module.exports = router;
