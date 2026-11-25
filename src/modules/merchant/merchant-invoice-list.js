'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Merchant_Invoice_List.cs (Merchant_Invoice_ListController) - 1 action
 * DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Merchant_Invoice_List';
const INVOICE_PROPS = ['ROWNUMBER', 'TMCIID', 'TMSIID', 'INVOICETYPE', 'ORDERID', 'INVOICENO', 'INVOICEDATE', 'ACTIVE', 'TOTALAMOUNT'];
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);

const indexHandler = asyncHandler(async (req, res) => {
  let { ORDERID, fromDate, toDate, page, INVOICENO, INVOICETYPE } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (INVOICETYPE == null) INVOICETYPE = '';
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (INVOICENO == null) INVOICENO = '';
  if (ORDERID == null) ORDERID = '';
  const PLID = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_get_merchantallinvoices', {
    plid: PLID, startrowindex: page, maxrows: MaxRows, invoiceno: INVOICENO, orderid: ORDERID, invoicetype: INVOICETYPE, fromdate: fromDate, todate: toDate,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  res.json({
    view: '~/Views/Merchant_Invoice_List/Index.cshtml',
    Model: mapRows(rows, INVOICE_PROPS),
    ViewBag: {
      CurrentPage: page, fromDate, toDate, INVOICENO, ORDERID, INVOICETYPE, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    },
  });
});
// route-config: merchant/z8tZG_slash_e_slash_RKYsf_slash_m8EkQv95zYWYRmdC1h and merchant/product-invoices -> Index
// auth ([SessionExpireCheck])
router.all([
  `/merchant/${C}/Index{/:id}`, `/merchant/${C}`,
  '/merchant/z8tZG_slash_e_slash_RKYsf_slash_m8EkQv95zYWYRmdC1h', '/merchant/merchant/z8tZG_slash_e_slash_RKYsf_slash_m8EkQv95zYWYRmdC1h',
  '/merchant/product-invoices', '/merchant/merchant/product-invoices',
], auth, indexHandler);

module.exports = router;
