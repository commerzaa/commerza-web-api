// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Order_List.cs
'use strict';
/**
 * Order_ListController (merchant order management inside the customer panel). DB: Db_Shopping => 'shopping'.
 * Every action has [SessionExpireCheck] => ps.customerAuth (the inner Session["Plid"] == null checks are therefore unreachable,
 * kept for fidelity). [CheckResellerTimeout] (class) is a no-op.
 * Public string methods SendMessage / SendMail are routable MVC actions too (see their routes).
 * Ported from the PORTAL C#; the Merchant/Franchise order-list.js ports differ (more actions) and were only used for comparison.
 */
const express = require('express');
const fs = require('fs');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ShippingDetail = require('../../lib/portal/ShippingDetail');
const Carrier_Master = require('../../lib/portal/Carrier_Master');
const CS = require('../../lib/portal/CompanySettings');
const {
  NRE, s, rep, toInt32, parseInt32, outVal, listParam, pget, bindInt, nullEntry, viewJson, urlReferrer, mapPath, multiResult, netShortDate,
  decParse, decToString,
} = require('./_shared/batch-21-common');

const CompanySettings = CS.CompanySettings || CS;
const DB = 'shopping';
const C = '/portal/Order_List';
const router = express.Router();

// C# model property lists (Order_List.cs)
const ALLORDERDETAILS = ['Address', 'BrCode', 'City', 'CustName', 'Description', 'EmailID', 'IntStatus', 'LiOrderNotes', 'LiOrderProduct', 'LoginId',
  'MobileNo', 'Name', 'order_BV', 'order_DAP', 'order_netAmt', 'order_qty', 'orderDate', 'orderID', 'PayMode', 'PayRemark', 'PayTransID', 'PinCode',
  'SH_Address', 'SH_City', 'SH_EmailID', 'SH_MobileNo', 'SH_Name', 'SH_PinCode', 'status', 'total_Ship_Ch', 'total_vat'];
const INSUFFICIENTPRODUCT = ['ProdQty', 'product_Name', 'product_qty', 'ProUnit', 'SubPrCode'];
const INVOICEDETAILS = ['CreateDate', 'DispatchedDate', 'InvoiceNo', 'NoOfItem', 'OrderNo', 'RowNumber', 'Status', 'TotalAmount'];
const ORDERFORINVOICE = ['InvQty', 'orderid', 'Paymode', 'ProdQty', 'Product_Name', 'product_qty', 'ProUnit', 'Single_DAP', 'SubPrCode', 'total_cost',
  'total_DAP', 'Total_Ship_Ch', 'total_vat'];
const ORDERLIST = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt', 'order_QTY',
  'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty',
  'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status',
  'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost'];
const ORDERNOTES = ['BrCode', 'Date', 'Emp_Code', 'Remark', 'Rowno'];
const ORDERPRODUCT = ['IntStatus', 'InvQty', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize',
  'Product_Name', 'Product_qty', 'ProUnit', 'single_DAP', 'status', 'SubPrCode', 'total_BV', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_vat',
  'total_purchase_cost'];

/** param[0] of a List<T> action parameter: null list => NullReferenceException, empty list => ArgumentOutOfRangeException */
function first(param) {
  if (param === null || param === undefined) throw NRE();
  if (param.length === 0 || param[0] === undefined) {
    throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
  }
  return param[0] || {};
}
/** int property of a bound model (non-convertible value => model state error, property keeps default 0) */
function intProp(v) {
  if (v === null || v === undefined || String(v).trim() === '') return 0;
  const t = String(v).trim();
  return /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : 0;
}

// ---- ChangeOrder ------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${C}/ChangeOrder{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const POID = req.p.POID;
  const Mode = req.p.Mode;
  const quantity = bindInt(req, 'quantity', 'System.Web.Mvc.JsonResult ChangeOrder(System.String, System.String, Int32)');
  let ret = 'ok';
  try {
    const Plid = req.user.plid;
    const row = await db.procOne(DB, 'usp_change_or_cancel_order', { poid: POID, qnty: quantity, mode: Mode, brcode: Plid, emp_code: Plid });
    ret = s(outVal(row, 'strresult'));
  } catch (ex) {
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

// ---- CreateInvoice ----------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${C}/CreateInvoice{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const sig = 'System.Web.Mvc.JsonResult CreateInvoice(System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, Int32, System.Decimal, System.String)';
  const totalQty = bindInt(req, 'totalQty', sig);
  if (p.totalDAP === undefined || p.totalDAP === null || String(p.totalDAP).trim() === '') throw nullEntry('totalDAP', 'System.Decimal', sig);
  let totalDAP;
  try { totalDAP = decToString(decParse(p.totalDAP)); } catch (_) { throw nullEntry('totalDAP', 'System.Decimal', sig); }
  let ProductDetail = p.ProductDetail;
  if (ProductDetail === null || ProductDetail === undefined) throw NRE(); // ProductDetail.Trim(',')
  ProductDetail = String(ProductDetail).replace(/^,+|,+$/g, '');
  let Result = '';
  const Plid = req.user.plid;
  const row = await db.procOne(DB, 'usp_createinvoice', {
    orderid: p.OrderID, smethod: p.SMethod, carrierid: p.SCriteria, noofboxes: p.NoOfBoxes, weight: p.Weight, carrierby: p.CarrierBy,
    carriername: p.CarrierName, paymode: p.Paymode, status: p.Status, totalqty: totalQty, invoicedap: totalDAP, totalshipch: '',
    totalamount: '', productdetail: ProductDetail, empid: Plid, branchid: Plid,
  });
  Result = s(outVal(row, 'result')); // spOutput.Value.ToString(): DBNull => ''
  return res.json(Result);
}));

// ---- CreateNewInvoice -------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
// route-config: merchant/order-List/Create-Invoice/{OrderID} -> Order_List/CreateNewInvoice
router.all([`${C}/CreateNewInvoice{/:id}`, '/portal/merchant/order-List/Create-Invoice/:OrderID'], ps.customerAuth, asyncHandler(async (req, res) => {
  const OrderID = req.p.OrderID;
  if (OrderID === '' || OrderID === null || OrderID === undefined) {
    return viewJson(res, '~/Views/CustomerPanel/MerchantDashBoard/Index.cshtml');
  }
  const ViewBag = {};
  const UrlReferrer = urlReferrer(req);
  const rows = await db.proc(DB, 'usp_orderdetails_for_invoice', { orderid: OrderID });
  const orderForInvoice = mapRows(rows, ORDERFORINVOICE);
  ViewBag.ShippingDetail = await new ShippingDetail().AllShippingMethod();
  ViewBag.Carrier_Master = await new Carrier_Master().AllCarrier_Master();
  ViewBag.OrderID = OrderID;
  ViewBag.UrlReferrer = UrlReferrer;
  return viewJson(res, '~/Views/CustomerPanel/Order_List/CreateNewInvoice.cshtml', orderForInvoice, ViewBag);
}));

// ---- DeleteProductQuantity --------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${C}/DeleteProductQuantity{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p0 = first(listParam(req));
  const OrderID = pget(p0, 'OrderID');
  const SubPrCode = pget(p0, 'SubPrCode');
  const NewQuantity = intProp(pget(p0, 'NewQuantity'));
  void NewQuantity;
  if (!ps.isCustomer(req)) return res.json('errro^This page has been expired, Please login again.');
  if (OrderID === null || OrderID === undefined || OrderID === '') return res.json('errro^Invalid Order ID');
  if (SubPrCode === null || SubPrCode === undefined || SubPrCode === '') return res.json('errro^Please select Order Status');
  let ret = 'ok';
  try {
    const Plid = req.user.plid;
    // legacy comment: "THE BELOW CALLED PROCEDURE IS WAS NOT FOUND IN THE LOCAL DATABASE OF MAAYAS" (also absent from dbshopping.sql)
    const row = await db.procOne(DB, 'usp_deleteproductfromorder', { orderid: OrderID, subprcode: SubPrCode, brcode: Plid, emp_code: Plid });
    ret = s(outVal(row, 'strresult'));
    return res.json(ret);
  } catch (ex) {
    ret = 'error^' + ex.message;
    return res.json(ret);
  }
}));

// ---- GetInsufficientProduct -------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${C}/GetInsufficientProduct{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getinsufficientproduct_details', { subprcode: req.p.prcode, orderid: req.p.orderid });
  const insufficient = rows.length ? mapRow(rows[0], INSUFFICIENTPRODUCT) : null;
  // MVC JsonResult with Data == null writes an empty body
  if (insufficient === null) return res.status(200).type('application/json').send('');
  return res.json(insufficient);
}));

// ---- Index --------------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
// route-config: merchant/order-List -> Order_List/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/order-List'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let { type, SearchField, SearchValue, fromDate, toDate, status } = req.p;
  let page = req.p.page;
  page = page === undefined || page === null || String(page).trim() === '' ? null : (/^[+-]?\d+$/.test(String(page).trim()) ? parseInt(page, 10) : null);
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  if (type === 'manifest') type = 'ReadyToShip';
  ViewBag.Status = status;
  const BranchId = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await db.proc(DB, 'usp_all_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: String(SearchField).trim(), searchvalue: String(SearchValue).trim(),
    fromdate: String(fromDate).trim(), todate: String(toDate).trim(), status: String(status).trim(), statustype: type, branchid: BranchId,
  });
  const objAllOrderList = mapRows(rows, ORDERLIST);
  // int.Parse(spOutput.Value.ToString()) (@TOTALCOUNT OUT returned as a column)
  // PORT-NOTE: no result row => no OUTPUT column in PostgreSQL; treated as 0 (SQL Server still returned @TotalCount).
  const tc = outVal(rows, 'totalcount');
  const TotalRecord = tc === null ? 0 : parseInt32(tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.Status = status; // legacy ViewBag.status: ViewData is case-insensitive, so it overwrites the earlier ViewBag.Status key
  ViewBag.type = type;
  return viewJson(res, '~/Views/CustomerPanel/Order_List/Index.cshtml', objAllOrderList, ViewBag);
}));

// ---- InvoiceDetail ----------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
// route-config: merchant/order-List/Invoice/{OrderID} -> Order_List/InvoiceDetail
router.all([`${C}/InvoiceDetail{/:id}`, '/portal/merchant/order-List/Invoice/:OrderID'], ps.customerAuth, asyncHandler(async (req, res) => {
  const OrderID = req.p.OrderID;
  if (OrderID === '' || OrderID === null || OrderID === undefined) {
    return viewJson(res, '~/Views/CustomerPanel/MerchantDashBoard/Index.cshtml');
  }
  const ViewBag = {};
  const UrlReferrer = urlReferrer(req);
  const rows = await db.proc(DB, 'usp_getinvoice_list', {
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', fromdate: '', todate: '', invoicetype: OrderID,
  });
  const invoiceDetails = mapRows(rows, INVOICEDETAILS);
  ViewBag.OrderID = OrderID;
  ViewBag.UrlReferrer = UrlReferrer;
  return viewJson(res, '~/Views/CustomerPanel/Order_List/InvoiceDetail.cshtml', invoiceDetails, ViewBag);
}));

// ---- OrderDetails -----------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
// route-config: merchant/order-List/Order-Details/{OrderID} -> Order_List/OrderDetails
router.all([`${C}/OrderDetails{/:id}`, '/portal/merchant/order-List/Order-Details/:OrderID'], ps.customerAuth, asyncHandler(async (req, res) => {
  const OrderID = req.p.OrderID;
  if (OrderID === '' || OrderID === null || OrderID === undefined) {
    return viewJson(res, '~/Views/CustomerPanel/MerchantDashBoard/Index.cshtml');
  }
  // [DBO].[USP_ORDERDETAILS] @ORDERID : set 0 = AllOrderDetails (last row wins), set 1 = OrderProduct, set 2 = OrderNotes
  const sets = await multiResult('usp_orderdetails', { orderid: OrderID });
  let objOrderDetails = mapRow({}, ALLORDERDETAILS);
  for (const item of mapRows(sets[0] || [], ALLORDERDETAILS)) objOrderDetails = item;
  objOrderDetails.LiOrderProduct = mapRows(sets[1] || [], ORDERPRODUCT);
  objOrderDetails.LiOrderNotes = mapRows(sets[2] || [], ORDERNOTES);
  return viewJson(res, '~/Views/CustomerPanel/Order_List/OrderDetails.cshtml', objOrderDetails);
}));

// ---- TransferOrder ----------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${C}/TransferOrder{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TypeID = req.p.TypeID;
  const ToBrCode = req.p.ToBrCode;
  let ret = 'ok';
  try {
    const Plid = req.user.plid;
    // legacy comment: "THE BELOW PROCEDURE WAS NOT FOUND IN THE LOCAL DATABASE OF THE MAAYAS DATABASE" (also absent from dbshopping.sql)
    const row = await db.procOne(DB, 'usp_transferordertobranch', { orderid: TypeID, frombrcode: Plid, brcode: ToBrCode, emp_code: Plid });
    ret = s(outVal(row, 'strresult'));
  } catch (ex) {
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

// public string SendMessage(string MobileNo, string Status, string Message)  (body commented out in legacy)
async function SendMessage(MobileNo, Status, Message) {
  const RetValue = '0';
  // UtilityClass.CheckAndSendMsgOnMobile("", MobileNo , Message);  (commented out in legacy)
  return RetValue;
}

// public string SendMail(string Name, string Email, string OrderId, string Status, string Message)
async function SendMail(Name, Email, OrderId, Status, Message) {
  const RetValue = '0';
  const subject = 'Track Your Order ';
  // StreamReader(Server.MapPath("~/OrderStatusUpdate.html")).ReadToEnd()
  // PORT-NOTE: template path = config.app.OrderStatusUpdateTemplate when set, else <uploadDir>/OrderStatusUpdate.html
  //   (copy the legacy ~/OrderStatusUpdate.html there); a missing file throws like the legacy FileNotFoundException.
  const tpl = config.app.OrderStatusUpdateTemplate ? String(config.app.OrderStatusUpdateTemplate) : mapPath('~/OrderStatusUpdate.html');
  const readFile = fs.readFileSync(tpl, 'utf8').replace(/^﻿/, '');
  let myString = '';
  myString = readFile;
  myString = rep(myString, '$$date$$', netShortDate());
  myString = rep(myString, '$$Name$$', Name);
  myString = rep(myString, '$$OrderId$$', OrderId);
  myString = rep(myString, '$$CompanyName$$', CompanySettings.CompanyName);
  myString = rep(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
  myString = rep(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
  myString = rep(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
  // myString = myString.Replace("$$Status$$", Status);  (commented out in legacy)
  void Status;
  myString = rep(myString, '$$Message$$', Message);
  await UtilityClass.CheckAndSendMsgOnEmail('', Email, '', '', subject, myString);
  return RetValue;
}

// ---- UpdateOrderStatus ------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${C}/UpdateOrderStatus{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p0 = first(listParam(req));
  const OrderID = pget(p0, 'OrderID');
  const Status = pget(p0, 'Status');
  let Remark = pget(p0, 'Remark');
  if (Remark === null || Remark === undefined) Remark = '';
  if (!ps.isCustomer(req)) return res.json('errro^This page has been expired, Please login again.');
  if (OrderID === null || OrderID === undefined || OrderID === '') return res.json('errro^Invalid Order ID');
  if (Status === null || Status === undefined || Status === '') return res.json('errro^Please select Order Status');
  let ret = 'ok';
  try {
    const Plid = req.user.plid;
    const row = await db.procOne(DB, 'usp_updateorderstatus', { orderid: OrderID, branchid: Plid, empid: Plid, status: Status, remark: Remark });
    ret = s(outVal(row, 'strresult'));

    // Send Notification for Order Processing.  db._tbl_order_master.Where(a => a.orderID == OrderID).FirstOrDefault()
    const order = await db.queryOne(DB, 'select orderid, status, fname, emailid, mobileno from tbl_order_master where orderid = @OrderID limit 1', { OrderID });
    const arr = ret.split('^');
    if (arr[0] !== 'error') {
      if (!order) throw NRE(); // order.status
      if (order.status === Status) {
        let MobileMessage = '';
        let EmailMessage = '';
        const need = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); }; // order.MobileNo.ToString()
        if (order.status === 'Confirm') {
          MobileMessage = 'Your Order No ' + s(order.orderid) + ' has been Confirmed . Now we will update the delivery status soon .';
          // SendMessage("", order.MobileNo.ToString(), MobileMessage);  (commented out in legacy)
          EmailMessage = 'Your Order No ' + s(order.orderid) + ' has been Confirmed . Now we will update the delivery status soon .';
          await SendMail(order.fname, order.emailid, order.orderid, order.status, EmailMessage);
        }
        if (order.status === 'Pack') {
          // Admin Mail
          EmailMessage = 'Order No ' + s(order.orderid) + ' has been Packed. Please collect order.';
          await SendMail('Admin ', '' + s(CompanySettings.CompanyInfoEmailId) + '', order.orderid, order.status, EmailMessage);
        } else if (order.status === 'ReadyToShip') {
          MobileMessage = 'Your Order No ' + s(order.orderid) + ' is Ready To Ship.';
          await SendMessage('', need(order.mobileno), MobileMessage);
          EmailMessage = 'Your Order No ' + s(order.orderid) + ' is Ready To Ship.';
          await SendMail(order.fname, order.emailid, order.orderid, order.status, EmailMessage);
        } else if (order.status === 'Cancelled') {
          MobileMessage = 'Your Order No ' + s(order.orderid) + ' has been Cancelled.';
          await SendMessage('', need(order.mobileno), MobileMessage);
          EmailMessage = 'Your Order No ' + s(order.orderid) + ' has been Cancelled.';
          await SendMail(order.fname, order.emailid, order.orderid, order.status, EmailMessage);
        } else if (order.status === 'Return') {
          MobileMessage = 'Your Order No ' + s(order.orderid) + ' has been Returned.';
          await SendMessage('', need(order.mobileno), MobileMessage);
          EmailMessage = 'Your Order No ' + s(order.orderid) + ' has been Returned.';
          await SendMail(order.fname, order.emailid, order.orderid, order.status, EmailMessage);
        }
        void MobileMessage;
      }
    }
  } catch (ex) {
    ret = 'error^' + ex.message;
  }
  return res.json(ret);
}));

// ---- UpdateProductQuantity --------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`${C}/UpdateProductQuantity{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p0 = first(listParam(req));
  const OrderID = pget(p0, 'OrderID');
  const SubPrCode = pget(p0, 'SubPrCode');
  const NewQuantity = intProp(pget(p0, 'NewQuantity'));
  if (!ps.isCustomer(req)) return res.json('errro^This page has been expired, Please login again.');
  if (OrderID === null || OrderID === undefined || OrderID === '') return res.json('errro^Invalid Order ID');
  if (SubPrCode === null || SubPrCode === undefined || SubPrCode === '') return res.json('errro^Please select Order Status');
  if (NewQuantity <= 0 && NewQuantity > 10) return res.json('errro^Please select valid quanatity'); // legacy condition (never true)
  let ret = 'ok';
  try {
    const Plid = req.user.plid;
    // usp_updateorderproductquantity is absent from dbshopping.sql
    const row = await db.procOne(DB, 'usp_updateorderproductquantity', {
      orderid: OrderID, subprcode: SubPrCode, newquantity: NewQuantity, brcode: Plid, emp_code: Plid,
    });
    ret = s(outVal(row, 'strresult'));
    return res.json(ret);
  } catch (ex) {
    ret = 'error^' + ex.message;
    return res.json(ret);
  }
}));

// ---- SendMessage (public string => Content) -----------------------------------------------------------------
// public (legacy: no session check; no-op returning "0")
router.all(`${C}/SendMessage{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  res.type('text/plain').send(await SendMessage(req.p.MobileNo, req.p.Status, req.p.Message));
}));

// ---- SendMail (public string => Content) ---------------------------------------------------------------------
// auth (legacy: routable public method with no session check; PORT-NOTE: protected because it sends arbitrary mail (open relay))
router.all(`${C}/SendMail{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  res.type('text/plain').send(await SendMail(req.p.Name, req.p.Email, req.p.OrderId, req.p.Status, req.p.Message));
}));

void toInt32;
module.exports = router;
