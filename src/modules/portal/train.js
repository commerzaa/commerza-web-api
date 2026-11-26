'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Train.cs (class TrainController => /portal/Train/...)
// Database: none used.
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();
const C = 'Train';

// ---------------------------------------------------------------- ActionResult Index()
// public ([CheckResellerTimeout] = no check)
// route-config: "Train" -> Train/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.CheckResellerTimeout, (req, res) => {
  res.json({ view: '~/Views/Train/Index.cshtml' });
});

module.exports = router;
