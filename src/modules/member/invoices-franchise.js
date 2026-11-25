'use strict';
// Port of Member\Common\Controllers\CustomerPanel\InvoicesFranchise.cs (InvoicesFranchiseController)
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
const InvoicePrintfranchise = ['RowNumber', 'ORDERID', 'ORDERDATE', 'TAXABLEAMOUNT', 'DISCOUNT', 'GSTAMOUNT', 'GROSSAMOUNT', 'CUSTOMERNAME', 'ADDRESS', 'MOBILE', 'INVOICEDATE', 'PRODUCTCODE', 'CITY', 'TOTALAMOUNT', 'COMPANYNAME', 'COMPANYADDRESS', 'GSTN', 'INVOICENO', 'MRP', 'GSTPER'];

// public (printable invoice link carries the encrypted order id; legacy has no session check)
// route-config: referral/InvoicesFranchise -> InvoicesFranchise/Index
router.all(['/member/InvoicesFranchise/Index{/:id}', '/member/referral/InvoicesFranchise'], asyncHandler(async (req, res) => {
  const ID = req.query.ID === undefined ? null : req.query.ID;
  if (ID === null) {
    return res.json({ redirect: '/member/Home/Index' });
  }
  const DecryptId = await UtilityClass.Decryptword(ID);
  const rows = await db.proc(DB, 'usp_productinvoicedetails', { orderid: DecryptId });
  res.json(mapRows(rows, InvoicePrintfranchise));
}));

module.exports = router;
