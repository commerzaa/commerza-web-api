'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Delivery_Challan.cs (class Delivery_ChallanController, no namespace => /Delivery_Challan/...)
// Database: affiliate (Db_Affiliate). Proc USP_TRANSFERCHALLAN_DETAILS.
// The C# file also declares model classes ProductInvoicePrint and CompanyDetails (unused by the actions; plain property bags - not ported).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');

const router = express.Router();
const DB = 'affiliate';
const C = 'Delivery_Challan';

/** Controllers/AdminPanel/Invoices.cs class InvoicePrint */
const INVOICE_PRINT_PROPS = ['RowNumber', 'ORDERID', 'ORDERDATE', 'TAXABLEAMOUNT', 'DISCOUNT', 'GSTAMOUNT', 'GROSSAMOUNT', 'CUSTOMERNAME', 'ADDRESS',
  'MOBILE', 'INVOICEDATE', 'PRODUCTCODE', 'CITY', 'TOTALAMOUNT', 'COMPANYNAME', 'COMPANYADDRESS', 'GSTN', 'INVOICENO', 'MRP', 'GSTPER', 'PrCode',
  'STATUS', 'QUANTITY', 'DP', 'PAYMODE', 'IGSTTYPE', 'BV', 'PAN_NO', 'Bill_Address', 'Bill_state', 'Bill_city', 'Bill_pincode', 'Bill_Country', 'IV',
  'SHIPPINGCHARGE', 'HSNCODE', 'Statecode', 'TONAME', 'TOADDRESS', 'TOMOBILE', 'CHALLANNO', 'CHALLANDATE', 'FROMNAME', 'FROMADDRESS', 'FromGST',
  'FROMMOBILE'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (PORT-NOTE: legacy had no session check; admin page => adminAuth)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Delivery_Challan/Invoices.cshtml' });
}));

// ---------------------------------------------------------------- ActionResult ChallanDelivery()   (Request.QueryString["challanid"])
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
// route-config: "AdminPanel/Delivery-Challan" -> Delivery_Challan/ChallanDelivery
router.all([`/admin/${C}/ChallanDelivery{/:id}`, '/admin/AdminPanel/Delivery-Challan'], adminAuth, asyncHandler(async (req, res) => {
  const qk = Object.keys(req.query || {}).find((k) => k.toLowerCase() === 'challanid'); // QueryString is case-insensitive
  const CHALANID = qk === undefined ? null : (Array.isArray(req.query[qk]) ? req.query[qk].join(',') : req.query[qk]);
  if (CHALANID === null) {
    return res.json({ redirect: 'Home/Index' });
  }
  const DecryptId = await UtilityClass.Decryptword(CHALANID);
  const InvoicePrintLi = mapRows(await db.proc(DB, 'USP_TRANSFERCHALLAN_DETAILS', { CHALLANID: DecryptId }), INVOICE_PRINT_PROPS);
  const Count = InvoicePrintLi.length;
  return res.json({ view: '~/Views/AdminPanel/Delivery_Challan/Invoices.cshtml', Model: InvoicePrintLi, Count });
}));

module.exports = router;
