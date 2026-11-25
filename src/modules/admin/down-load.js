'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DownLoad.cs (class DownLoadController, no namespace => /DownLoad/...)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'DownLoad';

// ---------------------------------------------------------------- ActionResult Index()
// public (legacy had no session check; view only, no server-side data)
// route-config: "adminpanel/DownLoad" -> DownLoad/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/adminpanel/DownLoad'], asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/DownLoad/Index.cshtml' });
}));

module.exports = router;
