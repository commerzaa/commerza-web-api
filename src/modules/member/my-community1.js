'use strict';
// Ported from Member/Controllers/CustomerPanel/MyCommunity1.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
// legacy UnilevelTree (MyCommunity.cs) for Index, UnilevelTree1 for Gettreeview
const UnilevelTree = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'STATUS', 'ACTIVE', 'USERNAME'];
const UnilevelTree1 = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount'];

// auth (legacy: Session["Plid"] == null -> redirect Home/Index). route-config: url "referral/cL5gx38HZFIHtb4vLbMTsgFdjfj" (id optional)
router.all(['/member/MyCommunity1/Index{/:id}', '/member/MyCommunity1', '/member/referral/cL5gx38HZFIHtb4vLbMTsgFdjfj'], auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const rows = await query(DB, `SELECT PL.REGNO, PL.LOGINID,PL.PLID,coalesce(PL.INTRO_REFID,0) As INTRO_REFID,coalesce(PL.USERNAME,'') AS NAME,
PL.IMAGENAME AS IMAGENAME,to_char(PL.DOC,'DD-MM-YYYY') AS REGDATE ,MP.PPV,coalesce(MP.PDAP,0) AS PDAP,
(Select Count(1) From PORTAL_LOGIN Where IsReferralAccepted=1 AND INTRO_REFID=PL.PLID)As TotalDirectCount,
(Select Count(1) FROM FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(MM.LOGINID,0) WHERE LOGINID<> '')As TotalReferralCount
FROM PORTAL_LOGIN PL INNER JOIN MEMBER_MASTER MM ON MM.PLID=PL.PLID INNER JOIN MEMBER_PERFORMANCE MP ON MM.REGNO=MP.REGNO
WHERE MM.PLID=@Plid AND MM.IsReferralAccepted=1`, { Plid });
  res.json({ View: '~/Views/CustomerPanel/MyCommunity/Index.cshtml', Model: mapRows(rows, UnilevelTree), ViewBag: { RegNo: Plid } });
}));

// auth
router.all('/member/MyCommunity1/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const RegNo = req.p.RegNo;
  const rows = await query(DB, `SELECT PL.REGNO, PL.LOGINID,PL.PLID,PL.INTRO_REFID,coalesce(PL.USERNAME,'') AS NAME,
coalesce(PL.IMAGENAME,'')AS IMAGENAME,to_char(PL.DOC,'DD-MM-YYYY') AS REGDATE ,MP.PPV,coalesce(MP.PDAP,0) AS PDAP,
(Select Count(1) From PORTAL_LOGIN Where IsReferralAccepted=1 AND INTRO_REFID=PL.PLID)As TotalDirectCount,
(Select Count(1) FROM FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(MM.LOGINID,0) WHERE LOGINID<> '')As TotalReferralCount
FROM PORTAL_LOGIN PL INNER JOIN MEMBER_MASTER MM ON MM.PLID=PL.PLID INNER JOIN MEMBER_PERFORMANCE MP ON MP.REGNO=MM.REGNO
WHERE PL.INTRO_REFID=@RegNo AND MM.IsReferralAccepted=1`, { RegNo: RegNo == null ? null : Number(RegNo) });
  res.json(mapRows(rows, UnilevelTree1));
}));

module.exports = router;
