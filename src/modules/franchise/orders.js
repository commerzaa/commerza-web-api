'use strict';
/**
 * Port of Franchise/Controllers/Orders.cs (OrdersController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Orders';

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() equivalent for one table */
function getXml(ds) {
  let x = '<NewDataSet>';
  for (const name of Object.keys(ds)) {
    for (const r of ds[name]) {
      x += `<${name}>`;
      for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== undefined) x += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
      x += `</${name}>`;
    }
  }
  return x + '</NewDataSet>';
}


function pget(o, name) {
  if (!o) return undefined;
  const k = Object.keys(o).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : o[k];
}
const ALLORDER_PROPS = ['MobileNo', 'netPayblePrice', 'orderDate', 'orderID', 'orid', 'OStatus', 'PayMode', 'PayRemark', 'Poid', 'Prod_Images', 'Product_Name',
  'quntity', 'ReplacementDate', 'ReplacementDay', 'rowNumber', 'ShippingAddress', 'singleProdPrice', 'Total_Ship_Ch', 'total_cost', 'Total_payble_vat',
  'total_purchase_cost', 'OrderQty', 'OrderTotalAmount', 'OrderTotalVat', 'OrderShippingCharges', 'Status', 'Name', 'totalPaybleAmt'];

// ---- CancelProductOrderStatus ----------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/CancelProductOrderStatus{/:id}`, auth, asyncHandler(async (req, res) => {
  const param = Array.isArray(req.body) ? req.body : (pget(req.body, 'param') || []);
  const first = param[0];
  const OrderID = pget(first, 'OrderID');
  const SPRID = pget(first, 'SPRID');
  const Status = pget(first, 'Status');
  let Remark = pget(first, 'Remark');
  let Reason = pget(first, 'Reason');

  let RegNo = 0;
  RegNo = Number(req.user.did); // Session["Plid"] null check => auth middleware
  const IsCancelByMember = RegNo !== 0;
  if (OrderID == null || OrderID === '') return res.json('errro^Invalid Order ID');
  if (Status == null || Status === '') return res.json('errro^Please select Order Status');
  // legacy precedence: (IsCancelByMember && Reason == null) || Reason == ""
  if ((IsCancelByMember === true && Reason == null) || Reason === '') return res.json('errro^Please select Reason for Order Cancellation');
  if (Reason == null) Reason = '';
  if (Remark == null) Remark = '';

  let ret = 'ok';
  try {
    const o = await procOne(DB, 'usp_updateorderstatus_new', { orderid: OrderID, poid: SPRID, status: Status, remark: Remark, reason: Reason, iscancelbymember: IsCancelByMember });
    ret = s(outVal(o, 'strresult'));
  } catch (ex) {
    ret = 'error^' + ex.message;
  }
  res.json(ret);
}));

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate, page } = req.p;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const LoginId = req.user.loginid;
  const rows = await proc(DB, 'usp_user_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    loginid: LoginId,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  res.json({
    Model: mapRows(rows, ALLORDER_PROPS),
    ViewBag: { CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate },
  });
}));

module.exports = router;
