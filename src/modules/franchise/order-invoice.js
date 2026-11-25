'use strict';
// Ported from Franchise\Controllers\CustomerPanel\OrderInvoice.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/OrderInvoice';
const PROPS = ['ROWNUMBER', 'ORID', 'POID', 'orderID', 'PAYMODE', 'Name', 'BILLADD', 'CITY', 'COUNTRY', 'STATE', 'PINCODE', 'EMAILID', 'MOBILE',
  'INVOICENO', 'INVOICE_DATE', 'ORDER_DATE', 'QUANTITY', 'COMPANYNAME', 'PICK_STATE', 'PICK_CITY', 'PICK_AREA', 'PICK_PINCODE', 'PICK_ADDRESS',
  'PICK_COUNTRY', 'GSTNO', 'PayRemark', 'PRODUCT_NAME', 'TOTAL_COST', 'TOTAL_VAT', 'TOTAL_PURCHASE_COST', 'singleProdPrice', 'total_DAP',
  'Total_Ship_Ch', 'Total_payble_vat', 'VatTitle', 'VatPercValue', 'ORDERNO', 'MORDERID', 'PANNO', 'CINNO'];

// {0:dd MMM yyyy hh:mm tt}
function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n) => String(n).padStart(2, '0');
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return `${p(x.getDate())} ${M[x.getMonth()]} ${x.getFullYear()} ${p(h)}:${p(x.getMinutes())} ${x.getHours() < 12 ? 'AM' : 'PM'}`;
}
const nn = (v) => { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return v; };

// auth
// route-config: franchisee/O0obeCTpYiNBlRDMchzx8A==
router.all([P + '/Index{/:id}', '/franchise/franchisee/O0obeCTpYiNBlRDMchzx8A=='], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let getorderid = await UtilityClass.Decryptword(req.p.orderID);
  getorderid = getorderid.replace(/^,+|,+$/g, '');
  const rows = await db.proc('shopping', 'usp_order_invoice', { ORDERID: getorderid });
  const GetCompleteorderde = mapRows(rows, PROPS);
  for (const Items of GetCompleteorderde) {
    ViewBag.orderID = Items.ORDERNO;
    ViewBag.ORDER_DATE = Items.ORDER_DATE;
    if (Items.ORDER_DATE != null && String(Items.ORDER_DATE).trim() !== '') ViewBag.orderDate = fmtDate(Items.ORDER_DATE);
    ViewBag.mobile = Items.MOBILE;
    ViewBag.emails = Items.EMAILID;
    ViewBag.name = Items.Name;
    if (nn(Items.CITY).trim() === '') ViewBag.billadd = Items.BILLADD;
    else ViewBag.billadd = Items.BILLADD + ', ' + Items.CITY;
    ViewBag.pincode = Items.PINCODE;
    ViewBag.ship = Items.Name;
    if (Items.CITY.trim() === '') ViewBag.billadd1 = Items.BILLADD;
    else ViewBag.billadd1 = Items.BILLADD + ', ' + Items.CITY;
    ViewBag.Paymode = Items.PAYMODE;
    ViewBag.pincode1 = Items.PINCODE;
    ViewBag.mobile1 = Items.MOBILE;
    ViewBag.emails1 = Items.EMAILID;
    ViewBag.orderID = Items.ORDERNO;
    return res.json({ Model: GetCompleteorderde, ViewBag, ...ViewBag });
  }
  ViewBag.IsStop = 'yes';
  res.json({ ViewBag, ...ViewBag });
}));

module.exports = router;
