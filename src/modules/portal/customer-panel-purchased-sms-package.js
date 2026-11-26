// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/PurchasedSMSPackage.cs (PurchasedSMSPackageController => /portal/PurchasedSMSPackage/...)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/PurchasedSMSPackage';
/** class PurchasedSMSPackageList */
const PROPS = ['Number', 'PurchasedDate', 'PackageName', 'Amount', 'Status'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// (route-config "user/purchased-sms-pack" is commented out in RouteConfig.cs)
router.all([`${P}/Index{/:id}`, P], ps.customerAuth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  // Convert(Varchar(11), PurchasedDate, 106) => 'dd Mon yyyy'
  const rows = await db.query(DB, `SELECT ROW_NUMBER() OVER (ORDER BY tuspm.tuspmid ASC) AS number,
      to_char(tuspm.purchaseddate, 'DD Mon YYYY') AS purchaseddate, tspm.packagename, tspm.amount,
      (CASE WHEN tspm.isactive::int = 1 THEN 'Active' ELSE 'Deactive' END) AS status
    FROM tbl_usersmspackmaster tuspm INNER JOIN tbl_smspackmaster tspm ON tuspm.tspmid = tspm.tspmid
    WHERE tuspm.plid = @PLID`, { PLID });
  const PurchasedSMSPackageListLi = mapRows(rows, PROPS);
  return view(res, '~/Views/CustomerPanel/PurchasedSMSPackage/Index.cshtml', PurchasedSMSPackageListLi);
}));

module.exports = router;
