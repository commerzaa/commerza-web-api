'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Iframe_Manager.cs (class Iframe_ManagerController => /admin/Iframe_Manager/...)
// Database: none used.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');

const router = express.Router();
const C = 'Iframe_Manager';

// ---------------------------------------------------------------- ActionResult Index(MasterImageUpload ObjMasterImageUpload)
// auth (legacy had no session check; admin-panel page => protected)
// route-config: "AdminPanel/Iframe-Manager" -> Iframe_Manager/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Iframe-Manager'], adminAuth, asyncHandler(async (req, res) => {
  // ObjMasterImageUpload is bound but unused
  return res.json({ view: '~/Views/AdminPanel/Iframe_Manager/Index.cshtml' });
}));

module.exports = router;
