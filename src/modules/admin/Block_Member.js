'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Block_Member.cs (class Block_MemberController => /admin/Block_Member/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { outVal, str, sp } = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Block_Member';

// ---------------------------------------------------------------- ViewResult Index()
// public (legacy had no session check; view only, no data)
// route-config: "AdminPanel/Block-Member" -> Block_Member/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Block-Member{/:id}'], asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Block_Member/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult BlockMembers(string mid, string type)
// auth (PORT-NOTE: legacy had no session check but it blocks/unblocks members => adminAuth)
router.all(`/admin/${C}/BlockMembers{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const mid = sp(req, 'mid');
  const type = sp(req, 'type');
  const regno = await UtilityClass.GetRegNoFromLoginId(mid);
  if (Number(regno) !== 0) {
    // dbo.ups_blockmember @regno,@type,@result out
    const rows = await db.proc(DB, 'ups_blockmember', { regno, type });
    const OutputResult = str(outVal(rows, 'result'));
    return res.json(OutputResult);
  }
  return res.json('Error');
}));

module.exports = router;
