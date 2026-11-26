// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\OrderComplete.cs
'use strict';
const DB = 'shopping';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const P = '/portal/OrderComplete';

/** class GetCompleteorder */
const PROPS = ['billadd', 'City', 'EmailID', 'MobileNo', 'Name', 'orderDate', 'orderID', 'orderType', 'orid', 'PayMode', 'PayRemark', 'PinCode',
  'Prod_Images', 'Product_Name', 'quntity', 'singleProdPrice', 'total_vat', 'total_DAP', 'total_cost', 'Total_Ship_Ch', 'total_purchase_cost',
  'Total_payble_vat', 'OrderQty', 'OrderTotalAmount', 'OrderTotalVat', 'OrderShippingCharges', 'totalPaybleAmt', 'BV', 'PV', 'prcode', 'sprid'];

/** string.Format("{0:dd MMM yyyy hh:mm tt}") */
function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n) => String(n).padStart(2, '0');
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return `${p(x.getDate())} ${M[x.getMonth()]} ${x.getFullYear()} ${p(h)}:${p(x.getMinutes())} ${x.getHours() < 12 ? 'AM' : 'PM'}`;
}
const nn = (v) => { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return v; };

// public ([CheckResellerTimeout] is a no-op)
// PORT-NOTE: in the legacy the friendly route "OrderComplete/{orderID}" was registered before the default route, so
//   /OrderComplete/Active reached Index(orderID="Active"); the explicit Active route is registered first here.
router.all(P + '/Active{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  res.json('ok');
}));

// public (order confirmation page after the gateway / checkout; legacy had no session check)
// route-config: OrderComplete/{orderID}
router.all([P + '/Index{/:orderID}', P + '/:orderID'], ps.callbackSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const orderID = req.p.orderID === undefined ? null : req.p.orderID;
  UtilityClass.Encryptword(orderID); // getorderiddemo (unused)
  ps.sessionSet(req, 'Cart', null);
  if (orderID == null) {
    return res.json({ redirect: 'product?category=All' });
  }
  let getorderid = await UtilityClass.Decryptword(orderID);
  getorderid = String(getorderid).replace(/^,+|,+$/g, '');
  const rows = await db.proc(DB, 'ordercomplete', { ORDERID: getorderid });
  const GetCompleteorderde = mapRows(rows, PROPS);
  for (const items of GetCompleteorderde) {
    ViewBag.orderID = items.orderID;
    ViewBag.orderDate = items.orderDate;
    if (String(nn(items.orderDate)).trim() !== '') ViewBag.orderDate = fmtDate(items.orderDate);
    ViewBag.mobile = items.MobileNo;
    ViewBag.emails = items.EmailID;
    ViewBag.name = items.Name;
    if (nn(items.City).trim() === '') ViewBag.billadd = items.billadd;
    else ViewBag.billadd = items.billadd + ', ' + items.City;
    ViewBag.pincode = items.PinCode;
    ViewBag.ship = items.Name;
    if (items.City.trim() === '') ViewBag.billadd1 = items.billadd;
    else ViewBag.billadd1 = items.billadd + ', ' + items.City;
    ViewBag.pincode1 = items.PinCode;
    ViewBag.mobile1 = items.MobileNo;
    ViewBag.emails1 = items.EmailID;
    ViewBag.orderID = items.orderID;
    return res.json({ Model: GetCompleteorderde, ViewBag, ...ViewBag });
  }
  ViewBag.IsStop = 'yes';
  res.json({ ViewBag, ...ViewBag });
}));

module.exports = router;
