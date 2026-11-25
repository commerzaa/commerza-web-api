'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\F_MatrixTree.cs (class F_MatrixTreeController => /admin/F_MatrixTree/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'F_MatrixTree';

/** class UnilevelTreeMatrix (Controllers/AdminPanel/MyCommunity_Matrix.cs) */
const PROPS = ['RegNo', 'LoginId', 'USERNAME', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'NoOfChild', 'SPONSOR', 'PBV'];
/** SqlQuery<Int64>(...).FirstOrDefault() => first column of the first row, 0 when none */
const firstVal = (rows) => (rows && rows[0] ? Number(Object.values(rows[0])[0]) || 0 : 0);

// ---------------------------------------------------------------- Index(string username)
// auth
// route-config: "AdminPanel/F-MatrixTree" -> F_MatrixTree/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/F-MatrixTree'], adminAuth, asyncHandler(async (req, res) => {
  let username = B.nStr(req.p.username);
  let Plid = 0;
  if (username === null) {
    username = '';
    Plid = 1;
  }
  if (Plid === 0) {
    Plid = firstVal(await db.proc(DB, 'USP_CREATEFORCEMATRIXTREE', { PLID: 0, USERNAME: username, MODE: 1 }));
  }
  const UnilevelTreeMatrix = mapRows(await db.proc(DB, 'USP_CREATEFORCEMATRIXTREE', { PLID: Plid, USERNAME: username, MODE: 2 }), PROPS);
  return res.json({ view: '~/Views/AdminPanel/F_MatrixTree/Index.cshtml', Model: UnilevelTreeMatrix });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATEFORCEMATRIXTREE', { PLID: B.nStr(req.p.RegNo), USERNAME: '', MODE: 3 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (PORT-NOTE: legacy had NO session check on this member lookup - protected here)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATEFORCEMATRIXTREE', { PLID: 0, USERNAME: B.nStr(req.p.username), MODE: 4 });
  return res.json(mapRows(rows, PROPS));
}));

module.exports = router;
