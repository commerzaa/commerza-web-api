'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\Comm_invoice.cs (Comm_invoiceController)
 * Actions: Index (1)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const INVOICE_PROPS = ['Amount', 'Gstpercentage', 'GSTAMOUNT', 'Description', 'TOTALAMOUNT'];
const RESELLER_PROPS = ['NAME', 'MOBILE', 'LANDLINE', 'EMAILID', 'ADDRESS', 'GSTNO', 'CIN', 'PAN', 'BRANDLOGO', 'COMPANYNAME'];
const COMPANY_PROPS = ['NAME', 'MOBILE', 'LANDLINE', 'EMAILID', 'ADDRESS', 'GSTNO', 'CIN', 'PAN'];

// route-config: (franchisee/comm-invoices is commented out in RouteConfig.cs; conventional route only)
// auth
router.all('/franchise/Comm_invoice/Index{/:id}', auth, asyncHandler(async (req, res) => {
  let invoiceNo = req.p.invoiceNo === undefined || req.p.invoiceNo === null ? '' : String(req.p.invoiceNo);
  const DID = Number(req.user.did);
  const did = Math.trunc(DID);
  let list = [];
  const ViewBag = {};
  if (invoiceNo !== '') {
    invoiceNo = await UtilityClass.Decryptword(invoiceNo);
    ViewBag.ResellerDetails = mapRows(await db.proc(DB, 'USP_GET_RESELLER_COMPANYDETAILS', { DID: did }), RESELLER_PROPS);
    ViewBag.CompanyDetails = mapRows(await db.proc(DB, 'USP_GET_COMPANYDETAILS', {}), COMPANY_PROPS);
    list = mapRows(await db.proc(DB, 'USP_GET_RESELLER_COMMISSIONINVOICES_DETAILS', { DID: did, INVOICENO: invoiceNo }), INVOICE_PROPS);
    const d = await db.scalar(DB, "SELECT to_char(coalesce(TRANSDATE,'1900-01-01'::timestamp),'Mon DD YYYY HH12:MIAM') AS INVOICEDATE FROM TBL_RESELLER_COMMISSION_WALLET WHERE INVOICENO=@invoiceNo LIMIT 1", { invoiceNo });
    ViewBag.InvoiceDate = d === undefined ? null : d;
    ViewBag.InvoiceNo = invoiceNo;
  }
  res.json({ Model: list, ViewBag });
}));

module.exports = router;
