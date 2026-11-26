'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/OrderInvoice.cs
// (class OrderInvoiceController => /portal/OrderInvoice/...). Database: shopping (Db_Shopping).
// Fork of the Merchant Panel OrderInvoice.cs (differences: view paths, InvoiceList.SPRID); compared line by line.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, view, str } = require('./_shared/batch-06-common');

const router = express.Router();

/** class InvoiceList */
const INVOICELIST_PROPS = ['ROWNUMBER', 'ORID', 'POID', 'orderID', 'PAYMODE', 'Name', 'BILLADD', 'CITY', 'PINCODE', 'EMAILID', 'MOBILE',
  'INVOICENO', 'INVOICE_DATE', 'ORDER_DATE', 'QUANTITY', 'COMPANYNAME', 'PICK_STATE', 'PICK_CITY', 'PICK_AREA', 'PICK_PINCODE', 'PICK_ADDRESS',
  'GSTNO', 'PayRemark', 'PRODUCT_NAME', 'TOTAL_COST', 'TOTAL_VAT', 'TOTAL_PURCHASE_COST', 'singleProdPrice', 'total_DAP',
  'Total_Ship_Ch', 'Total_payble_vat', 'VatTitle', 'VatPercValue', 'ORDERNO', 'MORDERID', 'PANNO', 'PrSKUCode', 'SPRID'];

/** string.Format("{0:dd MMM yyyy hh:mm tt}", d) */
function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (n) => String(n).padStart(2, '0');
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return `${p(x.getDate())} ${M[x.getMonth()]} ${x.getFullYear()} ${p(h)}:${p(x.getMinutes())} ${x.getHours() < 12 ? 'AM' : 'PM'}`;
}

// ---------------------------------------------------------------- Index(string orderID)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/O0obeCTpYiNBlRDMchzx8A==" -> OrderInvoice/Index (PRID optional)
router.all(['/portal/OrderInvoice/Index{/:id}', '/portal/OrderInvoice', '/portal/customer/O0obeCTpYiNBlRDMchzx8A=='], ps.customerAuth,
  asyncHandler(async (req, res) => {
    const ViewBag = {};
    let RealOrderId = await UtilityClass.Decryptword(req.p.orderID === undefined ? null : req.p.orderID);
    RealOrderId = str(RealOrderId).replace(/^,+|,+$/g, '');
    const rows = await db.proc(DB, 'usp_order_invoice', { ORDERID: RealOrderId });
    const GetCompleteorderde = mapRows(rows, INVOICELIST_PROPS);
    for (const Items of GetCompleteorderde) {
      ViewBag.orderID = Items.ORDERNO;
      ViewBag.ORDER_DATE = Items.ORDER_DATE;
      if (str(Items.ORDER_DATE).trim() !== '') ViewBag.orderDate = fmtDate(Items.ORDER_DATE);
      ViewBag.mobile = Items.MOBILE;
      ViewBag.emails = Items.EMAILID;
      ViewBag.name = Items.Name;
      if (str(Items.CITY).trim() === '') ViewBag.billadd = Items.BILLADD;
      else ViewBag.billadd = (Items.BILLADD == null ? '' : Items.BILLADD) + ', ' + Items.CITY;
      ViewBag.pincode = Items.PINCODE;
      ViewBag.ship = Items.Name;
      if (str(Items.CITY).trim() === '') ViewBag.billadd1 = Items.BILLADD;
      else ViewBag.billadd1 = (Items.BILLADD == null ? '' : Items.BILLADD) + ', ' + Items.CITY;
      ViewBag.Paymode = Items.PAYMODE;
      ViewBag.pincode1 = Items.PINCODE;
      ViewBag.mobile1 = Items.MOBILE;
      ViewBag.emails1 = Items.EMAILID;
      ViewBag.orderID = Items.ORDERNO;
      ViewBag.RealOrderId = Items.orderID;
      return view(res, '~/Views/CustomerPanel/OrderInvoice/Index.cshtml', GetCompleteorderde, ViewBag);
    }
    ViewBag.IsStop = 'yes';
    return view(res, '~/Views/CustomerPanel/OrderInvoice/Index.cshtml', undefined, ViewBag);
  }));

module.exports = router;
