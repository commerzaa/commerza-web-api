'use strict';
/** Port of Member/Controllers/CustomerPanel/MyCommunity_Matrix.cs (MyCommunity_MatrixController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { query } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

// UnilevelTreeMatrix (Controllers/CustomerPanel/LevelTree.cs): [property, isNumeric]
const TREE_PROPS = [['REGNO', 1], ['LoginId', 0], ['Name', 0], ['USERNAME', 0], ['SPONSOR', 0], ['ImageName', 0], ['Regdate', 0], ['PPV', 1], ['PDAP', 1],
  ['INTRO_REFID', 1], ['PLID', 1], ['TotalDirectCount', 1], ['TotalReferralCount', 1], ['Membername', 0], ['Activationdate', 0], ['MOBILE', 0], ['EMAILID', 0],
  ['ACTIVE', 1], ['STATUS', 1], ['Downlinecount', 1], ['RANKID', 1]];
const SQL = `SELECT mm.regno AS REGNO,(mm.username) AS NAME,(mm.fname) AS FNAME,(mm2.username) AS SPONSERNAME,(mm2.fname) AS SPONSERFNAME,COALESCE(mm.imagename,'') AS IMAGENAME,
mm.status::int AS STATUS,mm.active::int AS ACTIVE
FROM member_master mm INNER JOIN member_master mm1 ON mm.rootid=mm1.loginid INNER JOIN member_master mm2 ON mm.sponserid=mm2.loginid
WHERE mm.rootid=(SELECT loginid FROM member_master WHERE regno=@regno)`;

/** SqlQuery<UnilevelTreeMatrix>: selected columns map by (case-insensitive) name; the other model properties keep the C# defaults (0 / null);
 *  FNAME, SPONSERNAME and SPONSERFNAME are not model properties and are dropped. */
function toModel(rows) {
  return rows.map((r) => {
    const o = {};
    for (const [p, isNum] of TREE_PROPS) {
      const k = Object.keys(r).find((x) => x.toLowerCase() === p.toLowerCase());
      o[p] = k !== undefined ? r[k] : (isNum ? 0 : null);
    }
    return o;
  });
}

// route-config: referral/cL5gx38HZFIHtb4vLbMTsgaa== -> Index (id optional)
// auth
router.all(['/member/MyCommunity_Matrix/Index{/:id}', '/member/referral/cL5gx38HZFIHtb4vLbMTsgaa=={/:id}'], auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const rows = await query(DB, SQL, { regno: Plid });
  res.json({ view: '~/Views/CustomerPanel/MyCommunity_Matrix/Index.cshtml', Model: toModel(rows), ViewBag: { RegNo: Plid } });
}));

// auth
router.all('/member/MyCommunity_Matrix/GetHierarchy{/:id}', auth, asyncHandler(async (req, res) => {
  const RegNo = req.p.RegNo;
  const rows = await query(DB, SQL, { regno: RegNo });
  res.json(toModel(rows));
}));

module.exports = router;
