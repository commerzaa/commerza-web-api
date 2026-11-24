'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/ProductInvoices .cs (ProductInvoicesController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const INVOICE_PROPS = ['RowNumber', 'ORDERID', 'ORDERDATE', 'TAXABLEAMOUNT', 'DISCOUNT', 'GSTAMOUNT', 'GROSSAMOUNT', 'CUSTOMERNAME', 'ADDRESS', 'MOBILE',
  'INVOICEDATE', 'PRODUCTCODE', 'CITY', 'TOTALAMOUNT', 'COMPANYNAME', 'COMPANYADDRESS', 'GSTN', 'INVOICENO', 'MRP', 'GSTPER', 'PrCode', 'STATUS', 'QUANTITY',
  'DP', 'PAYMODE', 'USERNAME', 'BV', 'IGSTTYPE', 'Bill_Address', 'Bill_state', 'Bill_city', 'Bill_pincode', 'Bill_Country', 'IV', 'SHIPPINGCHARGE', 'HSNCODE',
  'Statecode', 'PAN_NO'];

// public (legacy view with no model and no session check)
router.all('/member/ProductInvoices/Index{/:id}', (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/ProductInvoice/Invoices.cshtml' });
});

// auth (acts on a member's order invoice; token may also be sent as ?token=)
// route-config: "referral/ProductInvoices/{ID}" -> ProductInvoices/InvicesPrintable
router.all(['/member/ProductInvoices/InvicesPrintable{/:id}', '/member/referral/ProductInvoices{/:ID}'], auth, asyncHandler(async (req, res) => {
  // Request.QueryString["ID"] (case-insensitive, query string only)
  const qk = Object.keys(req.query || {}).find((k) => k.toLowerCase() === 'id');
  let ID = qk === undefined ? null : req.query[qk];
  if (Array.isArray(ID)) ID = ID.join(',');
  if (ID === null || ID === undefined) return res.json({ redirect: '/member/Home/Index' });

  const DecryptId = await UtilityClass.Decryptword(ID);
  const rows = await db.proc(DB, 'usp_productinvoicedetails', { orderid: DecryptId, status: 0 });
  res.json({ view: '~/Views/CustomerPanel/ProductInvoice/Invoices.cshtml', Model: mapRows(rows, INVOICE_PROPS) });
}));

module.exports = router;
