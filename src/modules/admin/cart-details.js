'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CartDetails.cs (class CartDetailsController => /admin/CartDetails/...)
// Database: affiliate (Db_Affiliate) - not used (view-only controller).
const express = require('express');

const router = express.Router();
const C = 'CartDetails';

// ---------------------------------------------------------------- ActionResult Index()
// public (legacy had no session check; view only, no server-side data)
// route-config: "AdminPanel/Cart-Detail" -> CartDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Cart-Detail{/:id}'], (req, res) => {
  res.json({ view: '~/Views/AdminPanel/CartDetails/Index.cshtml' });
});

module.exports = router;
