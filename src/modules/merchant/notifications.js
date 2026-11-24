'use strict';
/** Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/notifications.cs (notificationsController). DB: 'shopping' (Db_Shopping) */
const express = require('express');
const { proc, scalar, exec } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/notifications';
const guard = [auth, requireType('merchant')];
const NOTIFICATIONS_PROPS = ['TMNID', 'TMNTID', 'PLID', 'NOTIFICATIONDESCRIPTION', 'REFERENCEID', 'NOTIFICATIONDATE', 'Expecteddelivery', 'Prod_Images',
  'ISREAD', 'ACTIVE', 'OrderId', 'STATUS', 'INTSTATUS', 'Product_Name', 'NOTIFICATIONTYPE', 'OrderStatus', 'Product_Qty'];

// ---- Index ---------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
const indexHandler = asyncHandler(async (req, res) => {
  let { SearchField, fromDate, toDate } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchField == null) SearchField = '';
  const BranchId = Number(req.user.plid);
  const cnt = await scalar(DB, 'select count(1) from tbl_merchant_notifications where plid = @plid and active::int = 1', { plid: BranchId });
  const Notificationcount = parseInt(cnt === null || cnt === undefined ? 0 : cnt, 10) || 0;
  const rows = await proc(DB, 'usp_get_merchant_notifications', {
    plid: Math.trunc(BranchId), fromdate: fromDate, todate: toDate, notificationtype: SearchField,
  });
  // PORT-NOTE: @MESSAGE OUT is read from the "message" column of the first result row ('' when absent)
  const f = rows && rows[0];
  const mk = f ? Object.keys(f).find((k) => k.toLowerCase() === 'message') : undefined;
  const result = f && mk !== undefined && f[mk] !== null && f[mk] !== undefined ? String(f[mk]) : '';
  res.json({ Model: mapRows(rows, NOTIFICATIONS_PROPS), ViewBag: { status: result, Notificationcount } });
});
router.all([`${P}/Index{/:id}`, P], ...guard, indexHandler);
// route-config: merchant/my-notifications
router.all('/merchant/merchant/my-notifications', ...guard, indexHandler);

// ---- Markasread ----------------------------------------------------------------------------------------
// auth (legacy had no session check but updates the merchant's notifications)
router.all(`${P}/Markasread{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const TCNID = req.p.TCNID;
  await exec(DB, 'update tbl_merchant_notifications set isread = 1, isreaddate = fun_getcurrentdate() where tmnid = @tmnid', { tmnid: TCNID });
  res.json(true);
}));

module.exports = router;
