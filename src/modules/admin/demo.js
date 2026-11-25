'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\demoController.cs (class Common.Controllers.AdminPanel.demoController => /demo/...)
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'demo';

// ---------------------------------------------------------------- ActionResult index()
// public (legacy had no session check; static demo view, no data)
// route-config: "AdminPanel/demo" -> demo/index
router.all([`/admin/${C}/index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/demo'], asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/demo/index.cshtml', get: 'hello Rahul' });
}));

module.exports = router;
