'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/TreeView.cs (TreeViewController)
const express = require('express');
const ps = require('./_shared/portal-session');

const router = express.Router();
const DB = 'shopping'; // eslint-disable-line no-unused-vars

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: referral/treeview -> TreeView/Index
router.all(['/portal/TreeView/Index{/:id}', '/portal/TreeView', '/portal/referral/treeview{/:id}'], ps.customerAuth, (req, res) => {
  const Regno = String(req.user.plid);
  res.json({ view: '~/Views/CustomerPanel/TreeView/Index.cshtml', RegNo: Regno });
});

// public (legacy: no session check, only writes TempData)
router.all('/portal/TreeView/bindParentId{/:id}', ps.portalSession, (req, res) => {
  const parentRegno = req.p.parentRegno === undefined ? null : req.p.parentRegno;
  const sideRaw = req.p.side;
  if (sideRaw === undefined || sideRaw === null || sideRaw === '') {
    // non-nullable int action parameter missing -> MVC threw ArgumentException
    throw new Error("The parameters dictionary contains a null entry for parameter 'side' of non-nullable type 'System.Int32'.");
  }
  const side = parseInt(sideRaw, 10);
  ps.tempDataSet(req, 'ParentID', parentRegno);
  ps.tempDataSet(req, 'side', side);
  res.json('ok');
});

module.exports = router;
