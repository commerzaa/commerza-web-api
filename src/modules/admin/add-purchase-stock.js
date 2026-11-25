'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_Purchase_Stock.cs (class Add_Purchase_StockController)
// Database: affiliate (Db_Affiliate).
// The 7 actions (Index, Getkitdetils, insertStockFromVendor, EditAddedStockFromVendor, DeleteAddedStockFromVendor, Fetch_ChallanNo, Taxtype)
// are identical to add_stock.cs (only the view path and the upper-case spelling of USP_EDITADDEDSTOCKFROMVENDOR /
// USP_DELETEADDEDSTOCKFROMVENDOR and their parameter names differ) and live in ./_shared/batch02_stock.js (registerStockRoutes).
const express = require('express');
const { registerStockRoutes } = require('./_shared/batch02-stock');

const router = express.Router();

// route-config: "AdminPanel/Add-Purchase-Stock" -> Add_Purchase_Stock/Index
registerStockRoutes(router, 'Add_Purchase_Stock', '~/Views/AdminPanel/Add_Purchase_Stock/Index.cshtml', ['/admin/AdminPanel/Add-Purchase-Stock']);

module.exports = router;
