'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\F_Matrix_genology.cs (class F_Matrix_genologyController => /admin/F_Matrix_genology/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'F_Matrix_genology';

/** class UnilevelTreeMatrix (Controllers/AdminPanel/MyCommunity_Matrix.cs) */
const PROPS = ['RegNo', 'LoginId', 'USERNAME', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'NoOfChild', 'SPONSOR', 'PBV'];

// USP_GENEALOGY_FORCEMATRIX (@REGNO, @USERNAME, @MODE): the legacy EF text "USP_GENEALOGY_FORCEMATRIX @PLID,@USERNAME,@MODE" passed
// the first value positionally, so it is bound to @REGNO here.

// ---------------------------------------------------------------- Index(string Username)
// auth
// route-config: "AdminPanel/F-Matrix-genology" -> F_Matrix_genology/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/F-Matrix-genology'], adminAuth, asyncHandler(async (req, res) => {
  let Username = B.nStr(req.p.Username);
  const Plid = 1; // Convert.ToInt32(1)
  if (Username === null) Username = '';
  const ViewBag = {};
  ViewBag.RegNo = Plid;
  const ForceMatrix_Fileview = mapRows(await db.proc(DB, 'USP_GENEALOGY_FORCEMATRIX', { REGNO: Plid, USERNAME: Username, MODE: 1 }), PROPS);
  ViewBag.RegNo = Plid;
  return res.json({ view: '~/Views/AdminPanel/F_Matrix_genology/Index.cshtml', Model: ForceMatrix_Fileview, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GENEALOGY_FORCEMATRIX', { REGNO: B.nStr(req.p.RegNo), USERNAME: '', MODE: 2 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult Getparticularmember(string username)
// auth (PORT-NOTE: legacy had NO session check on this member lookup - protected here)
router.all(`/admin/${C}/Getparticularmember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GENEALOGY_FORCEMATRIX', { REGNO: 0, USERNAME: B.nStr(req.p.username), MODE: 3 });
  return res.json(mapRows(rows, PROPS));
}));

module.exports = router;
