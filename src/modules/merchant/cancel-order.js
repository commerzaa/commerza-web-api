'use strict';
const DB = 'shopping';
// Ported from Merchant Panel Controllers/CustomerPanel/Cancel_Order.cs (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('merchant')];
const P = '/merchant/Cancel_Order';
const NOL = ['ALLIMAGES', 'BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'Remarks', 'ReturnDate', 'ExchangeDate', 'RefundedRemark', 'RefundedDate', 'INVAmount', 'EURAmount', 'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemailid', 'FULLNAME', 'EMAILID'];
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// DataSet.GetXml() equivalent (table dsData; NULL columns omitted)
const dsXml = (rows) => (!rows.length ? '<NewDataSet />'
  : '<NewDataSet>' + rows.map((r) => '<dsData>' + Object.keys(r).filter((k) => r[k] !== null && r[k] !== undefined)
    .map((k) => `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`).join('') + '</dsData>').join('') + '</NewDataSet>');
const intOrNull = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const tabSafe = (v) => String(v === undefined || v === null ? '' : v).replace(/\t/g, '    ');

// ExportReport: legacy wrote a tab separated .xls and redirected to it; here the content is sent as a download.
async function ExportReport(type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder, BranchId) {
  const rows = await db.proc(DB, 'usp_new_order_list', {
    STARTROWINDEX: page, MAXROWS: 999999, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate.trim(),
    TODATE: toDate.trim(), STATUS: status.trim(), STATUSTYPE: type, BRANCHID: BranchId, ORDERID: orderid, COMPANY: '', POID: '0',
    ORDERNO: Orderno, MODE: 1, STATUSID: '0', LOGINID: '', SORTBYDISPATCHORDER: sortbydispatchorder, ORDERSTATUS: '7',
  });
  if (!rows.length) return { Message: 'There is no record in excel' };
  const list = mapRows(rows, NOL);
  let body = ['S.No. ', 'Product Name ', 'Order Date ', 'Order No ', 'Order Id ', 'Status ', 'Quantity ', 'Actual Value ', 'Shipping ', 'GST ', 'Total ',
    'Customer Name ', 'City  ', 'Login ID  ', 'Payment Type  ', 'Full Address  '].join('\t');
  for (const it of list) {
    body += '\n' + [it.rownumber, it.Product_Name, it.OrderDate, it.Orderno, it.orderID, it.status, it.order_QTY, it.total_DAP, it.Total_Ship_Ch,
      it.ProductTotalVat, it.total_purchase_cost, it.Name, it.City, it.LoginId, it.PayMode, (it.Address + ',' + it.City + ' Pin' + it.PinCode)]
      .map((x) => tabSafe(x) + ' \t').join('');
  }
  return { file: body };
}

const indexHandler = asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, ProductName, sortbydispatchorder, ddlcancelationType } = req.p;
  let Orderno = '';
  let orderid = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (sortbydispatchorder == null) sortbydispatchorder = 'desc';
  if (ProductName == null) ProductName = '';
  if (ProductName !== '') {
    if (ProductName.length < 2) throw new RangeError('Index and length must refer to a location within the string.');
    if (ProductName.substring(0, 2) === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  if (type === 'manifest') type = 'ReadyToShip';
  if (ddlcancelationType == null) ddlcancelationType = '0';
  const BranchId = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const Totalcancel = Number(await db.scalar(DB, 'SELECT COUNT(DISTINCT orderid) FROM tbl_product_order_master where plid = @b and intstatus = 7', { b: BranchId })) || 0;
  const rows = await db.proc(DB, 'usp_new_order_list', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate.trim(),
    TODATE: toDate.trim(), STATUS: status.trim(), STATUSTYPE: type, BRANCHID: BranchId, ORDERID: orderid, COMPANY: '', POID: '0',
    ORDERNO: Orderno, MODE: 1, STATUSID: '0', LOGINID: '', SORTBYDISPATCHORDER: sortbydispatchorder, ORDERSTATUS: '7', STATUSDATE: '',
    DOCKETNO: '', DDLCOURIER: '', MERCHANTNAME: '', PRODUCTNAME: '', DDLCANCELATIONTYPE: ddlcancelationType,
  });
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row
  const TotalRecord = rows.length && rows[0].totalcount != null ? parseInt(rows[0].totalcount, 10) : 0;
  const out = {
    Status: status, BranchId, Productname: ProductName, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate, Totalcancel, sortbydispatchorder, type,
  };
  if (btnexel === 'Export Excel') {
    const ex = await ExportReport(type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder, BranchId);
    if (ex.file !== undefined) {
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Cancel_orderlist.xls');
      return res.send(ex.file);
    }
    out.Message = ex.Message;
  }
  res.json({ ...out, Model: mapRows(rows, NOL) });
});

// auth
router.all(`${P}/Index{/:id}`, ...guard, indexHandler);
// route-config
router.all('/merchant/merchant/HT9e1iMr3ka7VZLPOcRz0w==', ...guard, indexHandler);

// auth (void action: export download)
router.all(`${P}/ExportReport{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  const s = (v) => (v == null ? '' : String(v));
  const page = p.page == null || p.page === '' ? 1 : parseInt(p.page, 10);
  const ex = await ExportReport(s(p.type), s(p.SearchField), s(p.SearchValue), s(p.fromDate), s(p.toDate), s(p.status), page, s(p.orderid), s(p.Orderno), s(p.sortbydispatchorder), Number(req.user.plid));
  if (ex.file === undefined) return res.status(200).end();
  res.set('Content-Type', 'application/force-download');
  res.set('Content-Disposition', 'attachment; filename=Cancel_orderlist.xls');
  res.send(ex.file);
}));

// auth (legacy: no session check)
router.all(`${P}/ParticularProductDetails{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const poid = intOrNull(req.p.poid);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc(DB, 'usp_new_order_list', {
    STARTROWINDEX: 1, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', STATUS: '', STATUSTYPE: '', BRANCHID: Number(req.user.plid),
    ORDERID: '', Company: '', POID: poid, Orderno: '', MODE: 1, STATUSID: '0', LOGINID: '', SORTBYDISPATCHORDER: '', ORDERSTATUS: '7',
  });
  res.json(mapRows(rows, NOL));
}));

// auth (legacy: no session check)
router.all(`${P}/UpdateStatusProduct{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { loginid, orderid, statusdate, Remark } = req.p;
  const rows = await db.proc(DB, 'usp_new_order_list', {
    STARTROWINDEX: 1, MAXROWS: 100, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', STATUS: '', STATUSTYPE: '', BRANCHID: Number(req.user.plid),
    orderid, Company: '', POID: intOrNull(req.p.poid), Orderno: '', mode: 2, statusid: intOrNull(req.p.statusid), loginid,
    sortbydispatchorder: '', orderstatus: '7', statusdate,
  });
  // ExecuteSqlCommand result: rows affected
  res.json(rows.length);
}));

// auth (legacy: no session check)
router.all(`${P}/DataSearchnew{/:id}`, ...guard, asyncHandler(async (req, res) => {
  if (req.p.SearchText == null) throw new TypeError('Object reference not set to an instance of an object.');
  const SearchText = String(req.p.SearchText).split('+apostopis').join("'");
  const rows = await db.proc(DB, 'usp_searchorderno', { serchItem: SearchText });
  res.json(dsXml(rows));
}));

// auth (legacy: no session check)
router.all(`${P}/GetStatusData{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, 'Select osid, statusname, * from orderstatusmaster where status = true');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

module.exports = router;
