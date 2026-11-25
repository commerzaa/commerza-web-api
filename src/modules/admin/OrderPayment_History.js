'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\OrderPayment_History.cs (class OrderPayment_HistoryController => /OrderPayment_History/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, excelLink, inlinePerms, nowStamp, writeXlsExport, tab, cellStr, outIntOf, outOf, trimS, netFormat, dec2, col, nullRef,
} = require('./_shared/batch10_common');

const router = express.Router();
const C = 'OrderPayment_History';

/** class OrderPayment_details */
const PROPS = ['ROWNUMBER', 'ORDERDATE', 'ORDERNUMBER', 'PayMode', 'PAYMENTDATE', 'CONFIRMATIONDATE', 'AMOUNT', 'STATUS', 'Color', 'DDNO', 'DDAmount',
  'PaymentSTATUS', 'SHIPPINGCHARGE', 'State'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests.
let url = '';
let url1 = '';

// public void ExportReport(string OrderNumber, string FromDate, string ToDate, string SearchField, string SearchValue)
async function ExportReport(req, res, OrderNumber, FromDate, ToDate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Order_History' + userid + '_' + nowStamp();
  // db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault() -> loginid (unused afterwards)
  const row = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
  let loginid = ''; // eslint-disable-line no-unused-vars
  if (row) loginid = col(row, 'username');
  // DBO.USP_OrderPaymentHistory @ORDERNUMBER,@Fromdate,@ToDate,@STARTROWINDEX,@MAXROWS,@TOTALCOUNT out,@PayMode,@SearchField,@SearchValue,
  //   @PaymentType,@OrderType,@Amount out,@SHIPPINGCHARGE out
  const rows = await db.proc(DB, 'USP_OrderPaymentHistory', {
    ORDERNUMBER: OrderNumber, Fromdate: FromDate, ToDate, STARTROWINDEX: 1, MAXROWS: 100000, PayMode: 0, SearchField,
    SearchValue: trimS(SearchValue), PaymentType: 0, OrderType: 0,
  });
  const MemberORDERGST = mapRows(rows, PROPS);
  ViewBag.Amount = outOf(rows, 'amount');
  ViewBag.SHIPPINGCHARGE = outOf(rows, 'shippingcharge');
  const dir = path.join(config.uploadDir, 'AllExcelSheets');
  const filepath = path.join(dir, 'Order_History.xls');
  ViewBag.filepath = filepath;
  if (MemberORDERGST.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Order_History.xls', Filename,
      headers: ['S.No.', 'OrderNo', 'OrderDate', 'State', 'Amount', 'ShippingCharge', 'Status'],
      rows: MemberORDERGST, innerProc: 'PRODUCTGST', outerProc: 'USP_TDS_INCOME_REPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'ORDERNUMBER')) + ' \t');
        w(tab(netFormat(col(item, 'ORDERDATE'), 'dd-MM-yyyy')) + ' \t');
        const state = col(item, 'State');
        if (state === null || state === undefined) throw nullRef();
        const state1 = String(state).split(' ').join('');
        w(tab(state1) + ' \t');
        w(tab(dec2(col(item, 'AMOUNT'))) + ' \t');
        w(tab(dec2(col(item, 'SHIPPINGCHARGE'))) + ' \t');
        w(tab(cellStr(item, 'STATUS')) + ' \t');
      },
      trailer: (w) => {
        w('\n');
        w(tab('') + ' \t');
        w(tab('') + ' \t');
        w(tab('') + ' \t');
        w(tab('TotalAmount') + ' \t');
        w(tab(ViewBag.Amount) + ' \t');
        w(tab(ViewBag.SHIPPINGCHARGE) + ' \t');
      },
    });
  }
  // No rows: legacy deleted the old sheet and opened (created) an empty one with a StreamWriter that was never closed; no download.
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  fs.writeFileSync(filepath, '');
  return { sent: false };
}

// ---------------------------------------------------------------- Index(string OrderNumber, string FromDate, string ToDate, string PayMode, int? page,
//   int? dynamicpagging, int? PaymentType, int? OrderType, string SearchField, string SearchValue, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Order-PaymentHistory" -> OrderPayment_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Order-PaymentHistory'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  }
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  let OrderNumber = nStr(req.p.OrderNumber); if (OrderNumber === null) OrderNumber = '';
  let PaymentType = nInt(req.p.PaymentType); if (PaymentType === null) PaymentType = 0;
  let OrderType = nInt(req.p.OrderType); if (OrderType === null) OrderType = 0;
  let FromDate = nStr(req.p.FromDate); if (FromDate === null) FromDate = '';
  let ToDate = nStr(req.p.ToDate); if (ToDate === null) ToDate = '';
  let PayMode = nStr(req.p.PayMode); if (PayMode === null) PayMode = '';
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  const ip = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  const MaxRows = dynamicpagging;
  let page = nInt(req.p.page); if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_OrderPaymentHistory', {
    ORDERNUMBER: OrderNumber, Fromdate: FromDate, ToDate, STARTROWINDEX: page, MAXROWS: MaxRows, PayMode, SearchField,
    SearchValue: SearchValue.trim(), PaymentType, OrderType,
  });
  const OrderPayDetails = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, dynamicpagging, NoPerPage: await UtilityClass.GridNumbersPerPage(), To_Date: ToDate,
    SearchField, SearchValue, From_Date: FromDate, Order_Number: OrderNumber, Pay_Mode: PayMode,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, OrderNumber, FromDate, ToDate, SearchField, SearchValue, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/OrderPayment_History/Index.cshtml', Model: OrderPayDetails, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string OrderNumber, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('OrderNumber'), v('FromDate'), v('ToDate'), v('SearchField'), v('SearchValue'), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
