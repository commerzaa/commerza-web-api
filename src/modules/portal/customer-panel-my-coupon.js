'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyCoupon.cs (class MyCouponController => /portal/MyCoupon/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view } = require('./_shared/batch-06-common');

const router = express.Router();

/** Models/Coupon_Master.cs ([Table("DBO.Coupon_Master")]) */
const COUPON_MASTER_PROPS = ['CPID', 'PLID', 'COUPON_NUMBER', 'USEDBY', 'GENERATEDATE', 'AMOUNT', 'CURRENCYSYMBOL', 'CID', 'CANCELEDBY',
  'CANCELEDDATE', 'STATUS', 'REMARK'];

// ---------------------------------------------------------------- Index()
// auth (unguarded (Login)Session["Plid"] cast). RouteConfig entry "MyCoupon" is commented out.
router.all(['/portal/MyCoupon/Index{/:id}', '/portal/MyCoupon'], ps.customerAuth, asyncHandler(async (req, res) => {
  const PLID = Number(req.user.plid);
  // Db._Coupon_Master.Where(Obj => Obj.PLID == PLID).ToList()
  const rows = await db.query(DB, `SELECT cpid, plid, coupon_number, usedby, generatedate, amount, currencysymbol, cid, canceledby, canceleddate,
      status, remark FROM coupon_master WHERE plid = @PLID`, { PLID });
  const Coupon_MasterLi = mapRows(rows, COUPON_MASTER_PROPS);
  view(res, '~/Views/CustomerPanel/MyCoupon/Index.cshtml', Coupon_MasterLi);
}));

module.exports = router;
