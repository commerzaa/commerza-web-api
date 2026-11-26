// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/PurchasedEmailPackage.cs (PurchasedEmailPackageController => /portal/PurchasedEmailPackage/...)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/PurchasedEmailPackage';
/** class PurchasedEmailList */
const PROPS = ['Number', 'PurchasedDate', 'PackageName', 'Amount', 'Status'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// (route-config "user/purchased-email-pack" is commented out in RouteConfig.cs)
router.all([`${P}/Index{/:id}`, P], ps.customerAuth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  // Convert(Varchar(11), PurchasedDate, 106) => 'dd Mon yyyy'; Status uses the user pack's IsActive (alias TUEPMID), as legacy
  const rows = await db.query(DB, `SELECT ROW_NUMBER() OVER (ORDER BY tuepmid.tuepmid ASC) AS number,
      to_char(tuepmid.purchaseddate, 'DD Mon YYYY') AS purchaseddate, tepm.packagename, tepm.amount,
      (CASE WHEN tuepmid.isactive::int = 1 THEN 'Active' ELSE 'Deactive' END) AS status
    FROM tbl_useremailpackmaster tuepmid INNER JOIN tbl_emailpackmaster tepm ON tuepmid.tepmid = tepm.tepmid
    WHERE tuepmid.plid = @PLID`, { PLID });
  const PurchasedEmailListLi = mapRows(rows, PROPS);
  return view(res, '~/Views/CustomerPanel/PurchasedEmailPackage/Index.cshtml', PurchasedEmailListLi);
}));

module.exports = router;
