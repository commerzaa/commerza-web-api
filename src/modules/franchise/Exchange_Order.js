'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\Exchange_Order.cs (Exchange_OrderController)
 * Actions: Index, ExportReport, UpdateOrderStatus (3)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const NEWORDERLIST_PROPS = ['ALLIMAGES', 'BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered',
  'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'Remarks', 'ReturnDate', 'ExchangeDate', 'RefundedRemark', 'RefundedDate', 'INVAmount', 'EURAmount',
  'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemailid', 'FULLNAME', 'EMAILID'];

const s = (v) => (v === null || v === undefined ? '' : String(v));
const cell = (v) => `${s(v).replace(/\t/g, '    ')} \t`;
const totalOf = (rows) => {
  const f = rows && rows[0];
  const v = f ? (f.totalcount !== undefined ? f.totalcount : f.recordcount) : 0;
  return parseInt(v === null || v === undefined ? 0 : v, 10) || 0;
};

async function ExportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder) {
  const BranchId = 0;
  if (page == null) page = 1;
  const rows = await db.proc(DB, 'USP_NEW_ORDER_LIST', {
    STARTROWINDEX: page, MAXROWS: 999999, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate.trim(), TODATE: toDate.trim(),
    STATUS: status.trim(), STATUSTYPE: type, BRANCHID: BranchId, ORDERID: orderid, COMPANY: '', POID: '0', ORDERNO: Orderno, MODE: 1, STATUSID: '0',
    LOGINID: '', SORTBYDISPATCHORDER: sortbydispatchorder, ORDERSTATUS: '9',
  });
  const list = mapRows(rows, NEWORDERLIST_PROPS);
  try {
    if (list.length > 0) {
      let out = '';
      for (const h of ['S.No.', 'Product Name', 'Order Date', 'Order No', 'Order Id', 'Status', 'Quantity', 'Actual Value', 'Shipping', 'GST', 'Total', 'Customer Name', 'City ', 'Login ID ', 'Payment Type ', 'Full Address ']) out += `${h} \t`;
      for (const Item of list) {
        out += '\n';
        out += cell(Item.rownumber) + cell(Item.Product_Name) + cell(Item.OrderDate) + cell(Item.Orderno) + cell(Item.orderID) + cell(Item.status)
          + cell(Item.order_QTY) + cell(Item.total_DAP) + cell(Item.Total_Ship_Ch) + cell(Item.ProductTotalVat) + cell(Item.total_purchase_cost)
          + cell(Item.Name) + cell(Item.City) + cell(Item.LoginId) + cell(Item.PayMode) + cell(`${s(Item.Address)},${s(Item.City)} Pin${s(Item.PinCode)}`);
      }
      // PORT-NOTE: legacy wrote /AllExcelSheets/exchanged_orderlist.xls then redirected; the same content is streamed as the download.
      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Disposition', 'attachment; filename=Cancel_orderlist.xls');
      res.send(out);
      return { sent: true };
    }
    return { Message: 'There is no record in excel' };
  } catch (e) {
    return { filepath: e.message };
  }
}

// route-config
// auth
router.all(['/franchise/Exchange_Order/Index{/:id}', '/franchise/franchisee/exchnagelnEC2DwyRYPrbcFYdW4peA=='], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let { type, SearchField, SearchValue, fromDate, toDate, status, ProductName, sortbydispatchorder, ddlcancelationType } = p;
  const btnexel = p.btnexel;
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  let Orderno = '', orderid = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (sortbydispatchorder == null) sortbydispatchorder = 'desc';
  if (ProductName == null) ProductName = '';
  if (ProductName !== '') {
    if (ProductName.length < 2) throw new Error('Index and length must refer to a location within the string.');
    const sub = ProductName.substring(0, 2);
    if (sub === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  if (type === 'manifest') type = 'ReadyToShip';
  if (ddlcancelationType == null) ddlcancelationType = '0';
  SearchField = s(SearchField); SearchValue = s(SearchValue); fromDate = s(fromDate); toDate = s(toDate); status = s(status);

  const ViewBag = { Status: status };
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const Totalcancel = Number(await db.scalar(DB, 'SELECT COUNT (DISTINCT ORDERID) FROM TBL_PRODUCT_ORDER_MASTER WHERE PLID = @b AND INTSTATUS = 9', { b: BranchId })) || 0;
  const rows = await db.proc(DB, 'USP_NEW_ORDER_LIST_F', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate.trim(), TODATE: toDate.trim(),
    STATUS: status.trim(), STATUSTYPE: type, BRANCHID: BranchId, orderid, Company: '', POID: '0', ORDERNO: Orderno, MODE: 1, STATUSID: '0', LOGINID: '',
    SORTBYDISPATCHORDER: sortbydispatchorder, ORDERSTATUS: '9', STATUSDATE: '', DOCKETNO: '', DDLCOURIER: '', MERCHANTNAME: '', PRODUCTNAME: '',
    DDLCANCELATIONTYPE: ddlcancelationType, CATEGORYRELATEDTO: '1', DID,
  });
  const objAllOrderList = mapRows(rows, NEWORDERLIST_PROPS);
  ViewBag.Productname = ProductName;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(rows);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.Totalcancel = Totalcancel;
  ViewBag.sortbydispatchorder = sortbydispatchorder;
  ViewBag.type = type;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder);
    if (r.sent) return undefined;
    Object.assign(ViewBag, r);
  }
  return res.json({ Model: objAllOrderList, ViewBag });
}));

// auth
router.all('/franchise/Exchange_Order/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const r = await ExportReport(res, s(p.type), s(p.SearchField), s(p.SearchValue), s(p.fromDate), s(p.toDate), s(p.status),
    p.page === undefined || p.page === '' ? null : parseInt(p.page, 10), s(p.orderid), s(p.Orderno), s(p.sortbydispatchorder));
  if (r.sent) return undefined;
  return res.json(r);
}));

// auth
router.all('/franchise/Exchange_Order/UpdateOrderStatus{/:id}', auth, asyncHandler(async (req, res) => {
  const { poid, orderid, QcStatus, SelectedAction, CommentOrRemark } = req.p;
  const BranchId = 0;
  const r = await db.procOne(DB, 'USP_REPACKORREFUND', { PLID: BranchId, STATUS: 'Exchange', POID: poid, ORDERID: orderid, QCSTATUS: QcStatus, SELECTEDACTION: SelectedAction, COMMENTORREMARK: CommentOrRemark });
  const ReturnMessage = r ? s(r.strresult) : 'ok';
  res.json(ReturnMessage);
}));

module.exports = router;
