'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\New_Order.cs (class New_OrderController => /New_Order/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nInt, nStr, cvtInt, outIntOf, netFormat } = require('./_shared/batch10_common');
const {
  ORDER_MGMT_PROPS, GetTimestamp, interopOrderExport, GetDetailsByOMID, UpdatePendingDetails, CancelProduct,
} = require('./_shared/batch10D_common');

const router = express.Router();
const C = 'New_Order';

// public void ExportReport(string fromDate, string toDate, string SearchField, string UserName, string Type1)
async function ExportReport(req, fromDate, toDate, SearchField, UserName, Type1, ViewBag) {
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  // dbo.UPS_OrderDeatilsEXport @fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@STATUS,@UserName,@TOTALCOUNT out,@Type,@orderbydate
  const rows = await db.proc(DB, 'UPS_OrderDeatilsEXport', {
    fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 1000000, STATUS: SearchField, UserName, Type: Type1, orderbydate: '',
  });
  const objAllOrderList = mapRows(rows, ORDER_MGMT_PROPS);
  if (objAllOrderList.length > 0) {
    await interopOrderExport({ req, rows: objAllOrderList, Type1, pending: false, ViewBag });
  }
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string Type, string fromDate, string toDate,
//   string UserName, int? page, string btnexel)
// auth (PORT-NOTE: legacy had NO session check (order list with customer data was public); protected with adminAuth)
// route-config: "AdminPanel/Offline-PendingOrder" -> New_Order/Index with default Type = 5
async function Index(req, res, defaultType) {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let Type = nStr(req.p.Type);
  if (Type === null && defaultType !== undefined) Type = defaultType;
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let UserName = nStr(req.p.UserName);
  let page = nInt(req.p.page);
  const btnexel = nStr(req.p.btnexel);
  const ViewBag = {};
  if (Type === '1') {
    ViewBag.Title = 'New Order'; ViewBag.URL = '/AdminPanel/New-Order';
  } else if (Type === '2') {
    ViewBag.Title = 'Complete Order'; ViewBag.URL = 'AdminPanel/Complete-Order';
  } else if (Type === '3') {
    ViewBag.Title = 'Packaged Order'; ViewBag.URL = 'AdminPanel/InProcess';
  } else if (Type === '4') {
    ViewBag.Title = 'Dispatched'; ViewBag.URL = 'AdminPanel/Dispatched';
  } else if (Type === '5') {
    ViewBag.Title = 'Offline Pending Order'; ViewBag.URL = 'AdminPanel/Offline-PendngOrder';
  } else if (Type === '6') {
    ViewBag.Title = 'Cancelled Order'; ViewBag.URL = 'AdminPanel/Cancel-Order';
  }
  // (local `Stauts` / `IncomeType` are set but never used)
  ViewBag.Type = Type;
  let objAllOrderList = [];
  try {
    const SearchField = Type;
    const SearchValue = '';
    const status = '';
    if (dynamicpagging === null) {
      const value = config.app.DynamicPagging; // AppSettings["DynamicPagging"]
      dynamicpagging = cvtInt(value === undefined ? null : value); // Convert.ToInt16
    }
    if (orderbydate === null) orderbydate = '';
    if (fromDate === null) fromDate = '';
    if (toDate === null) toDate = '';
    if (UserName === null) UserName = '';
    ViewBag.Status = status;
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    // dbo.UPS_OrderDeatils @fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@STATUS,@UserName,@TOTALCOUNT out,@Type,@orderbydate
    const rows = await db.proc(DB, 'UPS_OrderDeatils', {
      fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows, STATUS: SearchField, UserName, Type, orderbydate,
    });
    objAllOrderList = mapRows(rows, ORDER_MGMT_PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, orderbydate, dynamicpagging, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, fromDate, toDate,
    });
    if (btnexel === 'Export Excel') {
      await ExportReport(req, fromDate, toDate, SearchField, UserName, Type, ViewBag);
      const DownloadFile = path.join(config.uploadDir, 'AllExcelSheets', 'OrderDetails.xls');
      const CorrectTimeStamp = GetTimestamp(new Date());
      const fileBytes = fs.readFileSync(DownloadFile);
      const Time = netFormat(new Date(), 'HH:mm:ss tt');
      const fileName = 'Delivery_Details_' + CorrectTimeStamp + '_' + Time + '.xls';
      res.set('Content-Type', 'application/octet-stream');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(fileBytes);
    }
  } catch (Exp) {
    // PORT-NOTE: legacy called Response.Redirect("/page-not-found") first, which ends the request (ThreadAbortException), so the
    // ErrorInsert block after it never ran - not called here either.
    if (res.headersSent) return undefined;
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ view: '~/Views/AdminPanel/OrderManagement/Index.cshtml', Model: objAllOrderList, ...ViewBag });
}

router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => Index(req, res)));
// route-config
router.all('/admin/AdminPanel/Offline-PendingOrder', adminAuth, asyncHandler(async (req, res) => Index(req, res, '5')));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string SearchField, string UserName, string Type1)
// auth (PORT-NOTE: legacy had no session check; writes the order export file - protected with adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  await ExportReport(req, v('fromDate'), v('toDate'), v('SearchField'), v('UserName'), v('Type1'), {});
  res.send(''); // void action
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByOMID(int OMID)
// auth (PORT-NOTE: legacy had no session check; returns customer invoice data - protected with adminAuth)
router.all(`/admin/${C}/GetDetailsByOMID{/:id}`, adminAuth, asyncHandler(GetDetailsByOMID));

// ---------------------------------------------------------------- JsonResult UpdatePendingDetails(int POMIDPP, int IMID, string productCode, string InvoieDate,
//   int Warrenty, string Sendby, string trackNo, string orderstatus)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdatePendingDetails{/:id}`, adminAuth,
  asyncHandler(async (req, res) => UpdatePendingDetails(req, res, { convertInvoiceDate: true })));

// ---------------------------------------------------------------- JsonResult CancelProduct(string cancelremark, int POMID)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/CancelProduct{/:id}`, adminAuth, asyncHandler(CancelProduct));

// public static String GetTimestamp(DateTime value): static => not an MVC action (never routable); logic in _shared/batch10D_common.js

module.exports = router;
