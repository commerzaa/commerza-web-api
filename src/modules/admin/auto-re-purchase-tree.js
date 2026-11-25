'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Auto_RePurchaseTree.cs (class Auto_RePurchaseTreeController => /Auto_RePurchaseTree/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, sv } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Auto_RePurchaseTree';

/** class Auto_PurchaseTree (defined in Auto_PurchaseTree.cs) */
const PROPS = ['RegNo', 'LoginId', 'Name', 'USERNAME', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS'];
/** SqlQuery<Int64>(...).FirstOrDefault() => first column of the first row, 0 when none */
const firstVal = (rows) => (rows && rows[0] ? Number(Object.values(rows[0])[0]) || 0 : 0);

// ---------------------------------------------------------------- Index(string username)
// auth
// route-config: "AdminPanel/auto-repurchase-tree" -> Auto_RePurchaseTree/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/auto-repurchase-tree'], adminAuth, asyncHandler(async (req, res) => {
  let username = sv(req.p.username);
  let Plid = 0;
  if (username === null) {
    username = '';
    Plid = 1;
  }
  if (Plid === 0) {
    Plid = firstVal(await db.proc(DB, 'USP_CREATELEVELTREE', { PLID: 0, USERNAME: username, MODE: 1 }));
  }
  const UnilevelTreeMatrix = mapRows(await db.proc(DB, 'USP_CREATELEVELTREEMATRIX_LEVEL', { PLID: Plid, USERNAME: username, MODE: 2 }), PROPS);
  return res.json({ view: '~/Views/AdminPanel/Auto_RePurchaseTree/Index.cshtml', Model: UnilevelTreeMatrix });
}));

// ---------------------------------------------------------------- JsonResult Gettreeview(string RegNo)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/Gettreeview{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATELEVELTREEMATRIX_LEVEL', { PLID: sv(req.p.RegNo), USERNAME: '', MODE: 5 });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserdetails(string username)
// auth (PORT-NOTE: legacy had NO session check on this member-tree lookup - protected here)
router.all(`/admin/${C}/GetUserdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CREATELEVELTREEMATRIX_LEVEL', { PLID: 0, USERNAME: sv(req.p.username), MODE: 4 });
  return res.json(mapRows(rows, PROPS));
}));

module.exports = router;
