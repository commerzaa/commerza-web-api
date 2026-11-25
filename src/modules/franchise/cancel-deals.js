'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };
// Port of Franchise\Controllers\CustomerPanel\Cancel_Deals.cs (3 actions)
// route-config: franchisee/HT9e1iMr3ka7VZLPOcRz0w==deals -> Index
const NOL_PROPS = ['ALLIMAGES', 'BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'Remarks', 'ReturnDate', 'ExchangeDate', 'RefundedRemark', 'RefundedDate', 'INVAmount', 'EURAmount', 'INVPer', 'EURPer'];

/** ExportReport: returns {content} for the .xls (tab separated) or null when there is no record */
async function exportReport(a) {
  const page = a.page === undefined || a.page === null || a.page === '' ? 1 : pg(a.page);
  const rows = mapRows(await db.proc('shopping', 'usp_new_order_list', {
    STARTROWINDEX: page, MAXROWS: 999999, SEARCHFIELD: s(a.SearchField).trim(), SEARCHVALUE: s(a.SearchValue).trim(),
    FROMDATE: s(a.fromDate).trim(), TODATE: s(a.toDate).trim(), STATUS: s(a.status).trim(), STATUSTYPE: a.type,
    BRANCHID: 0, ORDERID: a.orderid, COMPANY: '', POID: '0', ORDERNO: a.Orderno, MODE: 1, STATUSID: '0', LOGINID: '',
    SORTBYDISPATCHORDER: a.sortbydispatchorder, ORDERSTATUS: '7',
  }), NOL_PROPS);
  if (!rows.length) return null;
  const tab = (v) => {
    if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.');
    return String(v).replace(/\t/g, '    ') + ' \t';
  };
  let out = 'S.No. \tProduct Name \tOrder Date \tOrder No \tOrder Id \tStatus \tQuantity \tActual Value \tShipping \tGST \tTotal \tCustomer Name \tCity  \tLogin ID  \tPayment Type  \tFull Address  \t';
  for (const Item of rows) {
    let line = '\n';
    try {
      line += tab(Item.rownumber) + tab(Item.Product_Name) + tab(Item.OrderDate) + tab(Item.Orderno) + tab(Item.orderID) + tab(Item.status)
        + tab(Item.order_QTY) + tab(Item.total_DAP) + tab(Item.Total_Ship_Ch) + tab(Item.ProductTotalVat) + tab(Item.total_purchase_cost)
        + tab(Item.Name) + tab(Item.City) + tab(Item.LoginId) + tab(Item.PayMode)
        + tab(String(Item.Address) + ',' + String(Item.City) + ' Pin' + String(Item.PinCode));
      out += line;
    } catch (e) {
      // legacy: the writer was closed on the first failing row, nothing more was written
      break;
    }
  }
  return { content: out };
}

// auth
router.all(['/franchise/Cancel_Deals/Index{/:id}', '/franchise/franchisee/HT9e1iMr3ka7VZLPOcRz0w==deals'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Orderno = '';
  let orderid = '';
  const SearchField = s(p.SearchField);
  const SearchValue = s(p.SearchValue);
  const sortbydispatchorder = p.sortbydispatchorder === undefined || p.sortbydispatchorder === null ? 'desc' : String(p.sortbydispatchorder);
  const ProductName = s(p.ProductName);
  if (ProductName !== '') {
    if (ProductName.length < 2) throw new Error('Index and length must refer to a location within the string.');
    if (ProductName.substring(0, 2) === 'OD') orderid = ProductName;
    else Orderno = ProductName;
  }
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const status = s(p.status);
  let type = s(p.type);
  if (type === 'manifest') type = 'ReadyToShip';
  const ddlcancelationType = p.ddlcancelationType === undefined || p.ddlcancelationType === null ? '0' : String(p.ddlcancelationType);
  const btnexel = p.btnexel;

  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const Totalcancel = await db.scalar('shopping', 'SELECT COUNT (DISTINCT ORDERID) FROM TBL_PRODUCT_ORDER_MASTER WHERE PLID = @b AND INTSTATUS = 7', { b: BranchId });
  const rows = await db.proc('shopping', 'usp_new_order_list_f', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate.trim(),
    TODATE: toDate.trim(), STATUS: status.trim(), STATUSTYPE: type, BRANCHID: BranchId, ORDERID: orderid, COMPANY: '', POID: '0',
    ORDERNO: Orderno, MODE: 1, STATUSID: '0', LOGINID: '', SORTBYDISPATCHORDER: sortbydispatchorder, ORDERSTATUS: '7', STATUSDATE: '',
    DOCKETNO: '', DDLCOURIER: '', MERCHANTNAME: '', PRODUCTNAME: '', DDLCANCELATIONTYPE: ddlcancelationType, CATEGORYRELATEDTO: '2', DID,
  });
  const TotalRecord = parseInt(outv(rows, 'TotalCount'), 10) || 0;
  const result = {
    Model: mapRows(rows, NOL_PROPS),
    Status: status,
    BranchId,
    Productname: ProductName,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate,
    toDate,
    Totalcancel,
    sortbydispatchorder,
    type,
  };
  if (btnexel === 'Export Excel') {
    const ex = await exportReport({ type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder });
    if (ex) {
      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Disposition', 'attachment; filename=Cancel_orderlist.xls');
      return res.send(ex.content);
    }
    result.Message = 'There is no record in excel';
  }
  return res.json(result);
}));

// auth
router.all('/franchise/Cancel_Deals/ParticularProductDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid === undefined || req.p.poid === '' ? null : req.p.poid;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc('shopping', 'usp_new_order_list', {
    STARTROWINDEX: 1, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', STATUS: '', STATUSTYPE: '', BRANCHID: 0,
    ORDERID: '', COMPANY: '', POID: poid, ORDERNO: '', MODE: 1, STATUSID: '0', LOGINID: '', SORTBYDISPATCHORDER: '', ORDERSTATUS: '7',
    STATUSDATE: '', DOCKETNO: '', DDLCOURIER: '', MERCHANTNAME: '', PRODUCTNAME: '', DDLCANCELATIONTYPE: '0', CATEGORYRELATEDTO: '2',
  });
  res.json(mapRows(rows, NOL_PROPS));
}));

// public (legacy action had no [SessionExpireCheck]; it is a void file-download action) -> kept protected as it reads order data
// auth
router.all('/franchise/Cancel_Deals/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ex = await exportReport({
    type: p.type, SearchField: p.SearchField, SearchValue: p.SearchValue, fromDate: p.fromDate, toDate: p.toDate, status: p.status,
    page: p.page, orderid: p.orderid, Orderno: p.Orderno, sortbydispatchorder: p.sortbydispatchorder,
  });
  if (!ex) return res.json({ Message: 'There is no record in excel' });
  res.setHeader('Content-Type', 'application/force-download');
  res.setHeader('Content-Disposition', 'attachment; filename=Cancel_orderlist.xls');
  return res.send(ex.content);
}));

module.exports = router;
