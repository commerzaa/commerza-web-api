'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\add_stock.cs (class add_stockController)
// Database: affiliate (Db_Affiliate).
// The 7 actions (Index, Getkitdetils, insertStockFromVendor, EditAddedStockFromVendor, DeleteAddedStockFromVendor, Fetch_ChallanNo, Taxtype)
// are identical to Add_Purchase_Stock.cs and live in ./_shared/batch02_stock.js (registerStockRoutes).
const express = require('express');
const { registerStockRoutes } = require('./_shared/batch02-stock');

const router = express.Router();

// route-config: "AdminPanel/add-stock" -> add_stock/Index
registerStockRoutes(router, 'add_stock', '~/Views/AdminPanel/add_stock/Index.cshtml', ['/admin/AdminPanel/add-stock']);

module.exports = router;
