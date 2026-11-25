'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/pending_order.cs (pending_orderController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { proc, exec, scalar } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'pending_order';

// ---- helpers -------------------------------------------------------------------------------------------
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const tabClean = (v) => String(v).replace(/\t/g, '    '); // Regex.Replace(x, "\t", "    ")
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
/** C# string.Trim() on a possibly-null string */
const trim = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).trim(); };
/** x.ToString() on a possibly-null property */
const ts = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); };

// OrderList model (declared in Order_List.cs)
const PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt', 'order_QTY', 'OrderDate',
  'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name',
  'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch',
  'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno',
  'couriername', 'DocketNO', 'DateDiff', 'Morderid', 'Invoiceno', 'PrSKUCode', 'PaidViaCashWallet', 'PaidViaCahbackWallet', 'PaidViaKreazVoucher', 'PaidViaOnline',
  'EMAILID', 'FULLNAME', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'CODPAYMENT'];

/** Order => { orderid, Orderno } ("OD" prefix => orderid, otherwise Orderno) */
function splitOrder(Order) {
  let Orderno = '';
  let orderid = '';
  if (Order === null || Order === undefined) Order = '';
  if (Order !== '') {
    const partnoveri = Order;
    if (partnoveri.length < 2) throw new RangeError('Index and length must refer to a location within the string.'); // Substring(0, 2)
    const sub = partnoveri.substring(0, 2);
    if (sub === 'OD') orderid = Order;
    else Orderno = Order;
  }
  return { Orderno, orderid, Order };
}

function listProc(a) {
  return proc(DB, 'usp_order_list_complete_new', {
    startrowindex: a.page, maxrows: a.MaxRows, searchfield: trim(a.SearchField), searchvalue: trim(a.SearchValue), fromdate: trim(a.fromDate), todate: trim(a.toDate),
    status: trim(a.statusid), statustype: a.type, branchid: a.BranchId, fromreadyfordispatch: a.fromReadyforDispatch, toreadyfordispatch: a.toReadyforDispatch,
    orderid: a.orderid, orderno: a.Orderno,
  });
}

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(req, res, a) {
  const ViewBag = {};
  const { Orderno, orderid } = splitOrder(a.Order);
  let type = a.type;
  if (type === null || type === undefined) type = '2';
  const BranchId = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = a.page;
  if (page === null || page === undefined || page === '') page = 1; else page = parseInt(page, 10);
  const rows = await listProc({ ...a, page, MaxRows, type, BranchId, orderid, Orderno });
  const objAllOrderList = mapRows(rows, PROPS);
  try {
    if (objAllOrderList.length > 0) {
      const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'pending_order.xls');
      ViewBag.filepath = filepath;
      let out = '';
      out += 'S.No. \t';
      out += 'Product Name \t';
      out += 'Order Date \t';
      out += 'Order No \t';
      out += 'Order Id \t';
      out += 'Status \t';
      out += 'Quantity \t';
      out += 'Actual Value \t';
      out += 'Shipping \t';
      out += 'GST \t';
      out += 'Total \t';
      out += 'Redeem JP \t';
      out += 'After Date \t';
      out += 'By Date \t';
      out += 'Earn BV  \t';
      out += 'Customer Name \t';
      out += 'City  \t';
      out += 'Login ID  \t';
      out += 'Payment Type  \t';
      out += 'Full Address  \t';
      for (const item of objAllOrderList) {
        try {
          out += '\n';
          out += tabClean(ts(item.rownumber)) + ' \t';
          out += tabClean(ts(item.Product_Name)) + ' \t';
          out += tabClean(ts(item.OrderDate)) + ' \t';
          out += tabClean(ts(item.Orderno)) + ' \t';
          out += tabClean(ts(item.orderID)) + ' \t';
          out += tabClean(ts(item.status)) + ' \t';
          out += tabClean(ts(item.order_QTY)) + ' \t';
          out += tabClean(ts(item.total_DAP)) + ' \t';
          out += tabClean(ts(item.Total_Ship_Ch)) + ' \t';
          out += tabClean(ts(item.ProductTotalVat)) + ' \t';
          out += tabClean(ts(item.total_purchase_cost)) + ' \t';
          out += tabClean(ts(item.JP)) + ' \t';
          if (item.Approved === 'Jan  1 1900 12:00AM') out += 'N.A.';
          else out += tabClean(ts(item.Approved)) + ' \t';
          if (item.dispatchdate === 'Jan  1 1900 12:00AM') out += 'N.A.';
          else out += tabClean(ts(item.dispatchdate)) + ' \t';
          out += tabClean(ts(item.BV)) + ' \t';
          out += tabClean(ts(item.Name)) + ' \t';
          out += tabClean(ts(item.City)) + ' \t';
          out += tabClean(ts(item.LoginId)) + ' \t';
          out += tabClean(ts(item.PayMode)) + ' \t';
          out += tabClean((item.Address == null ? '' : item.Address) + ',' + (item.City == null ? '' : item.City) + ' Pin' + (item.PinCode == null ? '' : item.PinCode)) + ' \t';
        } catch (e) { break; } // legacy: catch { ...; wr.Close(); } - every later write hits the closed writer
      }
      fs.writeFileSync(filepath, out);
      // PORT-NOTE: legacy redirected to ~/AllExcelSheets/pending_order.xls; the file content is sent directly as the download
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=pending_order.xls');
      res.send(out);
      return { sent: true };
    }
    ViewBag.Message = 'There is no record in excel';
  } catch (ExpObj) {
    ViewBag.filepath = ExpObj.message;
  }
  return { sent: false, ViewBag };
}

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  let { type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, statusid, Order } = req.p;
  if (Order === null || Order === undefined) Order = '';
  const { Orderno, orderid } = splitOrder(Order);
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (fromReadyforDispatch == null) fromReadyforDispatch = '';
  if (toReadyforDispatch == null) toReadyforDispatch = '';
  if (statusid == null) statusid = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '2';
  const ViewBag = { Status: status };
  const BranchId = req.user.plid;
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1; else page = parseInt(page, 10);
  if (Number.isNaN(page)) throw new Error('The parameters dictionary contains an invalid entry for parameter \'page\'.');
  const rows = await listProc({ page, MaxRows, SearchField, SearchValue, fromDate, toDate, statusid, type, BranchId, fromReadyforDispatch, toReadyforDispatch, orderid, Orderno });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  const objAllOrderList = mapRows(rows, PROPS);
  if (orderid === '') ViewBag.Orderno = Orderno;
  else ViewBag.Orderno = orderid;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.status = status;
  ViewBag.fromReadyforDispatch = fromReadyforDispatch;
  ViewBag.toReadyforDispatch = toReadyforDispatch;
  ViewBag.statusid = statusid;
  ViewBag.type = type;
  if (btnexel === 'Export Excel') {
    const r = await exportReport(req, res, { type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, statusid, Order });
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  res.json({ view: '~/Views/pending_order/Index.cshtml', Model: objAllOrderList, ViewBag });
});

// auth (no session check in legacy, but reads Session["Plid"])
// route-config: merchant/_plus_O8iwOz_slash_ZX7rbcFYdW4peA==
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/_plus_O8iwOz_slash_ZX7rbcFYdW4peA=='], auth, indexHandler);

// ---- UpdateStatuslist ----------------------------------------------------------------------------------
// auth (no session check in legacy; acts on orders of a logged-in merchant)
router.all(`/merchant/${C}/UpdateStatuslist{/:id}`, auth, asyncHandler(async (req, res) => {
  const isSelected = req.p.isSelected;
  if (isSelected === null || isSelected === undefined) throw NRE();
  const tokens = String(isSelected).split(',');
  const status = parseInt(req.p.activinactiv, 10);
  if (Number.isNaN(status)) throw new Error('The parameters dictionary contains a null entry for parameter \'activinactiv\' of non-nullable type \'System.Int32\'.');
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== '') {
      await exec(DB, "update tbl_product_order_master set intstatus = 6, status = 'Delivered' where orderno = @orderno", { orderno: tokens[i] });
      await exec(DB, 'update tbl_order_confirmedstaus set delivered = fun_getcurrentdate() where orderno = @orderno', { orderno: tokens[i] });
    }
  }
  res.json(status);
}));

// ---- UpdateStatusProduct -------------------------------------------------------------------------------
// auth (no session check in legacy; reads Session["Plid"])
router.all(`/merchant/${C}/UpdateStatusProduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const { loginid, orderid, statusdate } = req.p;
  const nInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
  const statusid = nInt(req.p.statusid);
  const poid = nInt(req.p.poid);
  const BranchId = req.user.plid;
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '', branchid: BranchId,
    orderid: orderid === undefined ? null : orderid, company: '', poid, orderno: '', mode: 6, statusid, loginid: loginid === undefined ? null : loginid,
    sortbydispatchorder: '', orderstatus: '0', statusdate: statusdate === undefined ? null : statusdate,
  });
  // PORT-NOTE: legacy result = ExecuteSqlCommand(...) rows-affected count is not available from a PostgreSQL function; the number of returned rows is used
  const result = Array.isArray(rows) ? rows.length : 0;
  res.json(result);
}));

// ---- ExportReport --------------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const { type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, statusid, Order } = req.p;
  const r = await exportReport(req, res, { type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, statusid, Order });
  if (!r.sent) res.json({ ViewBag: r.ViewBag });
}));

module.exports = router;
