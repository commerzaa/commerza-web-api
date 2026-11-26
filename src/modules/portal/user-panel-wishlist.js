'use strict';
// Ported from ClusterofferShopingPortal\Controllers\UserPanel\Wishlist.cs (class WishlistController => /portal/Wishlist/...)
// Database: shopping (Db_Shopping; legacy DataBaseContext).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, col, requiredInt } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'Wishlist';

/** class AllUserwishList */
const ALL_USER_WISH_LIST = ['DAP', 'prodImages', 'prodTitle', 'rowNumber', 'shortDesc', 'Sprid', 'wlid', 'PV', 'BV', 'DID', 'IsOutOfStock', 'dist_BV', 'dist_PV'];

// ---------------------------------------------------------------- ActionResult Index(string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth ([SessionExpireCheck]; [DistributerSessionExpireCheck] = no check)
// route-config: "customer/wishlist" -> Wishlist/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/customer/wishlist'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  // SearchField/SearchValue/fromDate/toDate default to "" and are not used further by the legacy action
  const LoginId = req.user.plid;
  const DID = req.user.did;
  const rows = await db.proc(DB, 'USP_USER_WISH_LIST', { LoginID: LoginId, did: DID, mode: 1 });
  const objAllOrderList = mapRows(rows, ALL_USER_WISH_LIST);
  // ViewBag.TotalCount = spOutput.Value (Int64 or DBNull)
  const tc = col(rows && rows[0], 'TotalCount');
  const ViewBag = { TotalCount: tc === undefined ? null : tc };
  return res.json({ view: '~/Views/UserPanel/Wishlist/Index.cshtml', Model: objAllOrderList, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult RemoveWishListItem(int id)
// auth ([SessionExpireCheck])
// PORT-NOTE: legacy deletes any active wishlist row by wlid without checking that it belongs to the logged-in customer (kept).
router.all(`/portal/${C}/RemoveWishListItem{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const id = requiredInt(req.p.id, 'id', 'System.Web.Mvc.JsonResult RemoveWishListItem(Int32)');
  const LoginId = req.user.plid;
  const row = await db.queryOne(DB, 'select wlid from tbl_wishlist where wlid = @id and status = 1 limit 1', { id });
  if (row) {
    // EF: Remove(row) is pending; the Count() query runs before SaveChanges, so the removed row is still counted.
    const count = await db.scalar(DB, 'select count(*) from tbl_wishlist where loginid = @LoginId and status = 1', { LoginId: String(LoginId) });
    await db.exec(DB, 'delete from tbl_wishlist where wlid = @wlid', { wlid: row.wlid });
    return res.json('success' + Number(count) + '');
  }
  return res.json('failed');
}));

// ---------------------------------------------------------------- JsonResult WishlistCount()
// auth ([SessionExpireCheck])
router.all(`/portal/${C}/WishlistCount{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const LoginId = req.user.plid;
  const DID = req.user.did;
  const rows = await db.proc(DB, 'USP_USER_WISH_LIST', { LoginID: LoginId, did: DID, mode: 2 });
  // SqlQuery<int>(...).FirstOrDefault(): first column of the first row, 0 when no row
  let WishlistCount = 0;
  if (rows && rows[0]) {
    // the OUT parameter @TotalCount is not part of the legacy result set: skip that column
    const keys = Object.keys(rows[0]);
    const k = keys.find((x) => x.toLowerCase() !== 'totalcount') || keys[0];
    const v = rows[0][k];
    WishlistCount = v === null || v === undefined ? 0 : Number(v);
  }
  return res.json(WishlistCount);
}));

module.exports = router;
