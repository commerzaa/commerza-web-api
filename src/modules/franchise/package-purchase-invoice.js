'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };
// Port of Franchise\Controllers\CustomerPanel\PackagePurchaseInvoice.cs (1 action)
// route-config: franchisee/6KcEWOoQxJRQdh08Yn3maiuYANWOgg0S -> Index (PRID optional)
const PROPS = ['ROWNUMBER', 'RPID', 'DID', 'TRANSACTIONID', 'INVOICENUMBER', 'PACKAGENAME', 'AMOUNT', 'GSTAMOUNT', 'GSTPERCENTAGE', 'TOTALAMOUNT', 'PAYMODE', 'INVOICEDATE', 'COMPANYNAME', 'ADDRESS', 'PHONE', 'EMAILID', 'CITYNAME', 'PINCODE', 'DISCOUNT'];
// auth ([SessionExpireCheck])
router.all(['/franchise/PackagePurchaseInvoice/Index{/:id}', '/franchise/franchisee/6KcEWOoQxJRQdh08Yn3maiuYANWOgg0S'], auth, asyncHandler(async (req, res) => {
  const invoice = req.p.invoice;
  let Invoiceno = UtilityClass.Decryptword(invoice);
  Invoiceno = String(Invoiceno).replace(/^,+|,+$/g, '');
  const out = {};
  out.CompanyDetails = await db.proc('shopping', 'usp_get_companydetails', {});
  const list = mapRows(await db.proc('shopping', 'usp_purchase_package_invoice_reseller_history', { INVOICENO: Invoiceno }), PROPS);
  for (const Items of list) {
    out.Transactionid = Items.TRANSACTIONID;
    out.INVOICEDATE = Items.INVOICEDATE;
    if (String(Items.INVOICEDATE).trim() !== '') {
      out.orderDate = Items.INVOICEDATE; // string.Format("{0:dd MMM yyyy hh:mm tt}", string) returns the string unchanged
    }
    out.mobile = Items.PHONE;
    out.emails = Items.EMAILID;
    out.name = Items.COMPANYNAME;
    if (Items.CITYNAME.trim() === '') out.billadd = Items.ADDRESS;
    else out.billadd = Items.ADDRESS + ', ' + Items.CITYNAME;
    out.pincode = Items.PINCODE;
    out.Paymode = Items.PAYMODE;
  }
  out.Model = list;
  res.json(out);
}));

module.exports = router;
