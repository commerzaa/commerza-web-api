'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Order_List.cs (class Order_ListController => /Order_List/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { DB, nInt, nStr, s0, reqInt, outIntOf, firstCol } = require('./_shared/batch10_common');

const router = express.Router();
const C = 'Order_List';

/** class orderDetails */
const PROPS = ['ROWNUMBER', 'OMID', 'ORDERID', 'REGNO', 'TOTALAMOUNT', 'BV', 'RBV', 'DISCOUNT', 'DP', 'PAYMODE', 'ISORDERCANCEL', 'ALLPRODUCTID',
  'HANDLINGFEE', 'TAXABLEAMOUNT', 'ORDERDATE', 'BRANCHID', 'DELIVERYSTATUS', 'ISCOUNTEDTOPACKAGE', 'STATUS', 'POMID', 'TKPMID', 'PRODUCTNAME', 'MRP',
  'GSTID', 'GSTAMOUNT', 'GST', 'IMID', 'CUSTOMERNAME', 'EMAILID', 'MOBILE', 'INVOICENAME', 'DATE', 'ADDRESS', 'COUNTRY', 'STATE', 'CITY', 'PINCODE',
  'Amount', 'STATUST', 'WalletTypeName', 'USERNAME'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (only written here).
// `private string datauploadmessage` is never used.
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

// ---------------------------------------------------------------- Index(string type, string SearchField, string Company, string SearchValue, string fromDate,
//   string toDate, string status, int? page, string btnexel, string UserName)
// auth (PORT-NOTE: legacy [AdminSessionExpire] was commented out, i.e. the full order list (customer PII) was public; protected with adminAuth)
// route-config: "AdminPanel/order-List" -> Order_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/order-List'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let SearchField = nStr(req.p.SearchField);
  if (SearchField === null) {
    SearchField = '';
  } else if (SearchField === 'Pending') {
    SearchField = '1';
  } else if (SearchField === 'Delivered') {
    SearchField = '2';
  } else if (SearchField === 'Canceled') {
    SearchField = '3';
  }
  const SearchValue = s0(req.p.SearchValue);
  const fromDate = s0(req.p.fromDate);
  const toDate = s0(req.p.toDate);
  const status = s0(req.p.status);
  // Company / type ("manifest" => "ReadyToShip") / btnexel are defaulted but only used by commented-out code
  const UserName = s0(req.p.UserName);
  const ViewBag = { Status: status };
  const MaxRows = 100;
  let page = nInt(req.p.page); if (page === null) page = 1;
  // dbo.UPS_OrderDeatils @fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@STATUS,@UserName,@TOTALCOUNT out
  const rows = await db.proc(DB, 'UPS_OrderDeatils', {
    fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows, STATUS: SearchField, UserName,
  });
  const objAllOrderList = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue,
    fromDate, toDate,
  });
  res.json({ view: '~/Views/AdminPanel/Order_List/Index.cshtml', Model: objAllOrderList, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult ChangeStatus(int comid, int POMID)
// auth (PORT-NOTE: legacy had no session check on this data-changing action; protected with adminAuth)
router.all(`/admin/${C}/ChangeStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const comid = reqInt(req.p.comid, 'comid');
  const POMID = reqInt(req.p.POMID, 'POMID');
  // USP_OrderList_update @OMID,@POMID
  const rows = await db.proc(DB, 'USP_OrderList_update', { OMID: comid, POMID });
  // PORT-NOTE: ExecuteSqlCommand returned the rows-affected count; PostgreSQL cannot report it for a function call, so the first
  // column of the first returned row is used when the function returns one, otherwise -1 (the SQL Server value under SET NOCOUNT ON).
  const v = firstCol(rows);
  const Result = v === null || v === undefined || Number.isNaN(Number(v)) ? -1 : Number(v);
  res.json(Result);
}));

module.exports = router;
