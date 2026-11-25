'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Auto_Matrix_Genelogy.cs (class Auto_Matrix_GenelogyController => /Auto_Matrix_Genelogy/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const { DB, sv } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Auto_Matrix_Genelogy';

/** class UnilevelTreeMatrix (Controllers/AdminPanel/MyCommunity_Matrix.cs) */
const PROPS = ['RegNo', 'LoginId', 'USERNAME', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'NoOfChild', 'SPONSOR', 'PBV'];

// ---------------------------------------------------------------- Index(string Username)
// auth
// route-config: "AdminPanel/Auto-Matrix-Genelogy" -> Auto_Matrix_Genelogy/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Auto-Matrix-Genelogy'], adminAuth, asyncHandler(async (req, res) => {
  const Plid = 1;
  let Username = sv(req.p.Username);
  if (Username === null) Username = '';
  const ViewBag = {};
  ViewBag.RegNo = Plid;
  const ForceMatrix_Fileview = mapRows(await db.proc(DB, 'USP_GENEALOGY_AUTOMATRIX', { PLID: Plid, USERNAME: Username, MODE: 1 }), PROPS);
  ViewBag.RegNo = Plid;
  return res.json({ view: '~/Views/AdminPanel/Auto_Matrix_Genelogy/Index.cshtml', Model: ForceMatrix_Fileview, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GENEALOGY_AUTOMATRIX', { PLID: sv(req.p.RegNo), USERNAME: '', MODE: 2 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult Getparticularmember(string username)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Getparticularmember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GENEALOGY_AUTOMATRIX', { PLID: 0, USERNAME: sv(req.p.username), MODE: 3 });
  // PORT-NOTE: legacy named the 1st positional argument @REGNO ("USP_GENEALOGY_AUTOMATRIX @REGNO,@USERNAME,@MODE"); it binds to the proc's @PLID.
  return res.json(mapRows(rows, PROPS));
}));

module.exports = router;
