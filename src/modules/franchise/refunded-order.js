'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Refunded_Order.cs (Refunded_OrderController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { proc, scalar } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

const ORDER_PROPS = ['ALLIMAGES', 'BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered',
  'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'Remarks', 'ReturnDate', 'ExchangeDate', 'RefundedRemark', 'RefundedDate', 'INVAmount',
  'EURAmount', 'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemailid', 'FULLNAME', 'EMAILID'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}
const tabClean = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).replace(/\t/g, '    '); };

// ---- ExportReport (public void action; also called from Index) ------------------------------------------
/** returns true when the download response has been sent */
async function ExportReport(req, res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder) {
  const BranchId = 0;
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: page, maxrows: 999999, searchfield: nn(SearchField).trim(), searchvalue: nn(SearchValue).trim(), fromdate: nn(fromDate).trim(),
    todate: nn(toDate).trim(), status: nn(status).trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno,
    mode: 1, statusid: '0', loginid: '', sortbydispatchorder, orderstatus: '9',
  });
  const objAllOrderList = mapRows(rows, ORDER_PROPS);
  try {
    if (objAllOrderList.length > 0) {
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, 'exchanged_orderlist.xls');
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      let out = '';
      for (const h of ['S.No.', 'Product Name', 'Order Date', 'Order No', 'Order Id', 'Status', 'Quantity', 'Actual Value', 'Shipping', 'GST', 'Total',
        'Customer Name', 'City ', 'Login ID ', 'Payment Type ', 'Full Address ']) out += h + ' \t';
      let closed = false; // after the first failing row the legacy StreamWriter is closed and later writes throw (swallowed)
      for (const Item of objAllOrderList) {
        if (closed) continue;
        try {
          out += '\n';
          out += tabClean(Item.rownumber) + ' \t';
          out += tabClean(Item.Product_Name) + ' \t';
          out += tabClean(Item.OrderDate) + ' \t';
          out += tabClean(Item.Orderno) + ' \t';
          out += tabClean(Item.orderID) + ' \t';
          out += tabClean(Item.status) + ' \t';
          out += tabClean(Item.order_QTY) + ' \t';
          out += tabClean(Item.total_DAP) + ' \t';
          out += tabClean(Item.Total_Ship_Ch) + ' \t';
          out += tabClean(Item.ProductTotalVat) + ' \t';
          out += tabClean(Item.total_purchase_cost) + ' \t';
          out += tabClean(Item.Name) + ' \t';
          out += tabClean(Item.City) + ' \t';
          out += tabClean(Item.LoginId) + ' \t';
          out += tabClean(Item.PayMode) + ' \t';
          out += tabClean(nn(Item.Address) + ',' + nn(Item.City) + ' Pin' + nn(Item.PinCode)) + ' \t';
        } catch (ExpObj) {
          closed = true;
        }
      }
      fs.writeFileSync(filepath, out);
      // legacy: force-download headers + Response.Redirect("~/AllExcelSheets/exchanged_orderlist.xls")
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Cancel_orderlist.xls');
      res.send(out);
      return true;
    }
    // ViewBag.Message = "There is no record in excel";
  } catch (ExpObj) {
    // ViewBag.filepath = ExpObj.Message;
  }
  return false;
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/refundedlnEC2DwyRYPrbcFYdW4peA==
// auth ([SessionExpireCheck])
router.all(['/franchise/Refunded_Order/Index{/:id}', '/franchise/franchisee/refundedlnEC2DwyRYPrbcFYdW4peA=='], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Orderno = '';
  let orderid = '';
  let SearchField = nn(p.SearchField);
  let SearchValue = nn(p.SearchValue);
  const sortbydispatchorder = p.sortbydispatchorder == null ? 'desc' : String(p.sortbydispatchorder);
  const ProductName = nn(p.ProductName);
  if (ProductName !== '') {
    if (ProductName.length < 2) throw new RangeError('Index and length must refer to a location within the string.');
    const sub = ProductName.substring(0, 2);
    if (sub === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  const fromDate = nn(p.fromDate);
  const toDate = nn(p.toDate);
  const status = nn(p.status);
  let type = nn(p.type);
  if (type === 'manifest') type = 'ReadyToShip';
  const ddlcancelationType = p.ddlcancelationType == null ? '0' : String(p.ddlcancelationType);
  const btnexel = p.btnexel;
  let page = parseInt(p.page, 10); if (Number.isNaN(page)) page = null;

  const ViewBag = { Status: status };
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const Totalcancel = Number(await scalar(DB, 'SELECT COUNT(DISTINCT orderid) FROM tbl_product_order_master WHERE plid = @plid AND intstatus = 10', { plid: BranchId })) || 0;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_new_order_list_f', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    status: status.trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder, orderstatus: '10', statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '',
    ddlcancelationtype: ddlcancelationType, categoryrelatedto: '1', did: DID,
  });
  const objAllOrderList = mapRows(rows, ORDER_PROPS);
  const TotalRecord = totalOf(rows, 'totalcount');
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
    const done = await ExportReport(req, res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder);
    if (done) return undefined;
  }
  return res.json({ view: '~/Views/Refunded_Order/Index.cshtml', Model: objAllOrderList, ViewBag });
}));

// ---- ExportReport (public void action) -------------------------------------------------------------------
// auth
router.all('/franchise/Refunded_Order/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let page = parseInt(p.page, 10); if (Number.isNaN(page)) page = null;
  const done = await ExportReport(req, res, p.type, p.SearchField, p.SearchValue, p.fromDate, p.toDate, p.status, page, p.btnexel, p.orderid, p.Orderno, p.sortbydispatchorder);
  if (done) return undefined;
  return res.status(200).end();
}));

module.exports = router;
