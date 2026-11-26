// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\OrderDirectLoginController.cs
'use strict';
const DB = 'shopping';
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { CompanyMasterSettings } = require('../../lib/portal/CompanySettings');

const router = express.Router();

/** Controllers/UserPanel/Orders.cs class AllOrderList */
const ALL_ORDER_LIST = ['MobileNo', 'netPayblePrice', 'orderDate', 'orderID', 'orid', 'OStatus', 'PayMode', 'PayRemark', 'Poid', 'Prod_Images',
  'Product_Name', 'quntity', 'ReplacementDate', 'ReplacementDay', 'rowNumber', 'ShippingAddress', 'singleProdPrice', 'Total_Ship_Ch', 'total_cost',
  'Total_payble_vat', 'total_purchase_cost', 'OrderQty', 'OrderTotalAmount', 'OrderTotalVat', 'OrderShippingCharges', 'Status', 'Name',
  'totalPaybleAmt', 'Order_PV', 'Order_BV', 'IntStatus', 'MLMWALLET', 'MLMWALLET1', 'MLMWALLET2', 'MLMWALLET3', 'OnlinePayments', 'CUSTOMERWALLET',
  'MLMWALLETTransactionId', 'MLMWALLET1TransactionId', 'MLMWALLET2TransactionId', 'MLMWALLET3TransactionId', 'OnlinePaymentsTransactionId',
  'InvoiceNo', 'SPRID'];

const toInt32 = (v) => {
  if (v === null || v === undefined) return 0; // Convert.ToInt32(null) = 0
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
};

// public (login action: the legacy logs the customer in from an encrypted clid, no session check)
// PORT-NOTE: legacy auto-login by encrypted CLID (reads PHONE/PASSWORD from TBL_CUSTOMERLOGIN and calls USP_PORTALLOGIN_M_CUSTOMER);
//   kept public like the legacy. Security issue: anyone holding the encrypted clid gets a customer token.
// route-config: reseller/{loginid}/order-Login-profile
router.all(['/portal/OrderDirectLogin/Index{/:id}', '/portal/reseller/:loginid/order-Login-profile'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let SearchField = req.p.SearchField;
  let SearchValue = req.p.SearchValue;
  let fromDate = req.p.fromDate;
  let toDate = req.p.toDate;
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : toInt32(req.p.page);
  let Orderid = req.p.Orderid;
  let clid = req.p.clid === undefined ? null : req.p.clid;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (clid !== '') clid = await UtilityClass.Decryptword(clid);
  if (Orderid == null) Orderid = '';
  else Orderid = await UtilityClass.Decryptword(Orderid);

  let DID = 1;
  await CompanyMasterSettings.GetResellerData();
  DID = toInt32(config.app.DID);
  if (DID === 0) DID = 1;
  const custCLID = toInt32(clid);
  // PORT-NOTE: legacy concatenated CLID into the SQL; parameterised here.
  const UserName = await db.scalar(DB, 'select phone from tbl_customerlogin where clid = @clid limit 1', { clid: custCLID });
  const Password = await db.scalar(DB, 'select password from tbl_customerlogin where clid = @clid limit 1', { clid: custCLID });
  const didRow = await db.queryOne(DB, 'select did from tbl_customerlogin where clid = @clid limit 1', { clid: custCLID });
  const Did = didRow ? didRow.did : 0;
  const loginRow = await db.procOne(DB, 'usp_portallogin_m_customer', { USERNAME: UserName, PASSWORD: Password, IPADDRESS: '', DID: Did });
  const ObjLogin = loginRow ? mapRow(loginRow, ps.LOGIN_PROPS) : null;
  let token;
  if (ObjLogin) token = ps.issueCustomerToken(ObjLogin, req); // Session["Plid"] = ObjLogin
  else ps.sessionRemove(req, 'Plid');

  const MaxRows = UtilityClass.GridPageSize();
  if (page == null) page = 1;
  // ((Login)Session["Plid"]).LoginID: null login -> legacy NullReferenceException (unhandled -> error page)
  if (!ObjLogin) throw new Error('Object reference not set to an instance of an object.');
  const LoginId = ObjLogin.LoginID;
  const rows = await db.proc(DB, 'usp_user_order_list', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: Orderid.trim(), SEARCHVALUE: String(SearchValue).trim(), FROMDATE: String(fromDate).trim(),
    TODATE: String(toDate).trim(), LOGINID: LoginId, STATUS: '', DID,
  });
  const objAllOrderList = mapRows(rows, ALL_ORDER_LIST);
  // @TotalCount OUT: returned as a column of the result rows
  const tc = rows.length && rows[0].totalcount !== undefined ? rows[0].totalcount : null;
  // PORT-NOTE: no result row => no OUTPUT column in PostgreSQL; treated as 0 (SQL Server still returned @TotalCount).
  const TotalRecord = tc === null || tc === undefined ? 0 : toInt32(tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.OrderType = 'All Orders';
  res.json({ Model: objAllOrderList, ViewBag, ...ViewBag, token });
}));

module.exports = router;
