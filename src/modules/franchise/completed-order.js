'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\completed_order.cs (completed_orderController) */
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const { query, exec, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/completed_order';

const ORDERLIST_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'couriername', 'DocketNO', 'DateDiff', 'Morderid', 'Invoiceno', 'INVAmount', 'EURAmount',
  'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemalid', 'merchantmobile'];
const NEWORDER_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt', 'order_QTY',
  'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize',
  'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost',
  'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved', 'dispatchdate',
  'ProcurementSLA', 'Orderno', 'Producttitle', 'couriername', 'DocketNO', 'DateDiff', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked',
  'Delivered', 'Outfordelivery', 'INVAmount', 'EURAmount', 'INVPer', 'EURPer'];

const nz = (v, d) => (v === undefined || v === null ? d : v);
const outInt = (rows, name) => { const n = parseInt(((rows && rows[0]) || {})[name.toLowerCase()], 10); return Number.isNaN(n) ? 0 : n; };
const sp = (v) => String(v == null ? '' : v).replace(/\t/g, '    ') + ' \t';

function splitOrder(Order) {
  let Orderno = ''; let orderid = '';
  if (Order !== '') {
    if (Order.length < 2) throw new Error('Index and length must refer to a location within the string.');
    if (Order.substring(0, 2) === 'OD') orderid = Order; else Orderno = Order;
  }
  return { Orderno, orderid };
}

// auth ([SessionExpireCheck]) // route-config: franchisee/gHGYgxwkVGWFDKPhgbUthA==
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/gHGYgxwkVGWFDKPhgbUthA==', '/franchise/franchisee/gHGYgxwkVGWFDKPhgbUthA%3D%3D'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Order = nz(p.Order, '');
  const { Orderno, orderid } = splitOrder(Order);
  const SearchField = nz(p.SearchField, '');
  const SearchValue = nz(p.SearchValue, '');
  const fromDate = nz(p.fromDate, '');
  const fromReadyforDispatch = nz(p.fromReadyforDispatch, '');
  const toReadyforDispatch = nz(p.toReadyforDispatch, '');
  const statusid = nz(p.statusid, '');
  const toDate = nz(p.toDate, '');
  const status = nz(p.status, '');
  const type = nz(p.type, '3');
  const btnexel = p.btnexel;
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);

  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc('shopping', 'USP_ORDER_LIST_COMPLETE_NEW', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: statusid.trim(), statustype: type, branchid: BranchId, fromreadyfordispatch: fromReadyforDispatch,
    toreadyfordispatch: toReadyforDispatch, orderid, orderno: Orderno, merchantname: '', productname: '', loginid: '', categoryrelatedto: '1', did: DID,
  });
  const objAllOrderList = mapRows(rows, ORDERLIST_PROPS);
  const TotalRecord = outInt(rows, 'totalcount');
  const bq = (extra) => `select count(1) FROM TBL_PRODUCT_ORDER_MASTER POM LEFT JOIN tbl_order_master OM ON POM.ORDERID = OM.ORDERID left join PORTAL_LOGIN pl on pl.PLID=OM.BranchId WHERE PL.PLID=@b ${extra}`;
  const cnt = async (extra) => parseInt(((await query('shopping', bq(extra), { b: BranchId }))[0] || {}).count, 10) || 0;
  const ActiveCustomer = await cnt("AND POM.Status='Delivered'");
  const ActiveMerchant = await cnt("AND POM.Status='Picked'");
  const newmerchant = await cnt('');
  const NoPerPage = UtilityClass.GridNumbersPerPage();

  if (btnexel === 'Export Excel') {
    const sent = await exportReport({ type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, statusid, page, Order }, res);
    if (sent) return;
  }
  res.json({
    Model: objAllOrderList,
    Status: status,
    BranchId,
    Orderno: orderid === '' ? Orderno : orderid,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage,
    SearchField,
    SearchValue,
    fromDate,
    toDate,
    plid: BranchId,
    fromReadyforDispatch,
    toReadyforDispatch,
    statusid,
    status,
    type,
    ActiveCustomer,
    ActiveMerchant,
    newmerchant,
  });
}));

// auth
router.all(`${P}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  let objAllOrderList = [];
  try {
    const BranchId = 0;
    const MaxRows = await UtilityClass.GridPageSize();
    const rows = await proc('shopping', 'USP_NEW_ORDER_LIST_Complete', {
      startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
      branchid: BranchId, company: '', poid: req.p.poid === undefined || req.p.poid === '' ? null : req.p.poid, productname: '', mode: 1,
    });
    objAllOrderList = mapRows(rows, NEWORDER_PROPS);
    return res.json(objAllOrderList);
  } catch (e) {
    return res.json(objAllOrderList);
  }
}));

async function exportReport(a, res) {
  const { Orderno, orderid } = splitOrder(nz(a.Order, ''));
  const type = nz(a.type, '3');
  const BranchId = 0;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = a.page || 1;
  const rows = await proc('shopping', 'USP_ORDER_LIST_COMPLETE_NEW', {
    startrowindex: page, maxrows: MaxRows, searchfield: a.SearchField.trim(), searchvalue: a.SearchValue.trim(), fromdate: a.fromDate.trim(),
    todate: a.toDate.trim(), status: a.statusid.trim(), statustype: type, branchid: BranchId, fromreadyfordispatch: a.fromReadyforDispatch,
    toreadyfordispatch: a.toReadyforDispatch, orderid, orderno: Orderno,
  });
  const list = mapRows(rows, ORDERLIST_PROPS);
  if (list.length === 0) return false; // ViewBag.Message = "There is no record in excel"
  let out = '';
  ['S.No. ', 'Product Name ', 'Order Date ', 'Order No ', 'Order Id ', 'Status ', 'Quantity ', 'Actual Value ', 'Shipping ', 'GST ', 'Total ',
    'After Date ', 'By Date ', 'Customer Name ', 'City  ', 'Login ID  ', 'Payment Type  ', 'Full Address  '].forEach((h) => { out += h + '\t'; });
  for (const Item of list) {
    out += '\n';
    out += sp(Item.rownumber) + sp(Item.Product_Name) + sp(Item.OrderDate) + sp(Item.Orderno) + sp(Item.orderID) + sp(Item.status) + sp(Item.order_QTY)
      + sp(Item.total_DAP) + sp(Item.Total_Ship_Ch) + sp(Item.ProductTotalVat) + sp(Item.total_purchase_cost);
    out += Item.Approved === 'Jan  1 1900 12:00AM' ? 'N.A.' : sp(Item.Approved);
    out += Item.dispatchdate === 'Jan  1 1900 12:00AM' ? 'N.A.' : sp(Item.dispatchdate);
    out += sp(Item.Name) + sp(Item.City) + sp(Item.LoginId) + sp(Item.PayMode) + sp(`${Item.Address},${Item.City} Pin${Item.PinCode}`);
  }
  const dir = path.join(config.uploadDir || path.join(process.cwd(), 'uploads'), 'AllExcelSheets');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'completed_order.xls'), out);
  res.setHeader('Content-Type', 'application/force-download');
  res.setHeader('Content-Disposition', 'attachment; filename=completed_order.xls');
  res.send(out);
  return true;
}

// auth
router.all(`${P}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ok = await exportReport({
    type: p.type, toReadyforDispatch: nz(p.toReadyforDispatch, ''), fromReadyforDispatch: nz(p.fromReadyforDispatch, ''), SearchField: nz(p.SearchField, ''),
    SearchValue: nz(p.SearchValue, ''), fromDate: nz(p.fromDate, ''), toDate: nz(p.toDate, ''), statusid: nz(p.statusid, ''),
    page: p.page ? parseInt(p.page, 10) : 1, Order: p.Order,
  }, res);
  if (!ok) res.json({ Message: 'There is no record in excel' });
}));

// auth
router.all(`${P}/subcategorylist{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query('shopping', 'SELECT SCATID,SCATNAME FROM PRODUCT_SUBCATEGORY WHERE SCATACTIVE = 1 and CATID=@catid', { catid: req.p.catid });
  res.json(mapRows(rows, ['SCATID', 'SCATNAME']));
}));

// auth
router.all(`${P}/subsubcategorylist{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query('shopping', 'SELECT KMID,KEYWORDNAME FROM KEYWORD_MASTER WHERE KACTIVE = 1 and SCATID=@s', { s: req.p.SCATID });
  res.json(mapRows(rows, ['KMID', 'KEYWORDNAME']));
}));

// auth
router.all(`${P}/sendtoqc{/:id}`, auth, asyncHandler(async (req, res) => {
  await exec('shopping', 'update IMS_SubProduct_Temp set ismerchantstatus=4 where productentry=@e', { e: req.p.editSPRID });
  res.json('ok');
}));

module.exports = router;
