'use strict';
// Ported from Member/Controllers/CustomerPanel/Auto_Generation_Tree.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc, procOne, queryOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
const UnilevelTreeMatrix1 = ['RegNo', 'LoginId', 'Name', 'ImageName', 'USERNAME', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'FNAME', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'PARENTUSERNAME'];
const firstValue = (rows) => (rows && rows[0] ? rows[0][Object.keys(rows[0])[0]] : null);

// auth (legacy: Session["PLID"] == null -> redirect Home/Index). route-config: url "referral/auto-gernation-tree"
router.all(['/member/Auto_Generation_Tree/Index{/:id}', '/member/Auto_Generation_Tree', '/member/referral/auto-gernation-tree'], auth, asyncHandler(async (req, res) => {
  let username = req.p.username;
  if (username == null) username = '';
  let Plid = Number(req.user.plid);
  if (username !== '') {
    const r = firstValue(await proc(DB, 'usp_createleveltree', { plid: 0, username, mode: 1 }));
    Plid = r == null ? 0 : Number(r); // FirstOrDefault() of Int64
  }
  const rows = await proc(DB, 'usp_creategernationtree_level', { plid: Plid, username, mode: 2 });
  res.json({ View: '~/Views/CustomerPanel/Auto_Generation_Tree/Index.cshtml', Model: mapRows(rows, UnilevelTreeMatrix1) });
}));

// auth (legacy had no session check but acts on the logged-in member's tree)
router.all('/member/Auto_Generation_Tree/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_creategernationtree_level', { plid: req.p.RegNo, username: '', mode: 5 });
  res.json(mapRows(rows, UnilevelTreeMatrix1));
}));

// auth
router.all('/member/Auto_Generation_Tree/GetUserdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_creategernationtree_level', { plid: 0, username: req.p.username, mode: 4 });
  res.json(mapRows(rows, UnilevelTreeMatrix1));
}));

// auth
router.all('/member/Auto_Generation_Tree/ChangeParentUser{/:id}', auth, asyncHandler(async (req, res) => {
  const { ParentUserName, UserName } = req.p;
  let Responce = '';
  if (ParentUserName !== '' && UserName !== '') { // null (absent) != "" is true in C#
    // EF: Db._Member_Master.Where(x => x.USERNAME == ParentUserName).FirstOrDefault()
    const row = await queryOne(DB, 'select * from member_master where username = @ParentUserName limit 1', { ParentUserName });
    if (row == null) {
      return res.json('Invalid Parent User!');
    }
    const out = await procOne(DB, 'usp_manullay_matrix_member', { username: UserName, parentusername: ParentUserName });
    Responce = out && out.stroutput != null ? String(out.stroutput) : '';
    if (Responce === 'success') return res.json('success');
    return res.json('Some Error Occurred');
  }
  return res.json("Parent User & Username Could't be Found please again refresh this page");
}));

module.exports = router;
