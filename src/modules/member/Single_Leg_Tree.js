'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Single_Leg_Tree.cs (Single_Leg_TreeController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const DB = 'affiliate';
const UnilevelTree = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'ACTIVE', 'STATUS'];

// route-config: referral/single-leg-tree -> Single_Leg_Tree/Index
// auth
router.all(['/member/Single_Leg_Tree/Index{/:id}', '/member/referral/single-leg-tree'], auth, asyncHandler(async (req, res) => {
  const Plid = parseInt(req.user.plid, 10);
  const rows = await db.query(DB, `SELECT PL.REGNO, PL.LOGINID,coalesce(PL.USERNAME,'') AS NAME,
    PL.IMAGENAME AS IMAGENAME,to_char(PL.DOC,'DD-MM-YYYY') AS REGDATE ,MP.PPV,coalesce(MP.PDAP,0) AS PDAP,
    (Select Count(1) From MEMBER_MASTER Where IsReferralAccepted=1) As TotalDirectCount,
    (Select Count(1) FROM FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(MM.LOGINID,0) WHERE LOGINID!= '') As TotalReferralCount
    FROM MEMBER_MASTER PL INNER JOIN MEMBER_MASTER MM ON MM.REGNO=PL.REGNO INNER JOIN MEMBER_PERFORMANCE MP ON MM.REGNO=MP.REGNO
    WHERE MM.REGNO=@plid AND MM.IsReferralAccepted=1`, { plid: Plid });
  res.json({ Model: mapRows(rows, UnilevelTree), RegNo: Plid });
}));

// auth
router.all('/member/Single_Leg_Tree/Gettreeview{/:id}', auth, asyncHandler(async (req, res) => {
  const rootid = await db.scalar(DB, "SELECT coalesce(LOGINID,'') AS LOGINID FROM MEMBER_MASTER WHERE REGNO=@regno limit 1", { regno: req.p.RegNo });
  const rows = await db.query(DB, `SELECT PL.REGNO, PL.LOGINID,PL.PLID,PL.INTRO_REFID,coalesce(PL.USERNAME,'') AS NAME,
    coalesce(PL.IMAGENAME,'') AS IMAGENAME,to_char(PL.DOC,'DD-MM-YYYY') AS REGDATE ,MP.PPV,coalesce(MP.PDAP,0) AS PDAP,
    (Select Count(1) From PORTAL_LOGIN Where IsReferralAccepted=1 AND INTRO_REFID=PL.PLID) As TotalDirectCount,
    (Select Count(1) FROM FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(MM.LOGINID,0) WHERE LOGINID!= '') As TotalReferralCount
    FROM PORTAL_LOGIN PL INNER JOIN MEMBER_MASTER MM ON MM.PLID=PL.PLID INNER JOIN MEMBER_PERFORMANCE MP ON MP.REGNO=MM.REGNO
    WHERE MM.ROOTID=@rootid AND MM.IsReferralAccepted=1`, { rootid });
  res.json(mapRows(rows, UnilevelTree));
}));

module.exports = router;
