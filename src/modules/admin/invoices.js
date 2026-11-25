'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Invoices.cs (class InvoicesController => /admin/Invoices/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { qsGet } = require('./_shared/batch08-c-common');
const { adminAuth } = require('./_shared/admin-session');

const router = express.Router();
const DB = 'affiliate';
const C = 'Invoices';

/** class InvoicePrint */
const INVOICE_PRINT_PROPS = ['RowNumber', 'ORDERID', 'ORDERDATE', 'TAXABLEAMOUNT', 'DISCOUNT', 'GSTAMOUNT', 'GROSSAMOUNT', 'CUSTOMERNAME',
  'ADDRESS', 'MOBILE', 'INVOICEDATE', 'PRODUCTCODE', 'CITY', 'TOTALAMOUNT', 'COMPANYNAME', 'COMPANYADDRESS', 'GSTN', 'INVOICENO', 'MRP',
  'GSTPER', 'PrCode', 'STATUS', 'QUANTITY', 'DP', 'PAYMODE', 'IGSTTYPE', 'BV', 'PAN_NO', 'Bill_Address', 'Bill_state', 'Bill_city',
  'Bill_pincode', 'Bill_Country', 'IV', 'SHIPPINGCHARGE', 'HSNCODE', 'Statecode', 'TONAME', 'TOADDRESS', 'TOMOBILE', 'CHALLANNO',
  'CHALLANDATE', 'FROMNAME', 'FROMADDRESS', 'FromGST', 'FROMMOBILE'];

// ---------------------------------------------------------------- Index()
// public (legacy had no session check)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Invoices/Index.cshtml' });
}));

// ---------------------------------------------------------------- InvicesPrintable()
// public (legacy had no session check; the order id travels encrypted in ?ID=)
// route-config: "AdminPanel/Invoices" -> Invoices/InvicesPrintable
router.all([`/admin/${C}/InvicesPrintable{/:id}`, '/admin/AdminPanel/Invoices'], adminAuth, asyncHandler(async (req, res) => {
  const ID = qsGet(req, 'ID'); // Request.QueryString["ID"]
  if (ID === undefined || ID === null) {
    return res.json({ redirect: '/Home/Index' }); // RedirectToAction("Index", "Home")
  }
  const DecryptId = await UtilityClass.Decryptword(String(ID));
  const rows = await db.proc(DB, 'USP_PRODUCTINVOICEDETAILS', { ORDERID: DecryptId });
  const InvoicePrintLi = mapRows(rows, INVOICE_PRINT_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Invoices/Invoices.cshtml', Model: InvoicePrintLi });
}));

module.exports = router;
