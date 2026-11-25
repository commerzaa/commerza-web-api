'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Order_List.cs (Order_ListController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const GetIP = require('../../lib/franchise/GetIP');
const Courier_master = require('../../lib/franchise/Courier_master');
const ShippingDetail = require('../../lib/franchise/ShippingDetail');
const Orderstatusmaster = require('../../lib/franchise/Orderstatusmaster');

const router = express.Router();
const DB = 'shopping';
const upload = multer({ storage: multer.memoryStorage() });

// ---- helpers -------------------------------------------------------------------------------------------
/** value of an OUT parameter returned as a column of the single result row */
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
const pad = (n, l = 2) => String(n).padStart(l, '0');
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const s = (v) => (v === null || v === undefined ? '' : String(v)); // ToStringOrEmpty
const num2 = (v) => Number(v || 0).toFixed(2);
const esc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
async function dbNow() {
  try { const v = await scalar(DB, 'SELECT fun_getcurrentdate()'); return v || new Date(); } catch (e) { return new Date(); }
}

const ORDERLIST_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'couriername', 'DocketNO', 'DateDiff', 'Morderid', 'Invoiceno', 'INVAmount', 'EURAmount',
  'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemalid', 'merchantmobile', 'FULLNAME', 'EMAILID'];
const INSUFFICIENT_PROPS = ['ProdQty', 'product_Name', 'product_qty', 'ProUnit', 'SubPrCode'];
const INVOICEDETAILS_PROPS = ['CreateDate', 'DispatchedDate', 'InvoiceNo', 'NoOfItem', 'OrderNo', 'RowNumber', 'Status', 'TotalAmount'];
const ORDERFORINVOICE_PROPS = ['InvQty', 'orderid', 'Paymode', 'ProdQty', 'Product_Name', 'product_qty', 'ProUnit', 'Single_DAP', 'SubPrCode', 'total_cost',
  'total_DAP', 'Total_Ship_Ch', 'total_vat', 'JP', 'BV'];
const ALLORDERDETAILS_PROPS = ['Address', 'BrCode', 'City', 'CustName', 'Description', 'EmailID', 'IntStatus', 'LoginId', 'MobileNo', 'Name', 'order_BV',
  'order_DAP', 'order_netAmt', 'order_qty', 'orderDate', 'orderID', 'PayMode', 'PayRemark', 'PayTransID', 'PinCode', 'SH_Address', 'SH_City', 'SH_EmailID',
  'SH_MobileNo', 'SH_Name', 'SH_PinCode', 'status', 'total_Ship_Ch', 'total_vat'];
const ORDERPRODUCT_PROPS = ['IntStatus', 'InvQty', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name',
  'Product_qty', 'ProUnit', 'single_DAP', 'status', 'SubPrCode', 'total_BV', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_vat', 'total_purchase_cost', 'JP', 'BV'];
const ORDERNOTES_PROPS = ['BrCode', 'Date', 'Emp_Code', 'Remark', 'Rowno'];

/** [{...}] JSON body (List<T> param) */
function listParam(req) {
  if (Array.isArray(req.body)) return req.body;
  if (req.body && Array.isArray(req.body.param)) return req.body.param;
  if (req.body && Array.isArray(req.body.Param)) return req.body.Param;
  return [];
}
function pget(o, name) {
  if (!o) return undefined;
  const k = Object.keys(o).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : o[k];
}

// ---- ChangeOrder ---------------------------------------------------------------------------------------
// auth
router.all('/franchise/Order_List/ChangeOrder{/:id}', auth, asyncHandler(async (req, res) => {
  const POID = req.p.POID, Mode = req.p.Mode, quantity = parseInt(req.p.quantity, 10);
  let ret = 'ok';
  try {
    const Plid = 0;
    const row = await procOne(DB, 'usp_change_or_cancel_order', { poid: POID, qnty: quantity, mode: Mode, brcode: Plid, emp_code: Plid });
    ret = s(outVal(row, 'strresult'));
  } catch (ex) {
    ret = 'Error occurred. Please try later';
  }
  res.json(ret);
}));

// ---- CreateInvoice -------------------------------------------------------------------------------------
// auth
router.all('/franchise/Order_List/CreateInvoice{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ProductDetail = s(p.ProductDetail).replace(/^,+|,+$/g, '');
  const Plid = 0;
  const row = await procOne(DB, 'usp_createinvoice', {
    orderid: p.OrderID, smethod: p.SMethod, carrierid: p.SCriteria, noofboxes: p.NoOfBoxes, weight: p.Weight, carrierby: p.CarrierBy,
    carriername: p.CarrierName, paymode: p.Paymode, status: p.Status, totalqty: parseInt(p.totalQty, 10), invoicedap: Number(p.totalDAP),
    totalshipch: '', totalamount: '', productdetail: ProductDetail, empid: Plid, branchid: Plid,
  });
  res.json(s(outVal(row, 'result')));
}));

// ---- CreateNewInvoice ----------------------------------------------------------------------------------
// auth
router.all('/franchise/Order_List/CreateNewInvoice{/:id}', auth, asyncHandler(async (req, res) => {
  const OrderID = req.p.OrderID;
  if (OrderID === '' || OrderID === null || OrderID === undefined) {
    return res.json({ view: '~/Views/MerchantDashBoard/Index.cshtml' });
  }
  const UrlReferrer = s(req.get('referer'));
  const rows = await proc(DB, 'usp_orderdetails_for_invoice', { orderid: OrderID });
  const orderForInvoice = mapRows(rows, ORDERFORINVOICE_PROPS);
  const ShippingDetailList = await new ShippingDetail().AllShippingMethod();
  const Carrier_Master = await new Courier_master().AllCarrier_Master();
  res.json({ Model: orderForInvoice, ShippingDetail: ShippingDetailList, Carrier_Master, OrderID, UrlReferrer });
}));

// ---- DeleteProductQuantity -----------------------------------------------------------------------------
// auth
router.all('/franchise/Order_List/DeleteProductQuantity{/:id}', auth, asyncHandler(async (req, res) => {
  const param = listParam(req);
  const OrderID = pget(param[0], 'OrderID');
  const SubPrCode = pget(param[0], 'SubPrCode');
  if (!req.user) return res.json('errro^This page has been expired, Please login again.');
  if (OrderID === null || OrderID === undefined || OrderID === '') return res.json('errro^Invalid Order ID');
  if (SubPrCode === null || SubPrCode === undefined || SubPrCode === '') return res.json('errro^Please select Order Status');
  let ret = 'ok';
  try {
    const Plid = 0;
    const row = await procOne(DB, 'usp_deleteproductfromorder', { orderid: OrderID, subprcode: SubPrCode, brcode: Plid, emp_code: Plid });
    ret = s(outVal(row, 'strresult'));
    return res.json(ret);
  } catch (ex) {
    ret = 'error^' + ex.message;
    return res.json(ret);
  }
}));

// ---- GetInsufficientProduct ----------------------------------------------------------------------------
// auth
router.all('/franchise/Order_List/GetInsufficientProduct{/:id}', auth, asyncHandler(async (req, res) => {
  const row = await procOne(DB, 'usp_getinsufficientproduct_details', { subprcode: req.p.prcode, orderid: req.p.orderid });
  res.json(row ? mapRow(row, INSUFFICIENT_PROPS) : null);
}));

// ---- Excel export (ExportReport) -----------------------------------------------------------------------
async function ExportReport(req, res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel) {
  const userid = 0;
  const Filename = 'Order_List_' + userid + '_' + nowStamp();
  const ip = await GetIP.GetLocalIP();
  const MaxRows = await UtilityClass.GridPageSize();
  SearchField = SearchField == null ? '' : SearchField;
  SearchValue = SearchValue == null ? '' : SearchValue;
  fromDate = fromDate == null ? '' : fromDate;
  toDate = toDate == null ? '' : toDate;
  status = status == null ? '' : status;
  type = type == null ? '' : type;
  if (type === 'manifest') type = 'ReadyToShip';
  if (btnexel == null) btnexel = '';
  const CourierList = await new Courier_master().AllCarrier_Master();
  const OrderstatusList = await new Orderstatusmaster().AllOrderstatusMaster();
  const rows = await proc(DB, 'usp_all_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: s(SearchField).trim(), searchvalue: s(SearchValue).trim(), fromdate: s(fromDate).trim(),
    todate: s(toDate).trim(), status: s(status).trim(), statustype: type, branchid: Math.trunc(userid),
  });
  const objAllOrderList = mapRows(rows, ORDERLIST_PROPS);

  await exec(DB, 'INSERT INTO tbl_orderlisthistory (type, exceltype, excelname, userid, status, createdate, ipaddress) VALUES (@type,@exceltype,@excelname,@userid,@status,@createdate,@ip)', {
    type, exceltype: 'Download', excelname: Filename, userid: Math.trunc(userid), status: 1, createdate: await dbNow(), ip,
  });

  try {
    const heads = ['S.No', 'Poid', 'Order Id', 'Order Date', 'Customer Id', 'Customer Name', 'Contact', 'City', 'Pincode', 'Country', 'Address', 'Paymode',
      'Product Id', 'Product Name', 'Qty', 'Sell Price', 'Shipp. Charge', 'GST', 'NetAmount', 'Status', 'Courier', 'Docet No.', 'Error Reson'];
    const gstList = ['GST', 'CGST', 'IGST', 'SGST', 'LGST'].join(',');
    const statusList = OrderstatusList.map((x) => x.Statusname).join(',');
    const courierList = CourierList.map((x) => x.Carrier_Name).join(',');
    let html = '<html><head><meta charset="utf-8"></head><body><table border="1"><tr>';
    for (const h of heads) html += `<th style="background:#FFFF00;font-weight:bold;font-family:'Arial Narrow';font-size:15pt">${esc(h)}</th>`;
    html += '</tr>';
    for (const Item of objAllOrderList) {
      try {
        const replacement1 = s(Item.Address).replace(/\t|\n|\r/g, '');
        const cells = [Item.rownumber, Item.poid, Item.orderID, Item.OrderDate, Item.LoginId, Item.Name, Item.MobileNo, Item.City, Item.PinCode,
          Item.CountryName, replacement1, Item.PayMode, Item.poid, Item.Product_Name, Item.order_QTY, num2(Item.total_DAP), num2(Item.Total_Ship_Ch),
          // PORT-NOTE: Excel cell data-validation lists (GST / status / courier drop-downs) are not reproducible in an HTML-table .xls; the list values are kept in the cell title
          gstList, num2(Item.total_purchase_cost), statusList, courierList];
        html += '<tr>';
        cells.forEach((c, i) => {
          const t = (i === 17 || i === 19 || i === 20) ? ` title="${esc(c)}"` : '';
          html += `<td${t}>${(i === 17 || i === 19 || i === 20) ? '' : esc(s(c).trim())}</td>`;
        });
        html += '<td></td><td></td></tr>';
      } catch (exp) { /* ViewBag.filepath = exp.Message */ }
    }
    html += '</table></body></html>';
    const dir = ensureDir(path.join(config.uploadDir, 'Franchise'));
    const file = path.join(dir, 'Order_List.xls');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.writeFileSync(file, html);
    // Response.Redirect("~/Order_List.xls")
    res.set('Content-Type', 'application/vnd.ms-excel');
    res.set('Content-Disposition', 'attachment; filename=Order_List.xls');
    res.send(html);
    return true;
  } catch (exp) {
    return false; // ViewBag.filepath = exp.Message;
  }
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/order-List
// auth
router.all(['/franchise/Order_List/Index{/:id}', '/franchise/franchisee/order-List'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let type = p.type, SearchField = p.SearchField, SearchValue = p.SearchValue, fromDate = p.fromDate, toDate = p.toDate, status = p.status;
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const btnexel = p.btnexel;
  SearchField = SearchField == null ? '' : s(SearchField);
  SearchValue = SearchValue == null ? '' : s(SearchValue);
  fromDate = fromDate == null ? '' : s(fromDate);
  toDate = toDate == null ? '' : s(toDate);
  status = status == null ? '' : s(status);
  type = type == null ? '' : s(type);
  if (type === 'manifest') type = 'ReadyToShip';

  const ViewBag = { Status: status };
  const BranchId = 0;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_all_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId,
  });
  const objAllOrderList = mapRows(rows, ORDERLIST_PROPS);
  const first = rows && rows[0];
  const tc = first ? outVal({ totalcount: first.totalcount }, 'totalcount') : 0;
  const TotalRecord = parseInt(tc === null || tc === undefined ? 0 : tc, 10) || 0;

  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.status = status;
  ViewBag.type = type;
  if (btnexel === 'Export Excel') {
    const done = await ExportReport(req, res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel);
    if (done) return undefined;
  }
  return res.json({ Model: objAllOrderList, ViewBag });
}));

// ---- InvoiceDetail -------------------------------------------------------------------------------------
// route-config: franchisee/order-List/Invoice/{OrderID}
// auth
router.all(['/franchise/Order_List/InvoiceDetail{/:id}', '/franchise/franchisee/order-List/Invoice/:OrderID'], auth, asyncHandler(async (req, res) => {
  const OrderID = req.p.OrderID;
  if (OrderID === '' || OrderID === null || OrderID === undefined) {
    return res.json({ view: '~/Views/MerchantDashBoard/Index.cshtml' });
  }
  const UrlReferrer = s(req.get('referer'));
  const rows = await proc(DB, 'usp_getinvoice_list', {
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', fromdate: '', todate: '', invoicetype: OrderID,
  });
  const invoiceDetails = mapRows(rows, INVOICEDETAILS_PROPS);
  res.json({ Model: invoiceDetails, OrderID, UrlReferrer });
}));

// ---- OrderDetails --------------------------------------------------------------------------------------
// route-config: franchisee/order-List/Order-Details/{OrderID}
// auth
router.all(['/franchise/Order_List/OrderDetails{/:id}', '/franchise/franchisee/order-List/Order-Details/:OrderID'], auth, asyncHandler(async (req, res) => {
  const OrderID = req.p.OrderID;
  if (OrderID === '' || OrderID === null || OrderID === undefined) {
    return res.json({ view: '~/Views/MerchantDashBoard/Index.cshtml' });
  }
  // PORT-NOTE: USP_ORDERDETAILS returns 3 result sets (order, products, notes). The PostgreSQL function is expected to return them as
  // one result set per call; here the first call gives the order, and the product / notes sets are read with the same proc through
  // the optional `resultset` convention. Adapt `getSets` if the migrated function exposes them differently.
  const sets = await getSets('usp_orderdetails', { orderid: OrderID });
  let objOrderDetails = {};
  for (const Item of mapRows(sets[0], ALLORDERDETAILS_PROPS)) objOrderDetails = Item;
  objOrderDetails.LiOrderProduct = mapRows(sets[1] || [], ORDERPRODUCT_PROPS);
  objOrderDetails.LiOrderNotes = mapRows(sets[2] || [], ORDERNOTES_PROPS);
  res.json({ Model: objOrderDetails });
}));

/** executes a function that may return multiple result sets (pg multi-statement) - returns an array of row arrays */
async function getSets(name, params) {
  const { getPool } = require('../../db');
  const keys = Object.keys(params);
  const args = keys.map((k, i) => `"${k}" => $${i + 1}`).join(', ');
  const r = await getPool(DB).query(`select * from ${name}(${args})`, keys.map((k) => params[k]));
  if (Array.isArray(r)) return r.map((x) => x.rows);
  return [r.rows];
}

// ---- TransferOrder -------------------------------------------------------------------------------------
// auth
router.all('/franchise/Order_List/TransferOrder{/:id}', auth, asyncHandler(async (req, res) => {
  const TypeID = req.p.TypeID, ToBrCode = req.p.ToBrCode;
  let ret = 'ok';
  try {
    const Plid = 0;
    const row = await procOne(DB, 'usp_transferordertobranch', { orderid: TypeID, frombrcode: Plid, brcode: ToBrCode, emp_code: Plid });
    ret = s(outVal(row, 'strresult'));
  } catch (ex) {
    ret = 'Error occurred. Please try later';
  }
  res.json(ret);
}));

// ---- UpdateOrderStatus ---------------------------------------------------------------------------------
async function SendMessage(MobileNo, Status, Message) {
  const RetValue = '0';
  await UtilityClass.CheckAndSendMsgOnMobile('', MobileNo, Message);
  return RetValue;
}

async function SendMail(Name, Email, OrderId, Status, Message) {
  const RetValue = '0';
  const subject = 'Track Your Order ';
  let readFile;
  const tpl = path.resolve(config.app.OrderStatusUpdateTemplate || path.join(__dirname, '../../../templates/OrderStatusUpdate.html'));
  try {
    readFile = fs.readFileSync(tpl, 'utf8');
  } catch (e) {
    // PORT-NOTE: ~/OrderStatusUpdate.html was not part of the source tree; minimal fallback body keeps the same placeholders.
    readFile = '<div>$$date$$<p>Dear $$Name$$,</p><p>Order No: $$OrderId$$</p><p>$$Message$$</p></div>';
  }
  let myString = readFile;
  myString = myString.split('$$date$$').join(new Date().toLocaleDateString());
  myString = myString.split('$$Name$$').join(s(Name));
  myString = myString.split('$$OrderId$$').join(s(OrderId));
  myString = myString.split('$$Message$$').join(s(Message));
  await UtilityClass.CheckAndSendMsgOnEmail('', Email, '', '', subject, myString);
  return RetValue;
}

// auth
router.all('/franchise/Order_List/UpdateOrderStatus{/:id}', auth, asyncHandler(async (req, res) => {
  const param = listParam(req);
  const OrderID = pget(param[0], 'OrderID');
  const Status = pget(param[0], 'Status');
  let Remark = pget(param[0], 'Remark');
  if (Remark === null || Remark === undefined) Remark = '';
  if (!req.user) return res.json('errro^This page has been expired, Please login again.');
  if (OrderID === null || OrderID === undefined || OrderID === '') return res.json('errro^Invalid Order ID');
  if (Status === null || Status === undefined || Status === '') return res.json('errro^Please select Order Status');
  let ret = 'ok';
  try {
    const Plid = 0;
    const row = await procOne(DB, 'usp_updateorderstatus', { orderid: OrderID, branchid: Plid, empid: Plid, status: Status, remark: Remark });
    ret = s(outVal(row, 'strresult'));

    // Send Notification for Order Processing.
    const o = await queryOne(DB, 'SELECT * FROM tbl_order_master WHERE orderid = @orderid LIMIT 1', { orderid: OrderID });
    const order = o ? { orderID: o.orderid, status: o.status, MobileNo: o.mobileno, Fname: o.fname, EmailID: o.emailid } : null;
    const arr = ret.split('^');
    if (arr[0] !== 'error') {
      if (order.status === Status) {
        let MobileMessage = '';
        let EmailMessage = '';
        if (order.status === 'Confirm') {
          MobileMessage = 'Your Order No ' + order.orderID + ' has been Confirmed . Now we will update the delivery status soon .';
          EmailMessage = 'Your Order No ' + order.orderID + ' has been Confirmed . Now we will update the delivery status soon .';
          await SendMail(order.Fname, order.EmailID, order.orderID, order.status, EmailMessage);
        }
        if (order.status === 'Dispatched') {
          // Admin Mail
          EmailMessage = 'Order No ' + order.orderID + ' has been Dispatched. Please collect order.';
          await SendMail('Admin ', '' + CompanySettings.CompanyInfoEmailId + '', order.orderID, order.status, EmailMessage);
        } else if (order.status === 'ReadyToShip') {
          MobileMessage = 'Your Order No ' + order.orderID + ' is Ready To Ship.';
          await SendMessage('', s(order.MobileNo), MobileMessage);
          EmailMessage = 'Your Order No ' + order.orderID + ' is Ready To Ship.';
          await SendMail(order.Fname, order.EmailID, order.orderID, order.status, EmailMessage);
        } else if (order.status === 'Cancel') {
          MobileMessage = 'Your Order No ' + order.orderID + ' has been Cancelled.';
          await SendMessage('', s(order.MobileNo), MobileMessage);
          EmailMessage = 'Your Order No ' + order.orderID + ' has been Cancelled.';
          await SendMail(order.Fname, order.EmailID, order.orderID, order.status, EmailMessage);
        } else if (order.status === 'Return') {
          MobileMessage = 'Your Order No ' + order.orderID + ' has been Returned.';
          await SendMessage('', s(order.MobileNo), MobileMessage);
          EmailMessage = 'Your Order No ' + order.orderID + ' has been Returned.';
          await SendMail(order.Fname, order.EmailID, order.orderID, order.status, EmailMessage);
        }
      }
    }
  } catch (ex) {
    ret = 'error^' + ex.message;
  }
  res.json(ret);
}));

// ---- UpdateProductQuantity -----------------------------------------------------------------------------
// auth
router.all('/franchise/Order_List/UpdateProductQuantity{/:id}', auth, asyncHandler(async (req, res) => {
  const param = listParam(req);
  const OrderID = pget(param[0], 'OrderID');
  const SubPrCode = pget(param[0], 'SubPrCode');
  const NewQuantity = parseInt(pget(param[0], 'NewQuantity'), 10) || 0;
  if (!req.user) return res.json('errro^This page has been expired, Please login again.');
  if (OrderID === null || OrderID === undefined || OrderID === '') return res.json('errro^Invalid Order ID');
  if (SubPrCode === null || SubPrCode === undefined || SubPrCode === '') return res.json('errro^Please select Order Status');
  if (NewQuantity <= 0 && NewQuantity > 10) return res.json('errro^Please select valid quanatity');
  let ret = 'ok';
  try {
    const Plid = 0;
    const row = await procOne(DB, 'usp_updateorderproductquantity', { orderid: OrderID, subprcode: SubPrCode, newquantity: NewQuantity, brcode: Plid, emp_code: Plid });
    ret = s(outVal(row, 'strresult'));
    return res.json(ret);
  } catch (ex) {
    ret = 'error^' + ex.message;
    return res.json(ret);
  }
}));

// ---- Uploadexcel ---------------------------------------------------------------------------------------
let datauploadmessage = '';

async function Updatestatus(poid, status, Docketno, Cmid, ORDERID) {
  try {
    let StrMessage = '';
    datauploadmessage = '';
    const EMPID = 0;
    const BranchId = 0;
    const row = await procOne(DB, 'usp_updateorderstatusexcel', { poid, status, docketno: Docketno, cmid: Cmid, orderid: ORDERID, branchid: BranchId, empid: EMPID });
    StrMessage = s(outVal(row, 'strresult'));
    const arr = StrMessage.split('^');
    if (arr[0] !== 'ok') datauploadmessage = (arr[0] + arr[1]).toString();
    return StrMessage;
  } catch (Ex) {
    return 'Some error occured while performing the operations.' + Ex.message;
  }
}

function parseCsv(buf) {
  const lines = buf.toString('utf8').split(/\r?\n/);
  const headers = (lines.shift() || '').split(',');
  const rows = [];
  for (const line of lines) {
    if (line === '') continue; // EndOfStream
    const r = line.split(',');
    if (r.length > 1) {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] === undefined ? '' : r[i]).trim(); });
      rows.push(o);
    }
  }
  return { columns: headers, rows };
}

// public (legacy action had no SessionExpireCheck)
router.post('/franchise/Order_List/Uploadexcel{/:id}', upload.any(), asyncHandler(async (req, res) => {
  let ret = '', Filename = '', Typename = '';
  const ip = await GetIP.GetLocalIP();
  try {
    const files = req.files || [];
    const file = files.find((f) => f.fieldname === 'FileUpload') || files[0];
    if (file && file.size > 0) {
      const FileExtension = path.extname(file.originalname).toLowerCase();
      Typename = s(req.body && req.body.Typename);
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      const dir = ensureDir(path.join(config.uploadDir, 'AllUploadsExcelFile'));
      const PathForFile = path.join(dir, file.originalname);
      Filename = path.basename(PathForFile);
      Filename = nowStamp() + Filename;
      let table = { columns: [], rows: [] };
      let workbook = null, XLSX = null;
      if (validFileTypes.includes(FileExtension)) {
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        fs.writeFileSync(PathForFile, file.buffer);
        if (FileExtension === '.csv') {
          table = parseCsv(file.buffer);
        } else {
          // PORT-NOTE: requires the `xlsx` package (replacement for ACE.OLEDB Excel reader / Excel interop)
          XLSX = require('xlsx');
          workbook = XLSX.readFile(PathForFile);
          const sheet = workbook.Sheets.Sheet1;
          const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
          const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
          table.columns = Array.from({ length: width }, (_, i) => 'F' + (i + 1));
          // SELECT * FROM [Sheet1$] where [F2] IS NOT NULL and [F3] IS NOT NULL
          for (const r of aoa) {
            if (r[1] !== null && r[1] !== undefined && r[2] !== null && r[2] !== undefined) {
              const o = {};
              table.columns.forEach((c, i) => { o[c] = r[i] === undefined ? null : r[i]; });
              table.rows.push(o);
            }
          }
        }
      }
      const getCol = (row, name) => {
        if (!table.columns.includes(name)) throw new Error('Column \'' + name + '\' does not belong to table.');
        return row[name];
      };
      if (table.rows.length > 0) {
        for (let i = 1; i < table.rows.length; i++) {
          let Poid = 0, Cmid = 0, alllength = 0;
          let Couriername = '', Docketno = '', status = '', orderid = '';
          for (let k = 0; k < table.columns.length; k++) {
            if (s(table.rows[0][table.columns[k]]) !== '') alllength++;
          }
          const f2 = getCol(table.rows[i], 'F2');
          Poid = parseInt(f2 === null || f2 === undefined ? 0 : f2, 10);
          if (Number.isNaN(Poid)) throw new Error('Input string was not in a correct format.');
          const f3 = getCol(table.rows[i], 'F3');
          orderid = s(f3 === '' ? 0 : f3);
          const f20 = getCol(table.rows[i], 'F20');
          status = s(f20 === '' ? 0 : f20);
          const f21 = getCol(table.rows[i], 'F21');
          Couriername = s(f21 === '' ? 0 : f21);
          if (Couriername !== '') {
            const v = await scalar(DB, 'SELECT coalesce(cmid,0) FROM tbl_couriermaster WHERE carrier_name = @n AND active = true LIMIT 1', { n: Couriername });
            Cmid = v === null || v === undefined ? 0 : v;
          }
          const f22 = getCol(table.rows[i], 'F22');
          Docketno = s(f22 === '' ? 0 : f22);
          await Updatestatus(Poid, status, Docketno, Cmid, orderid);
          const Response = datauploadmessage;

          if (XLSX && workbook) {
            const sheet = workbook.Sheets.Sheet1;
            const J = i + 1;
            const addr = XLSX.utils.encode_cell({ r: J - 1, c: alllength - 1 });
            sheet[addr] = { t: 's', v: Response !== '' ? Response : 'Uploaded' };
            const ref = XLSX.utils.decode_range(sheet['!ref']);
            if (J - 1 > ref.e.r) ref.e.r = J - 1;
            if (alllength - 1 > ref.e.c) ref.e.c = alllength - 1;
            sheet['!ref'] = XLSX.utils.encode_range(ref);
            XLSX.writeFile(workbook, PathForFile);
          }
        }
      }

      const EMPID = 0;
      await exec(DB, 'INSERT INTO tbl_orderlisthistory (type, exceltype, excelname, userid, status, createdate, ipaddress) VALUES (@type,@exceltype,@excelname,@userid,@status,@createdate,@ip)', {
        type: Typename, exceltype: 'Upload', excelname: Filename, userid: EMPID, status: 1, createdate: await dbNow(), ip,
      });
      ret = '1';
    }
  } catch (Ex) {
    // TempData["Message"] = "Some error occured while performing the operation(s)." + Ex.Message;
    return res.json(ret);
  }
  return res.json(ret);
}));

module.exports = router;
