'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AdLinksManagement.cs (class AdLinksManagementController => /portal/AdLinksManagement/...)
// Database: shopping (Db_Shopping). (RouteConfig entry for AdLinksManagement is commented out.)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/AdLinksManagement';

/** class AdedLinks */
const ADED_LINKS = ['RowNumber', 'URL', 'TATBID', 'AddedDate', 'Button', 'PLID'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${C}/Index{/:id}`, C], ps.customerAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'Usp_ClickManagements', { Mode: '1', Plid: req.user.plid });
  const LiAdedLinks = mapRows(rows, ADED_LINKS);
  return view(res, '~/Views/CustomerPanel/AdLinksManagement/Index.cshtml', LiAdedLinks);
}));

module.exports = router;
