'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Return_Order.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Return_Order';

const NEWORDERLIST = ['ALLIMAGES', 'BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP',
  'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark',
  'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason',
  'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address',
  'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate',
  'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'Remarks', 'ReturnDate',
  'ExchangeDate', 'RefundedRemark', 'RefundedDate', 'INVAmount', 'EURAmount', 'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname',
  'merchantemailid', 'FULLNAME', 'EMAILID'];

function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k !== undefined ? row[k] : null;
}
const tabs = (v) => String(v).replace(/\t/g, '    '); // Regex.Replace(x.ToString(), "\t", "    ")
function nn(v) { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return v; }

// builds the tab separated sheet (ExportReport body); returns {message} or {filepath, content}
async function buildExport(type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder) {
  const BranchId = 0;
  if (page == null) page = 1;
  const rows = await db.proc('shopping', 'usp_new_order_list', {
    STARTROWINDEX: page, MAXROWS: 999999, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromDate.trim(), TODATE: toDate.trim(), STATUS: status.trim(), STATUSTYPE: type, BRANCHID: BranchId,
    ORDERID: orderid, COMPANY: '', POID: '0', ORDERNO: Orderno, MODE: 1, STATUSID: '0', LOGINID: '',
    SORTBYDISPATCHORDER: sortbydispatchorder, ORDERSTATUS: '8',
  });
  const list = mapRows(rows, NEWORDERLIST);
  try {
    if (list.length > 0) {
      let out = '';
      for (const h of ['S.No.', 'Product Name', 'Order Date', 'Order No', 'Order Id', 'Status', 'Quantity', 'Actual Value', 'Shipping', 'GST', 'Total',
        'Customer Name', 'City ', 'Login ID ', 'Payment Type ', 'Full Address ']) out += h + ' \t';
      for (const Item of list) {
        try {
          out += '\n';
          out += tabs(nn(Item.rownumber)) + ' \t';
          out += tabs(nn(Item.Product_Name)) + ' \t';
          out += tabs(nn(Item.OrderDate)) + ' \t';
          out += tabs(nn(Item.Orderno)) + ' \t';
          out += tabs(nn(Item.orderID)) + ' \t';
          out += tabs(nn(Item.status)) + ' \t';
          out += tabs(nn(Item.order_QTY)) + ' \t';
          out += tabs(nn(Item.total_DAP)) + ' \t';
          out += tabs(nn(Item.Total_Ship_Ch)) + ' \t';
          out += tabs(nn(Item.ProductTotalVat)) + ' \t';
          out += tabs(nn(Item.total_purchase_cost)) + ' \t';
          out += tabs(nn(Item.Name)) + ' \t';
          out += tabs(nn(Item.City)) + ' \t';
          out += tabs(nn(Item.LoginId)) + ' \t';
          out += tabs(nn(Item.PayMode)) + ' \t';
          out += tabs((Item.Address == null ? '' : Item.Address) + ',' + (Item.City == null ? '' : Item.City) + ' Pin' + (Item.PinCode == null ? '' : Item.PinCode)) + ' \t';
        } catch (ExpObj) {
          break; // legacy closed the writer in the catch; later writes failed, so nothing more is written
        }
      }
      // PORT-NOTE: legacy wrote ~/AllExcelSheets/return_orderlist.xls and redirected to it; the same file is saved and sent as download.
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, 'return_orderlist.xls');
      fs.writeFileSync(filepath, out);
      return { filepath, content: out };
    }
    return { message: 'There is no record in excel' };
  } catch (ExpObj) {
    return { filepath: ExpObj.message };
  }
}

function sendXls(res, content) {
  res.setHeader('Content-Type', 'application/force-download');
  res.setHeader('Content-Disposition', 'attachment; filename=Cancel_orderlist.xls');
  res.send(content);
}

// auth
// route-config: franchisee/lnEC2DwyRYPrbcFYdW4peA==
router.all([P + '/Index{/:id}', '/franchise/franchisee/lnEC2DwyRYPrbcFYdW4peA=='], auth, asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, ProductName, sortbydispatchorder, ddlcancelationType } = req.p;
  let Orderno = '';
  let orderid = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (sortbydispatchorder == null) sortbydispatchorder = 'desc';
  if (ProductName == null) ProductName = '';
  if (ProductName === '') {
    // nothing
  } else {
    const partnoveri = ProductName;
    if (partnoveri.length < 2) throw new Error('Index and length must refer to a location within the string.');
    const sub = partnoveri.substring(0, 2);
    if (sub === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  if (type === 'manifest') type = 'ReadyToShip';
  if (ddlcancelationType == null) ddlcancelationType = '0';
  const ViewBag = { Status: status };

  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page == null || page === '') ? 1 : parseInt(page, 10);
  const Totalcancel = await db.scalar('shopping',
    'SELECT COUNT (DISTINCT ORDERID) FROM TBL_PRODUCT_ORDER_MASTER WHERE PLID = @BranchId AND INTSTATUS = 8', { BranchId });
  const rows = await db.proc('shopping', 'usp_new_order_list_f', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromDate.trim(), TODATE: toDate.trim(), STATUS: status.trim(), STATUSTYPE: type, BRANCHID: BranchId,
    ORDERID: orderid, COMPANY: '', POID: '0', ORDERNO: Orderno, MODE: 1, STATUSID: '0', LOGINID: '',
    SORTBYDISPATCHORDER: sortbydispatchorder, ORDERSTATUS: '8', STATUSDATE: '', DOCKETNO: '', DDLCOURIER: '', MERCHANTNAME: '',
    PRODUCTNAME: '', DDLCANCELATIONTYPE: ddlcancelationType, CATEGORYRELATEDTO: '1', DID,
  });
  const objAllOrderList = mapRows(rows, NEWORDERLIST);
  const TotalRecord = parseInt(outVal(rows[0], 'TotalCount') != null ? outVal(rows[0], 'TotalCount') : 0, 10);
  ViewBag.Productname = ProductName;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.Totalcancel = Totalcancel;
  ViewBag.sortbydispatchorder = sortbydispatchorder;
  ViewBag.type = type;
  if (btnexel === 'Export Excel') {
    const r = await buildExport(type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder);
    if (r.content !== undefined) return sendXls(res, r.content);
    if (r.message) ViewBag.Message = r.message;
    if (r.filepath) ViewBag.filepath = r.filepath;
  }
  res.json({ Model: objAllOrderList, ViewBag, ...ViewBag });
}));

// auth
router.all(P + '/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder } = req.p;
  // legacy would throw NullReference on null strings (.Trim())
  for (const v of [SearchField, SearchValue, fromDate, toDate, status]) if (v == null) throw new Error('Object reference not set to an instance of an object.');
  page = (page == null || page === '') ? null : parseInt(page, 10);
  const r = await buildExport(type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder);
  if (r.content !== undefined) return sendXls(res, r.content);
  res.json({ ...(r.message ? { Message: r.message } : {}), ...(r.filepath ? { filepath: r.filepath } : {}) });
}));

// auth
router.all(P + '/UpdateOrderStatus{/:id}', auth, asyncHandler(async (req, res) => {
  const { poid, orderid, QcStatus, SelectedAction, CommentOrRemark } = req.p;
  const BranchId = 0;
  const o = await db.procOne('shopping', 'usp_repackorrefund', {
    PLID: BranchId, STATUS: 'Return', POID: poid, ORDERID: orderid, QCSTATUS: QcStatus,
    SELECTEDACTION: SelectedAction, COMMENTORREMARK: CommentOrRemark,
  });
  const ReturnMessage = outVal(o, 'STRRESULT') != null ? String(outVal(o, 'STRRESULT')) : (o ? String(o[Object.keys(o)[0]]) : '');
  res.json(ReturnMessage);
}));

module.exports = router;
