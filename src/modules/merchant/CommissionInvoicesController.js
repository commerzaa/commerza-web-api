'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/CommissionInvoicesController.cs (CommissionInvoicesController)
 * Prefix: /merchant   DB: Merchant DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc, scalar } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';

const COMPANY_PROPS = ['NAME', 'MOBILE', 'LANDLINE', 'EMAILID', 'ADDRESS', 'GSTNO', 'CIN', 'PAN'];
const COMM_DETAIL_PROPS = ['TMCIDID', 'PLID', 'TMCIID', 'ORDERID', 'ORDERNO', 'TAXABLEAMOUNT', 'ADMINCHARGES', 'HANDLINGCHARGES', 'FIXEDCHARGES', 'CGSTRATE',
  'CGSTAMOUNT', 'SGSTRATE', 'SGSTAMOUNT', 'IGSTRATE', 'IGSTAMOUNT', 'TOTALAMOUNT', 'ACTIVE', 'CREATEDDATE'];
const SHIP_DETAIL_PROPS = ['TMSIDID', 'PLID', 'TMSIID', 'ORDERID', 'ORDERNO', 'TAXABLEAMOUNT', 'SHIPPINGCHARGES', 'CGSTRATE', 'CGSTAMOUNT', 'SGSTRATE',
  'SGSTAMOUNT', 'IGSTRATE', 'IGSTAMOUNT', 'TOTALAMOUNT', 'ACTIVE', 'CREATEDDATE'];

// CONVERT(VARCHAR,ISNULL(INVOICEDATE,''),100) => "Mon dd yyyy hh:miAM"
const DATE100 = `CASE WHEN invoicedate IS NULL THEN '' ELSE to_char(invoicedate,'Mon') || ' ' || lpad(to_char(invoicedate,'FMDD'),2,' ') || ' ' ||
  to_char(invoicedate,'YYYY') || ' ' || lpad(to_char(invoicedate,'FMHH12'),2,' ') || ':' || to_char(invoicedate,'MI') || to_char(invoicedate,'AM') END`;

async function build(req, table, detailProc, detailProps, invoiceNo) {
  let Model = [];
  const ViewBag = {};
  if (invoiceNo !== '') {
    invoiceNo = await UtilityClass.Decryptword(invoiceNo);
    try {
      const PLID = Math.trunc(Number(req.user.plid));
      ViewBag.CompanyDetails = mapRows(await proc(DB, 'usp_get_companydetails', {}), COMPANY_PROPS);
      ViewBag.MerchantDetails = mapRows(await proc(DB, 'usp_get_merchantdetails', { plid: PLID }), COMPANY_PROPS);
      Model = mapRows(await proc(DB, detailProc, { plid: PLID, invoiceno: invoiceNo }), detailProps);
      ViewBag.InvoiceDate = await scalar(DB, `select ${DATE100} from ${table} WHERE invoiceno = @invoiceno LIMIT 1`, { invoiceno: invoiceNo });
      ViewBag.InvoiceNo = invoiceNo;
    } catch (ex) {
      Model = null;
    }
  }
  return { Model, ViewBag };
}

// ---- Index (COMMISSION INVOICES DETAILS) ---------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all('/merchant/CommissionInvoices/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const invoiceNo = req.p.invoiceNo === undefined || req.p.invoiceNo === null ? '' : String(req.p.invoiceNo);
  const { Model, ViewBag } = await build(req, 'tbl_merchant_commissioninvoices', 'usp_get_merchantcommissioninvoices_details', COMM_DETAIL_PROPS, invoiceNo);
  return res.json({ view: '~/Views/CommissionInvoices/Index.cshtml', Model, ViewBag });
}));

// ---- ShippingInvoices (SHIPPING INVOICES DETAILS) --------------------------------------------------------
// auth ([SessionExpireCheck])
router.all('/merchant/CommissionInvoices/ShippingInvoices{/:id}', auth, asyncHandler(async (req, res) => {
  const invoiceNo = req.p.invoiceNo === undefined || req.p.invoiceNo === null ? '' : String(req.p.invoiceNo);
  const { Model, ViewBag } = await build(req, 'tbl_merchant_shippinginvoices', 'usp_get_merchantshippinginvoices_details', SHIP_DETAIL_PROPS, invoiceNo);
  return res.json({ view: '~/Views/CommissionInvoices/ShippingInvoices.cshtml', Model, ViewBag });
}));

module.exports = router;
