'use strict';
// Ported from Franchise\Controllers\CustomerPanel\OrderComplete.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const P = '/franchise/OrderComplete';
const PROPS = ['billadd', 'City', 'EmailID', 'MobileNo', 'Name', 'orderDate', 'orderID', 'orderType', 'orid', 'PayMode', 'PayRemark', 'PinCode',
  'Prod_Images', 'Product_Name', 'quntity', 'singleProdPrice', 'total_vat', 'total_DAP', 'total_cost', 'Total_Ship_Ch', 'total_purchase_cost',
  'Total_payble_vat', 'OrderQty', 'OrderTotalAmount', 'OrderTotalVat', 'OrderShippingCharges', 'totalPaybleAmt', 'BV', 'PV', 'Orderno'];

function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n) => String(n).padStart(2, '0');
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return `${p(x.getDate())} ${M[x.getMonth()]} ${x.getFullYear()} ${p(h)}:${p(x.getMinutes())} ${x.getHours() < 12 ? 'AM' : 'PM'}`;
}
const nn = (v) => { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return v; };

// auth
// route-config: franchisee/_plus_PD58cNACXK9I9p4KO3psA==/{orderID}
router.all([P + '/Index{/:orderID}', '/franchise/franchisee/_plus_PD58cNACXK9I9p4KO3psA==/:orderID'], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const orderID = req.p.orderID;
  const rows = await db.proc('shopping', 'newordercomplete', { ORDERID: orderID });
  const GetCompleteorderde = mapRows(rows, PROPS);
  for (const Items of GetCompleteorderde) {
    ViewBag.orderID = Items.orderID;
    ViewBag.orderDate = Items.orderDate;
    if (String(nn(Items.orderDate)).trim() !== '') ViewBag.orderDate = fmtDate(Items.orderDate);
    ViewBag.mobile = Items.MobileNo;
    ViewBag.emails = Items.EmailID;
    ViewBag.name = Items.Name;
    if (nn(Items.City).trim() === '') ViewBag.billadd = Items.billadd;
    else ViewBag.billadd = Items.billadd + ', ' + Items.City;
    ViewBag.pincode = Items.PinCode;
    ViewBag.ship = Items.Name;
    if (Items.City.trim() === '') ViewBag.billadd1 = Items.billadd;
    else ViewBag.billadd1 = Items.billadd + ', ' + Items.City;
    ViewBag.pincode1 = Items.PinCode;
    ViewBag.mobile1 = Items.MobileNo;
    ViewBag.emails1 = Items.EmailID;
    ViewBag.orderID = Items.orderID;
    return res.json({ Model: GetCompleteorderde, ViewBag, ...ViewBag });
  }
  ViewBag.IsStop = 'yes';
  res.json({ ViewBag, ...ViewBag });
}));

module.exports = router;
