'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Totalmember.cs (TotalmemberController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';

// public (no session check in legacy)
// route-config: "total-member"
router.all(['/member/Totalmember/Index{/:id}', '/member/total-member'], asyncHandler(async (req, res) => {
  const a = Number((await db.scalar(DB, 'select 10000 + count(1) from member_master where status::int = 1')) || 0);
  res.json({ view: '~/Views/CustomerPanel/Totalmember/Index.cshtml', ViewBag: { TotalMembercount: a } });
}));

module.exports = router;
