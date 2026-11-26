'use strict';
// Ported from ClusterofferShopingPortal\Controllers\termandcondition.cs (class termandconditionController => /portal/termandcondition/...)
// Database: none used.
const express = require('express');

const router = express.Router();
const C = 'termandcondition';

// ---------------------------------------------------------------- ActionResult Index()
// public (no session check)
// route-config: "terms_and_condition" -> termandcondition/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/terms_and_condition'], (req, res) => {
  res.json({ view: '~/Views/termandcondition/Index.cshtml' });
});

module.exports = router;
