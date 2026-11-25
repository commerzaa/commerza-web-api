'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\New_Pending_Order.cs (class New_Pending_OrderController => /New_Pending_Order/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cvtInt, outIntOf, trimS, nowStamp, writeXlsExport, tab, cellStr, netFormat, dec2, col, nullRef,
} = require('./_shared/batch10-common');
const {
  ORDER_MGMT_PROPS, interopOrderExport, GetDetailsByOMID, UpdatePendingDetails, CancelProduct,
} = require('./_shared/batch10-d-common');

const router = express.Router();
const C = 'New_Pending_Order';

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (only written here).
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

const noSpaces = (v) => { if (v === null || v === undefined) throw nullRef(); return String(v).split(' ').join(''); };

// public void ExportReportOLd(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype)
async function ExportReportOLd(req, res, fromDate, toDate, SearchField, SearchValue, Type1, PRtype, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Order_online_Details_' + userid + '_' + nowStamp();
  await UtilityClass.GridPageSize(); // unused MaxRows
  // dbo.UPS_OrderDeatilsEXport @fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@STATUS,@UserName,@TOTALCOUNT out,@Type,@orderbydate,@SearchField,@SearchValue,@ProductType
  const rows = await db.proc(DB, 'UPS_OrderDeatilsEXport', {
    fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 1000000, STATUS: SearchField, UserName: '', Type: Type1, orderbydate: '', SearchField,
    SearchValue: trimS(SearchValue), ProductType: PRtype,
  });
  const obj1 = mapRows(rows, ORDER_MGMT_PROPS);
  if (obj1.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Order_Details.xls', Filename,
      headers: ['S.No.', 'OrderNo', 'OrderDate', 'Username', 'Customername', 'State', 'TotalAmount', 'Paymode', 'Status'],
      rows: obj1, innerProc: 'UPS_OrderDeatilsEXport', outerProc: 'UPS_OrderDeatilsEXport',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'ORDERID')) + ' \t');
        w(tab(netFormat(col(item, 'ORDERDATE'), 'dd-MM-yyyy')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(noSpaces(col(item, 'CUSTOMERNAME'))) + ' \t');
        w(tab(noSpaces(col(item, 'STATE'))) + ' \t');
        w(tab(dec2(col(item, 'TOTALAMOUNT'))) + ' \t');
        w(tab(cellStr(item, 'PAYMODE')) + ' \t');
        w(tab('OnlineOrder') + ' \t');
      },
    });
  }
  return { sent: false };
}

// public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype)  (Excel interop)
async function ExportReport(req, fromDate, toDate, SearchField, SearchValue, Type1, PRtype, ViewBag) {
  await UtilityClass.GridPageSize(); // unused MaxRows
  // dbo.UPS_OrderDeatils ... @STATUS = 1, @UserName = '', @Type = 1, @orderbydate = '', @SearchField, @SearchValue, @ProductType
  const rows = await db.proc(DB, 'UPS_OrderDeatils', {
    fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 1000000, STATUS: 1, UserName: '', Type: 1, orderbydate: '', SearchField,
    SearchValue: trimS(SearchValue), ProductType: PRtype,
  });
  const objAllOrderList = mapRows(rows, ORDER_MGMT_PROPS);
  if (objAllOrderList.length > 0) {
    await interopOrderExport({ req, rows: objAllOrderList, Type1, pending: true, ViewBag });
  }
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate,
//   string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side, int? Type,
//   int? hdnordertype, int? ProductType)
// auth (reads Session["Admin_User"]; legacy without a session hit NullReferenceException => catch view)
// route-config: "AdminPanel/New-Order" -> New_Pending_Order/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/New-Order'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let ProductType = nInt(req.p.ProductType); if (ProductType === null) ProductType = 0;
  let Type = nInt(req.p.Type); if (Type === null) Type = 1;
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
  let Userdownlinemember = nStr(req.p.Userdownlinemember); if (Userdownlinemember === null) Userdownlinemember = '';
  let OrderBy = nStr(req.p.OrderBy); if (OrderBy === null) OrderBy = '';
  let fromDate = nStr(req.p.fromDate); if (fromDate === null) fromDate = '';
  let toDate = nStr(req.p.toDate); if (toDate === null) toDate = '';
  let ByStatus = nStr(req.p.ByStatus); if (ByStatus === null) ByStatus = '';
  let page = nInt(req.p.page); if (page === null) page = 1;
  // Side defaulted to 0, releasepayout / hdnordertype unused
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  const btnexel = nStr(req.p.btnexel);
  let dynamicpagging = nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging; // AppSettings["DynamicPagging"]
    dynamicpagging = cvtInt(value === undefined ? null : value); // Convert.ToInt16 (outside the try in legacy)
  }
  let objAllOrderList = [];
  const MaxRows = dynamicpagging;
  const ViewBag = {};
  const out = {};
  try {
    let TotalRecord = 0;
    const Empid = req.user.emp_id;
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = ...
    if (!emp) throw nullRef();
    out.token = issueAdminToken(emp);
    const rows = await db.proc(DB, 'UPS_OrderDeatils', {
      fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows, STATUS: 1, UserName: '', Type: 1, orderbydate, SearchField,
      SearchValue: SearchValue.trim(), ProductType,
    });
    objAllOrderList = mapRows(rows, ORDER_MGMT_PROPS);
    TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      dynamicpagging, orderbydate, NoPerPage: await UtilityClass.GridNumbersPerPage(), CurrentPage: page, Userdownlinemember, GridPageSize: MaxRows,
      TotalRecord, SearchField, fromDate, toDate, SearchValue, ByStatus, OrderBy, ProductType: String(ProductType),
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReportOLd(req, res, fromDate, toDate, SearchField, SearchValue, String(Type), ProductType, ViewBag);
      if (r.sent) return undefined;
    }
    ViewBag.APIerror = 1;
    return res.json({ view: '~/Views/AdminPanel/New_Pending_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return res.json({ view: '~/Views/AdminPanel/New_Pending_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReportOLd(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReportOLd{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReportOLd(req, res, v('fromDate'), v('toDate'), v('SearchField'), v('SearchValue'), v('Type1'), nInt(req.p.PRtype), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- public void ExportReport(...)  (Excel interop, writes ~/AllExcelSheets/OrderDetails.xls)
// auth (PORT-NOTE: legacy had no session check; writes the order export file - protected with adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  await ExportReport(req, v('fromDate'), v('toDate'), v('SearchField'), v('SearchValue'), v('Type1'), nInt(req.p.PRtype), {});
  res.send(''); // void action
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByOMID(int OMID)
// auth (PORT-NOTE: legacy had no session check; returns customer invoice data - protected with adminAuth)
router.all(`/admin/${C}/GetDetailsByOMID{/:id}`, adminAuth, asyncHandler(GetDetailsByOMID));

// ---------------------------------------------------------------- JsonResult UpdatePendingDetails(...)  (@INVOICE_DATE passed as the raw string here)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdatePendingDetails{/:id}`, adminAuth,
  asyncHandler(async (req, res) => UpdatePendingDetails(req, res, { convertInvoiceDate: false })));

// ---------------------------------------------------------------- JsonResult CancelProduct(string cancelremark, int POMID)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/CancelProduct{/:id}`, adminAuth, asyncHandler(CancelProduct));

// public static String GetTimestamp(DateTime value): static => not an MVC action (never routable); logic in _shared/batch10D_common.js

module.exports = router;
