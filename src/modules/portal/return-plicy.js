'use strict';
// Ported from ClusterofferShopingPortal\Controllers\ReturnPlicyController.cs (class ReturnPlicyController)
// Database: shopping (Db_Shopping) - not used (static view).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'ReturnPlicy';

// ---------------------------------------------------------------- Index() => return View()
// public (static outer page)
// route-config: "return-policy" -> ReturnPlicy/Index
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`, '/portal/return-policy'],
  asyncHandler(async (req, res) => res.json({ view: `~/Views/${C}/Index.cshtml` })));

module.exports = router;
