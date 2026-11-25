'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_List.cs (class Member_ListController => /Member_List/...)
// Database: affiliate (Db_Affiliate) - no DB access.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');

const router = express.Router();
const C = 'Member_List';

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  return res.json({ view: '~/Views/Member_List/Index.cshtml' });
}));

module.exports = router;
