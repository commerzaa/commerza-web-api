'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Cart.cs (class CartController => /admin/Cart/...)
// Database: affiliate (Db_Affiliate) - not used (view-only controller).
const express = require('express');

const router = express.Router();
const C = 'Cart';

// ---------------------------------------------------------------- ActionResult Index()
// public (legacy had no session check; view only, no server-side data)
// route-config: "AdminPanel/Cart" -> Cart/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Cart{/:id}'], (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Cart/Index.cshtml' });
});

module.exports = router;
