'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\PageNotFoundController.cs (class PageNotFoundController => /admin/PageNotFound/...)
const express = require('express');

const router = express.Router();
const C = 'PageNotFound';

// ---------------------------------------------------------------- ActionResult Index()
// public
// route-config: "page-not-found" -> PageNotFound/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/page-not-found'], (req, res) => res.json({ view: '~/Views/PageNotFound/Index.cshtml' }));

module.exports = router;
