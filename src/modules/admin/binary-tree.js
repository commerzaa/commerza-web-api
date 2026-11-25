'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_Tree.cs (class Binary_TreeController => /Binary_Tree/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, sv } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Binary_Tree';

/** class Binary_Details */
const PROPS = ['RegNo', 'EMAILID', 'LOGINID', 'NAME', 'SPID', 'SPNAME', 'PPV', 'ACTIVE', 'IMAGENAME', 'TOTAL_LPV', 'TOTAL_RPV', 'CURRENT_LPV',
  'CURRENT_RPV', 'PAIDPV', 'USERNAME', 'SPUSERNAME', 'REGDATE', 'DOC', 'PBV', 'DLBV', 'DRBV', 'GENDER', 'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT',
  'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'TOTALRIGHTMEMBER', 'TOTALLEFTMEMBER', 'PAIDBV', 'FLUSHBV', 'MEMSTATUS', 'SIDE', 'LEFTID', 'RIGHTID'];
/** SqlQuery<Int64>(...).FirstOrDefault() => first column of the first row, 0 when none */
const firstVal = (rows) => (rows && rows[0] ? Number(Object.values(rows[0])[0]) || 0 : 0);

// ---------------------------------------------------------------- Index(string username, string parentid)
// auth (PORT-NOTE: legacy Index had NO session check although it shows the member binary tree - protected here)
// route-config: "AdminPanel/MyCommunity-Matrix" -> Binary_Tree/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MyCommunity-Matrix'], adminAuth, asyncHandler(async (req, res) => {
  let username = sv(req.p.username);
  const parentid = sv(req.p.parentid);
  let Plid = 0;
  const ViewBag = {};
  if (username === null && parentid === null) {
    username = '';
    Plid = 1;
  } else if (username === '' && parentid !== '') {
    // Select Username from MEMBER_MASTER WHERE LOGINID='<parentid>'  (parameterised)
    const r = await db.queryOne(DB, 'select username from member_master where loginid = @parentid limit 1', { parentid });
    username = r ? Object.values(r)[0] : null;
  }
  ViewBag.ParentId = '';
  if (username !== '') {
    Plid = firstVal(await db.proc(DB, 'USP_BINARYTREE', { REGNO: 0, USERNAME: username, MODE: '0' }));
  }
  const Binary_Details = mapRows(await db.proc(DB, 'USP_BINARYTREE', { REGNO: Math.round(Number(Plid)), USERNAME: username, MODE: 1 }), PROPS);
  // Select ROOTID from MEMBER_MASTER WHERE REGNO='<Plid>'  (parameterised)
  const pr = await db.queryOne(DB, 'select rootid from member_master where regno = @Plid limit 1', { Plid });
  ViewBag.ParentId = pr ? Object.values(pr)[0] : null;
  return res.json({ view: '~/Views/AdminPanel/Binary_Tree/Index.cshtml', Model: Binary_Details, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_BINARYTREE', { REGNO: sv(req.p.RegNo), USERNAME: '', MODE: 2 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_BINARYTREE', { REGNO: 0, USERNAME: sv(req.p.username), MODE: 3 });
  return res.json(mapRows(rows, PROPS));
}));

module.exports = router;
