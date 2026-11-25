'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Store_Delivery_Challan.cs (class Store_Delivery_ChallanController, no namespace => /admin/Store_Delivery_Challan/...)
// Database: affiliate (Db_Affiliate). Proc USP_STORETRANSFERCHALLAN_DETAILS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB } = require('./_shared/batch11-common');
const { qsGet } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'Store_Delivery_Challan';
const VIEW = '~/Views/AdminPanel/Store_Delivery_Challan/Invoices.cshtml';

/** Delivery_Challan.cs class ProductInvoicePrint (the copy in Store_Delivery_Challan.cs is commented out) */
const PRODUCT_INVOICE_PRINT_PROPS = ['RowNumber', 'DCDID', 'TKPMID', 'DCID', 'AMOUNT', 'QTY', 'TOTALAMOUNT', 'GSTTYPE', 'GST', 'CHALLANDATE', 'CHALLANNO',
  'FROMNAME', 'TONAME', 'FROMMOBILE', 'TOMOBILE', 'FROMADDRESS', 'TOADDRESS', 'TOFRID', 'STATUS', 'PRCODE', 'NAME', 'VALUE', 'BV', 'FROMGSTINNO', 'IGSTTYPE'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (PORT-NOTE: legacy had no session check; admin panel view => adminAuth)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: VIEW });
}));

// ---------------------------------------------------------------- ActionResult ChallanDelivery()
// auth (PORT-NOTE: legacy had no session check; admin challan print => adminAuth)
// route-config: "AdminPanel/Store-Delivery-Challan" -> Store_Delivery_Challan/ChallanDelivery
router.all([`/admin/${C}/ChallanDelivery{/:id}`, '/admin/AdminPanel/Store-Delivery-Challan'], adminAuth, asyncHandler(async (req, res) => {
  const CHALANID = qsGet(req, 'challanid'); // Request.QueryString["challanid"]
  if (CHALANID === null) return res.json({ redirect: '/Home/Index' }); // RedirectToAction("Index", "Home")
  const DecryptId = await UtilityClass.Decryptword(CHALANID);
  const ViewBag = {};
  // [USP_STORETRANSFERCHALLAN_DETAILS] @CHALLANID
  const InvoicePrintLi = mapRows(await db.proc(DB, 'USP_STORETRANSFERCHALLAN_DETAILS', { CHALLANID: DecryptId }), PRODUCT_INVOICE_PRINT_PROPS);
  ViewBag.Count = InvoicePrintLi.length;
  return res.json({ view: VIEW, Model: InvoicePrintLi, ...ViewBag });
}));

module.exports = router;
