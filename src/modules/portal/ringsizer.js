'use strict';
// Ported from ClusterofferShopingPortal\Controllers\ringsizer.cs (class ringsizerController)
// Database: shopping (Db_Shopping) - not used (static view).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'ringsizer';

// ---------------------------------------------------------------- Index() => return View("~/Views/RingSize/Index.cshtml")
// public (static outer page)
// route-config: "ring_size" -> ringsizer/Index
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`, '/portal/ring_size'],
  asyncHandler(async (req, res) => res.json({ view: '~/Views/RingSize/Index.cshtml' })));

module.exports = router;
