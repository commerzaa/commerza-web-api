'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SubscriptionHistory.cs (SubscriptionHistoryController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');

const router = express.Router();
const DB = 'shopping';
const PROPS = ['SNO', 'PuchaseDate', 'AllPackageName', 'ModeName', 'TotalPayableAmount', 'CommentORRemark', 'Status', 'TASMID'];

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: merchant/subscription-history -> SubscriptionHistory/Index
router.all(['/portal/SubscriptionHistory/Index{/:id}', '/portal/SubscriptionHistory', '/portal/merchant/subscription-history{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_managesubscriptionmaster', { mode: '2', plid: Plid });
  res.json({ view: '~/Views/CustomerPanel/SubscriptionHistory/Index.cshtml', Model: mapRows(rows, PROPS) });
}));

module.exports = router;
