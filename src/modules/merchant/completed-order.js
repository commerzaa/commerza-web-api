'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/completed_order.cs (completed_orderController) - 6 actions
 * DB: Db_Shopping => 'shopping'
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const { query, exec, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/completed_order';

const ORDERLIST_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'couriername', 'DocketNO', 'DateDiff', 'Morderid', 'Invoiceno', 'PrSKUCode',
  'PaidViaCashWallet', 'PaidViaCahbackWallet', 'PaidViaKreazVoucher', 'PaidViaOnline', 'EMAILID', 'FULLNAME', 'Producttitle', 'CreatedDate', 'Packed',
  'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'CODPAYMENT', 'OrderNotes'];
const NEWORDER_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'EMAILID', 'Name', 'FULLNAME', 'order_DAP',
  'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images',
  'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP',
  'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV',
  'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'couriername', 'DocketNO', 'DateDiff', 'CreatedDate', 'Packed',
  'Handover', 'Intransit', 'Picked', 'Delivered', 'Outfordelivery', 'PaidViaCashWallet', 'PaidViaCahbackWallet', 'PaidViaKreazVoucher', 'PaidViaOnline',
  'CODPAYMENT'];

const nz = (v, d) => (v === undefined || v === null ? d : v);
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const outInt = (rows, name) => { const n = parseInt(((rows && rows[0]) || {})[name.toLowerCase()], 10); return Number.isNaN(n) ? 0 : n; };
const sp = (v) => String(v == null ? '' : v).replace(/\t/g, '    ') + ' \t';
/** string.Trim() on a possibly-null value => NullReferenceException */
const tr = (v) => { if (v === undefined || v === null) throw NRE(); return String(v).trim(); };

function splitOrder(Order) {
  let Orderno = ''; let orderid = '';
  if (Order !== '') {
    if (Order.length < 2) throw new RangeError('Index and length must refer to a location within the string.');
    if (Order.substring(0, 2) === 'OD') orderid = Order; else Orderno = Order;
  }
  return { Orderno, orderid };
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/gHGYgxwkVGWFDKPhgbUthA==
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, P, '/merchant/gHGYgxwkVGWFDKPhgbUthA==', '/merchant/gHGYgxwkVGWFDKPhgbUthA%3D%3D', '/merchant/merchant/gHGYgxwkVGWFDKPhgbUthA==', '/merchant/merchant/gHGYgxwkVGWFDKPhgbUthA%3D%3D'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Order = nz(p.Order, '');
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

  const BranchId = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await proc(DB, 'usp_order_list_complete_new', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: statusid.trim(), statustype: type, branchid: BranchId,
    fromreadyfordispatch: fromReadyforDispatch, toreadyfordispatch: toReadyforDispatch, orderid, orderno: Orderno,
  });
  const objAllOrderList = mapRows(rows, ORDERLIST_PROPS);
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = outInt(rows, 'totalcount');
  const bq = (extra) => `select count(1) AS count FROM tbl_product_order_master pom LEFT JOIN tbl_order_master om ON pom.orderid = om.orderid left join portal_login pl on pl.plid=om.branchid WHERE pl.plid=@b ${extra}`;
  const cnt = async (extra) => parseInt(((await query(DB, bq(extra), { b: BranchId }))[0] || {}).count, 10) || 0;
  const ActiveCustomer = await cnt("AND pom.status='Delivered'");
  const ActiveMerchant = await cnt("AND pom.status='Picked'");
  const newmerchant = await cnt('');
  const NoPerPage = await UtilityClass.GridNumbersPerPage();

  if (btnexel === 'Export Excel') {
    const sent = await exportReport({ type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, status, statusid, page, Order }, req, res);
    if (sent) return;
  }
  res.json({
    view: '~/Views/completed_order/Index.cshtml',
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

// ---- ParticularProductDetails --------------------------------------------------------------------------
// auth
router.all(`${P}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  let objAllOrderList = [];
  try {
    const BranchId = Number(req.user.plid);
    const MaxRows = 99999999; // UtilityClass.GridPageSize() commented out in legacy
    const rows = await proc(DB, 'usp_new_order_list_complete', {
      startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
      branchid: BranchId, company: '', poid: req.p.poid === undefined || req.p.poid === null || req.p.poid === '' ? null : req.p.poid, productname: '', mode: 1,
    });
    objAllOrderList = mapRows(rows, NEWORDER_PROPS);
    return res.json(objAllOrderList);
  } catch (e) {
    return res.json(objAllOrderList);
  }
}));

// ---- ExportReport (public void action; also invoked from Index when btnexel == "Export Excel") ----------
/** returns true when a file was sent */
async function exportReport(a, req, res) {
  const { Orderno, orderid } = splitOrder(nz(a.Order, ''));
  const type = nz(a.type, '3');
  const BranchId = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = a.page || 1;
  const rows = await proc(DB, 'usp_order_list_complete_new', {
    startrowindex: page, maxrows: MaxRows, searchfield: tr(a.SearchField), searchvalue: tr(a.SearchValue), fromdate: tr(a.fromDate),
    todate: tr(a.toDate), status: tr(a.statusid), statustype: type, branchid: BranchId, fromreadyfordispatch: a.fromReadyforDispatch,
    toreadyfordispatch: a.toReadyforDispatch, orderid, orderno: Orderno,
  });
  const list = mapRows(rows, ORDERLIST_PROPS);
  try {
    if (list.length > 0) {
      let out = '';
      ['S.No. ', 'Product Name ', 'Order Date ', 'Order No ', 'Order Id ', 'Status ', 'Quantity ', 'Actual Value ', 'Shipping ', 'GST ', 'Total ',
        'After Date ', 'By Date ', 'Customer Name ', 'City  ', 'Login ID  ', 'Payment Type  ', 'Full Address  '].forEach((h) => { out += h + '\t'; });
      for (const Item of list) {
        try {
          out += '\n';
          out += sp(Item.rownumber) + sp(Item.Product_Name) + sp(Item.OrderDate) + sp(Item.Orderno) + sp(Item.orderID) + sp(Item.status) + sp(Item.order_QTY)
            + sp(Item.total_DAP) + sp(Item.Total_Ship_Ch) + sp(Item.ProductTotalVat) + sp(Item.total_purchase_cost);
          out += Item.Approved === 'Jan  1 1900 12:00AM' ? 'N.A.' : sp(Item.Approved);
          out += Item.dispatchdate === 'Jan  1 1900 12:00AM' ? 'N.A.' : sp(Item.dispatchdate);
          out += sp(Item.Name) + sp(Item.City) + sp(Item.LoginId) + sp(Item.PayMode) + sp(`${Item.Address},${Item.City} Pin${Item.PinCode}`);
        } catch (ExpObj) {
          break; // legacy: wr.Close() inside catch, loop continues on a closed writer
        }
      }
      const dir = path.join(config.uploadDir || path.join(process.cwd(), 'uploads'), 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'completed_order.xls'), out);
      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Disposition', 'attachment; filename=completed_order.xls');
      res.send(out);
      return true;
    }
    // ViewBag.Message = "There is no record in excel"
    return false;
  } catch (ExpObj) {
    // ViewBag.filepath = ExpObj.Message
    return false;
  }
}

// auth (public void action in legacy)
router.all(`${P}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ok = await exportReport({
    type: p.type, toReadyforDispatch: p.toReadyforDispatch, fromReadyforDispatch: p.fromReadyforDispatch, SearchField: p.SearchField,
    SearchValue: p.SearchValue, fromDate: p.fromDate, toDate: p.toDate, status: p.status, statusid: p.statusid,
    page: p.page ? parseInt(p.page, 10) : 1, Order: p.Order,
  }, req, res);
  if (!ok) res.json({ Message: 'There is no record in excel' });
}));

// ---- subcategorylist -----------------------------------------------------------------------------------
// auth (legacy: no session check)
router.all(`${P}/subcategorylist{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT scatid,scatname FROM product_subcategory WHERE scatactive = true and catid=@catid', { catid: req.p.catid });
  res.json(mapRows(rows, ['SCATID', 'SCATNAME']));
}));

// ---- subsubcategorylist --------------------------------------------------------------------------------
// auth
router.all(`${P}/subsubcategorylist{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT kmid,keywordname FROM keyword_master WHERE kactive = true and scatid=@s', { s: req.p.SCATID });
  res.json(mapRows(rows, ['KMID', 'KEYWORDNAME']));
}));

// ---- sendtoqc ------------------------------------------------------------------------------------------
// auth
router.all(`${P}/sendtoqc{/:id}`, auth, asyncHandler(async (req, res) => {
  await exec(DB, 'update ims_subproduct_temp set ismerchantstatus=4 where productentry=@e', { e: req.p.editSPRID });
  res.json('ok');
}));

module.exports = router;
