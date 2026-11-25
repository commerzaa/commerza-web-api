'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Level_Tree2.cs (class Level_Tree2Controller => /Level_Tree2/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'Level_Tree2';

/** class UnilevelTreeMatrix (Controllers/AdminPanel/MyCommunity_Matrix.cs) */
const PROPS = ['RegNo', 'LoginId', 'USERNAME', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'NoOfChild', 'SPONSOR', 'PBV'];

// ---------------------------------------------------------------- [SessionExpireCheck] Index(string username, string parentid)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Level-Tree2" -> Level_Tree2/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Level-Tree2'], adminAuth, asyncHandler(async (req, res) => {
  // PORT-NOTE: MVC binds "" as null for string params, so the legacy `username == ""` branch only fires when a raw "" reaches
  // the action; here the raw request value is used so that branch is reachable exactly when the client sends username="".
  let username = req.p.username === undefined ? null : req.p.username;
  const parentid = req.p.parentid === undefined || req.p.parentid === '' ? null : req.p.parentid;
  let Plid = 0;
  if (username === null && parentid === null) {
    username = '';
    Plid = 1;
  } else if (username === '' && parentid !== '') {
    // Select Username from MEMBER_MASTER WHERE LOGINID='<parentid>'  (parameterised)
    username = await db.scalar(DB, 'select username from member_master where loginid = @parentid limit 1', { parentid });
  }
  const ViewBag = {};
  ViewBag.ParentId = '';
  if (Plid === 0) {
    const r = await db.procOne(DB, 'USP_CREATELEVELTREE', { PLID: 0, USERNAME: username, MODE: 1 });
    const v = r ? r[Object.keys(r)[0]] : null;
    Plid = v === null || v === undefined ? 0 : Number(v);
  }
  const UnilevelTreeMatrix = mapRows(await db.proc(DB, 'USP_CREATELEVELTREEMATRIX_LEVEL', { PLID: Plid, USERNAME: username, MODE: 2 }), PROPS);
  // Select SPONSERID from MEMBER_MASTER WHERE REGNO='<Plid>'
  ViewBag.ParentId = await db.scalar(DB, 'select sponserid from member_master where regno::text = @Plid limit 1', { Plid: String(Plid) });
  return res.json({ view: '~/Views/AdminPanel/Level_Tree2/Index.cshtml', Model: UnilevelTreeMatrix, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had no session check - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATELEVELTREEMATRIX_LEVEL', { PLID: nStr(req.p.RegNo), USERNAME: '', MODE: 3 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (PORT-NOTE: legacy had no session check - protected here)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATELEVELTREEMATRIX_LEVEL', { PLID: 0, USERNAME: nStr(req.p.username), MODE: 4 });
  return res.json(mapRows(rows, PROPS));
}));

module.exports = router;
