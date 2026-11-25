'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/Passbook_mobileController.cs
// (class Passbook_mobileController => /portal/Passbook_mobile/...). Database: shopping (Db_Shopping).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const ps = require('./_shared/portal-session');
const { view, toInt32 } = require('./_shared/batch-06-common');

const router = express.Router();

// ---------------------------------------------------------------- Index()
// public: the session is optional in legacy (if (Session["Plid"] != null) ... else return View("~/")).
// route-config: "customer/passbook-mobile" -> Passbook_mobile/Index
router.all(['/portal/Passbook_mobile/Index{/:id}', '/portal/Passbook_mobile', '/portal/customer/passbook-mobile{/:id}'], ps.portalSession,
  asyncHandler(async (req, res) => {
    if (ps.isCustomer(req)) {
      const Plid = Number(req.user.plid);
      const ViewBag = {};
      let customerWallet_Statements = [];
      if (Plid !== 0) {
        ViewBag.UserWallet = await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid));
        customerWallet_Statements = await CutomerWalletProcess.GetCustomerWalletStatements(toInt32(Plid));
      }
      return view(res, '~/Views/CustomerPanel/Passbook_mobile/Index.cshtml', customerWallet_Statements, ViewBag);
    }
    // PORT-NOTE: legacy `return View("~/")` (no such view => MVC "view not found" error page). Returned as the view name only.
    return view(res, '~/');
  }));

module.exports = router;
