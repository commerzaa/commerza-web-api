'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Banner.cs (class BannerController => /Banner/...)
const express = require('express');

const router = express.Router();
const C = 'Banner';

// ---------------------------------------------------------------- Index()
// public (legacy had no session check; view only)
// route-config: "adminpanel/Banner" -> Banner/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/adminpanel/Banner'], (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Banner/Index.cshtml' });
});

module.exports = router;
