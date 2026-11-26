// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\view_all_notifications.cs (class view_all_notificationsController => /portal/view_all_notifications/...)
'use strict';
// Database: shopping (Db_Shopping). [DistributerSessionExpireCheck] has an empty (commented-out) body in legacy: no extra check.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { mvcStr, toInt32, toStr, outOf } = require('./_shared/batch-03-common');
const { view } = require('./_shared/batch-06-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/view_all_notifications';

/** class Notifications */
const NOTIFICATIONS_PROPS = ['TCNID', 'POID', 'TCNTID', 'CLID', 'NOTIFICATIONDESCRIPTION', 'REFERENCEID', 'NOTIFICATIONDATE', 'Expecteddelivery',
  'Prod_Images', 'ISREAD', 'ACTIVE', 'OrderId', 'STATUS', 'INTSTATUS', 'Product_Name', 'TMID'];

/** T-SQL implicit varchar -> int conversion of a quoted literal ('' => 0); invalid text fails in PostgreSQL as in SQL Server */
const intLiteral = (v) => (toStr(v).trim() === '' ? 0 : toStr(v).trim());

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/view-all-notifications" -> view_all_notifications/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/view-all-notifications'], ps.customerAuth, asyncHandler(async (req, res) => {
  const clid = Number(req.user.plid);
  // legacy concatenated clid / TCNID into the SQL; bound parameters here
  const Notificationcount = toInt32(await db.scalar(DB,
    'select count(1) from tbl_customer_notifications where clid = @clid and active = 1', { clid }));
  // isnull(DATEDIFF(hour, ISREADDATE, dbo.FUN_GETCURRENTDATE()), 0): DATEDIFF counts hour boundaries crossed
  const datedifference = await db.query(DB, `select tcnid,
      coalesce((extract(epoch from (date_trunc('hour', fun_getcurrentdate()) - date_trunc('hour', isreaddate))) / 3600)::int, 0) as hours_difference
    from tbl_customer_notifications where clid = @clid and isread = 1`, { clid });
  // [USP_GETNOTIFICATIONS] @CLID,@MESSAGE out
  const rows = await db.proc(DB, 'usp_getnotifications', { clid: toInt32(clid) });
  const Notification = mapRows(rows, NOTIFICATIONS_PROPS);
  const result = toStr(outOf(rows, 'message')); // spOutput.Value.ToString() (DBNull => "")
  const ViewBag = { status: result, LoginID: clid, Notificationcount };
  for (const item of datedifference) {
    if (Number(item.hours_difference) > 23) {
      await db.exec(DB, 'update tbl_customer_notifications set active = 0, isreaddate = null where tcnid = @TCNID', { TCNID: item.tcnid });
    }
  }
  return view(res, '~/Views/UserPanel/view_all_notifications/Index.cshtml', Notification, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult Markasread(string TCNID)
// auth: legacy had no session check (any notification could be marked read by id); protected here (PORTING_GUIDE_MVC lesson 8).
router.all(`${C}/Markasread{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TCNID = mvcStr(req, 'TCNID');
  let Return = false;
  await db.exec(DB, 'update tbl_customer_notifications set isread = 1, isreaddate = fun_getcurrentdate() where tcnid = @TCNID',
    { TCNID: intLiteral(TCNID) });
  Return = true;
  return res.json(Return);
}));

module.exports = router;
