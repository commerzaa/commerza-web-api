// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Merchant_Invoice_List.cs (class Merchant_Invoice_ListController; DB: Db_Shopping)
// The Merchant Panel version calls a different procedure (USP_GET_MERCHANTALLINVOICES), so this module is ported from the portal C# directly.
// Proc: USP_INVOICELIST; model InvoiceDetails (Controllers/CustomerPanel/Order_List.cs)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Merchant_Invoice_List';
const INVOICE_DETAILS = ['CreateDate', 'DispatchedDate', 'InvoiceNo', 'NoOfItem', 'OrderNo', 'RowNumber', 'Status', 'TotalAmount'];

/** string.Split('-')[i] (IndexOutOfRangeException when missing) */
function part(arr, i) {
  if (i >= arr.length) throw new RangeError('Index was outside the bounds of the array.');
  return c.toStringOrEmpty(arr[i]);
}

// auth ([SessionExpireCheck])
// route-config: merchant/product-invoices -> Merchant_Invoice_List/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/product-invoices'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const OrderID = b.mvcStr(req, 'OrderID');
  let fromDate = c.toStringOrEmpty(b.mvcStr(req, 'fromDate'));
  let toDate = c.toStringOrEmpty(b.mvcStr(req, 'toDate'));
  let page = c.bindNullableInt(req, 'page');
  if (fromDate.trim() !== '') {
    const dates = fromDate.split('-');
    fromDate = part(dates, 2) + '-' + part(dates, 1) + '-' + part(dates, 0);
  }
  if (toDate.trim() !== '') {
    const dates = toDate.split('-');
    toDate = part(dates, 2) + '-' + part(dates, 1) + '-' + part(dates, 0);
  }
  if (page === null) page = 1;
  const MaxRows = 50;
  const UrlReferrer = c.toStringOrEmpty(req.get('referer'));
  const BranchId = c.toInt32(req.user.plid);
  const ViewBag = {};
  const rows = await db.proc(DB, 'usp_invoicelist', {
    startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: fromDate, todate: toDate, branchid: BranchId,
  });
  const invoiceDetails = mapRows(rows, INVOICE_DETAILS);
  // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first row (0 when no rows).
  ViewBag.TotalRecord = b.totalOf(rows);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.OrderID = OrderID;
  ViewBag.UrlReferrer = UrlReferrer;
  return c.viewJson(res, '~/Views/CustomerPanel/Merchant_Invoice_List/Index.cshtml', invoiceDetails, ViewBag);
}));

module.exports = router;
