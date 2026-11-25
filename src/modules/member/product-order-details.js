'use strict';
// Ported from Member\Controllers\CustomerPanel\ProductOrderDetails.cs (ProductOrderDetailsController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/ProductOrderDetails';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const ORDER_PROPS = ['RowNumber', 'POMID', 'OrderId', 'TotalOrder', 'Date', 'Paymode', 'Mobile', 'Address', 'Amount', 'BV', 'GSTCharges', 'GSTAMOUNT', 'RBV', 'Status', 'PRODUCTNAME', 'IMAGES', 'TOTALPAYBLE', 'DP', 'DISCOUNT', 'GSTPER', 'MRP', 'QUANTITY', 'SHIPPINGCHARGE', 'PaymentStatus', 'REMARK', 'DocKetNo'];
const STATUS_PROPS = ['ORDERID', 'ORDERDATE', 'DOCKETNO', 'SHIPBY', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCEL', 'STATUS'];

// route-config: referral/NqIw1BbAL2Ins_plus_to_plus_bAfzZ0eX98MP0ci
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/NqIw1BbAL2Ins_plus_to_plus_bAfzZ0eX98MP0ci'], ...guard, asyncHandler(async (req, res) => {
  let { ProductName, OrderId, fromDate, toDate, WalletTypeName } = req.p;
  let Obj = [];
  try {
    if (fromDate === undefined || fromDate === null) fromDate = '';
    if (toDate === undefined || toDate === null) toDate = '';
    if (ProductName === undefined || ProductName === null) ProductName = '';
    if (OrderId === undefined || OrderId === null) OrderId = '';
    if (WalletTypeName === undefined || WalletTypeName === null) WalletTypeName = '';
    const Plid = Number(req.user.plid);
    const rows = await db.proc(DB, 'usp_productorderdetails', {
      Plid, ProductName, OrderId, FromDate: fromDate, ToDate: toDate, WalletType: WalletTypeName,
    });
    Obj = mapRows(rows, ORDER_PROPS);
  } catch (Exp) {
    // legacy: Response.Redirect("/page-not-found") executed first (the ErrorInsert code after it never ran)
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj });
}));

// auth
router.all(`${P}/CancelProduct{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { Id, Amount } = req.p;
  const rows = await db.proc(DB, 'usp_cancelproduct', { OrderID: Id, Amount: Number(Amount) });
  const o = outv(rows, 'result');
  if (o === undefined || o === null) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(String(o));
}));

// auth
router.all(`${P}/orderdetails{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_orderdetails_status', { ORDERNO: req.p.OrderId });
  res.json(mapRows(rows, STATUS_PROPS));
}));

module.exports = router;
