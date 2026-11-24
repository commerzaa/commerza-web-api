'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\Return_Order.cs  (database: shopping - Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const P = '/merchant/Return_Order';

// NewOrderList (Active_Order.cs, Merchant Panel)
const NEWORDERLIST = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'EMAILID', 'Name', 'FULLNAME', 'order_DAP',
  'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark',
  'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason',
  'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address',
  'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate',
  'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'PrSKUCode',
  'PaidViaCashWallet', 'PaidViaCahbackWallet', 'PaidViaKreazVoucher', 'PaidViaOnline', 'CODPAYMENT', 'Distributorname', 'COMPANYNAME'];

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// DataSet.GetXml() equivalent (table dsData; NULL columns omitted)
const dsXml = (rows) => (!rows.length ? '<NewDataSet />'
  : '<NewDataSet>' + rows.map((r) => '<dsData>' + Object.keys(r).filter((k) => r[k] !== null && r[k] !== undefined)
    .map((k) => `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`).join('') + '</dsData>').join('') + '</NewDataSet>');
const intOrNull = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k !== undefined ? row[k] : null;
}
const tabs = (v) => String(v).replace(/\t/g, '    '); // Regex.Replace(x.ToString(), "\t", "    ")
function nn(v) { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return v; }

// public void ExportReport(...) - builds the tab separated sheet; returns {message} | {filepath, content}
async function buildExport(BranchId, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder) {
  if (page == null) page = 1;
  const rows = await db.proc(DB, 'usp_new_order_list', {
    startrowindex: page, maxrows: 999999, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromDate.trim(), todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId,
    orderid, company: '', poid: '0', orderno: Orderno, mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder, orderstatus: '8',
  });
  const list = mapRows(rows, NEWORDERLIST);
  try {
    if (list.length > 0) {
      let out = '';
      for (const h of ['S.No.', 'Product Name', 'Order Date', 'Order No', 'Order Id', 'Status', 'Quantity', 'Actual Value', 'Shipping', 'GST', 'Total',
        'Customer Name', 'City ', 'Login ID ', 'Payment Type ', 'Full Address ']) out += h + ' \t';
      for (const item of list) {
        try {
          out += '\n';
          out += tabs(nn(item.rownumber)) + ' \t';
          out += tabs(nn(item.Product_Name)) + ' \t';
          out += tabs(nn(item.OrderDate)) + ' \t';
          out += tabs(nn(item.Orderno)) + ' \t';
          out += tabs(nn(item.orderID)) + ' \t';
          out += tabs(nn(item.status)) + ' \t';
          out += tabs(nn(item.order_QTY)) + ' \t';
          out += tabs(nn(item.total_DAP)) + ' \t';
          out += tabs(nn(item.Total_Ship_Ch)) + ' \t';
          out += tabs(nn(item.ProductTotalVat)) + ' \t';
          out += tabs(nn(item.total_purchase_cost)) + ' \t';
          out += tabs(nn(item.Name)) + ' \t';
          out += tabs(nn(item.City)) + ' \t';
          out += tabs(nn(item.LoginId)) + ' \t';
          out += tabs(nn(item.PayMode)) + ' \t';
          out += tabs((item.Address == null ? '' : item.Address) + ',' + (item.City == null ? '' : item.City) + ' Pin' + (item.PinCode == null ? '' : item.PinCode)) + ' \t';
        } catch (ExpObj) {
          break; // legacy closed the writer in the catch; later writes failed, so nothing more is written
        }
      }
      // PORT-NOTE: legacy wrote ~/AllExcelSheets/Return_orderlist.xls and redirected to it; the same file is saved and sent as download.
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, 'Return_orderlist.xls');
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
  res.setHeader('Content-Disposition', 'attachment; filename=Return_orderlist.xls');
  res.send(content);
}

// auth ([SessionExpireCheck])
// route-config: merchant/lnEC2DwyRYPrbcFYdW4peA==
router.all([P + '/Index{/:id}', '/merchant/lnEC2DwyRYPrbcFYdW4peA=='], ...guard, asyncHandler(async (req, res) => {
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

  const BranchId = Number(req.user.plid);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page == null || page === '') ? 1 : parseInt(page, 10);
  const Totalcancel = await db.scalar(DB,
    'SELECT COUNT (DISTINCT Orderid) FROM TBL_PRODUCT_ORDER_MASTER where plid = @BranchId and IntStatus = 8', { BranchId });
  if (!/^[+-]?\d+$/.test(String(ddlcancelationType).trim())) throw new Error('Input string was not in a correct format.');
  const rows = await db.proc(DB, 'usp_new_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromDate.trim(), todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId,
    orderid, company: '', poid: '0', orderno: Orderno, mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder, orderstatus: '8', statusdate: '', docketno: '', ddlcourier: '', merchantname: '',
    productname: '', ddlcancelationtype: parseInt(ddlcancelationType, 10),
  });
  const objAllOrderList = mapRows(rows, NEWORDERLIST);
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row
  const tc = outVal(rows[0], 'TotalCount');
  const TotalRecord = parseInt(tc != null ? tc : 0, 10);
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
    const r = await buildExport(BranchId, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder);
    if (r.content !== undefined) return sendXls(res, r.content);
    if (r.message) ViewBag.Message = r.message;
    if (r.filepath) ViewBag.filepath = r.filepath;
  }
  res.json({ Model: objAllOrderList, ViewBag, ...ViewBag });
}));

// auth (legacy: no explicit check, reads Session["Plid"])
router.all(P + '/ExportReport{/:id}', ...guard, asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder } = req.p;
  // legacy would throw NullReference on null strings (.Trim())
  for (const v of [SearchField, SearchValue, fromDate, toDate, status]) if (v == null) throw new Error('Object reference not set to an instance of an object.');
  page = (page == null || page === '') ? null : parseInt(page, 10);
  const r = await buildExport(Number(req.user.plid), type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder);
  if (r.content !== undefined) return sendXls(res, r.content);
  res.json({ ...(r.message ? { Message: r.message } : {}), ...(r.filepath ? { filepath: r.filepath } : {}) });
}));

// auth
router.all(P + '/ParticularProductDetails{/:id}', ...guard, asyncHandler(async (req, res) => {
  const poid = intOrNull(req.p.poid);
  const BranchId = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '', branchid: BranchId,
    orderid: '', company: '', poid, orderno: '', mode: 1, statusid: '0', loginid: '', sortbydispatchorder: '', orderstatus: '8',
  });
  res.json(mapRows(rows, NEWORDERLIST));
}));

// auth
router.all(P + '/UpdateStatusProduct{/:id}', ...guard, asyncHandler(async (req, res) => {
  const { loginid, orderid, statusdate } = req.p; // Remark is accepted but unused in legacy
  const BranchId = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '', branchid: BranchId,
    orderid, company: '', poid: intOrNull(req.p.poid), orderno: '', mode: 2, statusid: intOrNull(req.p.statusid), loginid,
    sortbydispatchorder: '', orderstatus: '8', statusdate,
  });
  // ExecuteSqlCommand result: rows affected (PORT-NOTE: function result row count)
  res.json(rows.length);
}));

// auth (legacy: no session check)
router.all(P + '/DataSearchnew{/:id}', ...guard, asyncHandler(async (req, res) => {
  if (req.p.SearchText == null) throw new TypeError('Object reference not set to an instance of an object.');
  const SearchText = String(req.p.SearchText).split('+apostopis').join("'");
  const rows = await db.proc(DB, 'usp_searchorderno', { serchitem: SearchText });
  res.json(dsXml(rows)); // ds.GetXml()
}));

// auth (legacy: no session check)
router.all(P + '/UpdateStatuslist{/:id}', ...guard, asyncHandler(async (req, res) => {
  const orderid = req.p.orderid;
  // [DBO].[USP_REFUNDWALLET_RETURN] @TRANSACTIONID,@StrOutPut Out
  const o = await db.procOne(DB, 'usp_refundwallet_return', { transactionid: orderid });
  const v = outVal(o, 'StrOutPut');
  const Response = v != null ? String(v) : (o ? String(o[Object.keys(o)[0]]) : (() => { throw new TypeError('Object reference not set to an instance of an object.'); })());
  res.json(Response);
}));

// auth (legacy: no session check)
router.all(P + '/GetStatusData{/:id}', ...guard, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, 'Select osid, statusname, * from orderstatusmaster where status = true');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

module.exports = router;
