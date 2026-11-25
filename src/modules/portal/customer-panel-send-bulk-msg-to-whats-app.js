'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\SendBulkMsgToWhatsApp.cs (class SendBulkMsgToWhatsAppController => /portal/SendBulkMsgToWhatsApp/...)
// Database: shopping (Db_Shopping). The friendly URL "user/sendbulkmsgtowhatsapp" is commented out in RouteConfig.cs.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');

const router = express.Router();
const C = '/portal/SendBulkMsgToWhatsApp';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${C}/Index{/:id}`, C], ps.customerAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/SendBulkMsgToWhatsApp/Index.cshtml' });
}));

module.exports = router;
