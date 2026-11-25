/** Exports (static class RazorCoreAPI, Payment Gateway Models/RazorCoreAPI.cs; all async except GetTimestamp):
 *   CreateOrder(amount: Int32, receipt: string) : string   (Razorpay POST /v1/orders; response logged with USP_MANAGEGATEWAYRESPONSE on Db_Shopping; ex.Message on HTTP failure)
 *   FetchAllOrders() : string ; FetchByOrdersId(OrderId) : string ; FetchPaymentMadeForOrder(OrderId) : string   ("" on any failure)
 *   GetTimestamp(value: Date) : string [sync]   ("yyyyMMddHHmmssffff")
 *   _CreateOrder : class { amount, currency, receipt, payment_capture } ; _CreateOrderProps
 * Database: 'shopping' (gateway Web.config DataBaseContext = Db_Shopping).
 * Config keys: GatewayRazorpayKeyId, GatewayRazorpayKeySecret (the legacy code hard-coded a live key pair that differs from the
 *              ClusterOfferAPI one used by src/lib/RazorCoreAPI.js => separate keys; never copied here).
 * NOTE: logic is identical to src/lib/RazorCoreAPI.js (ClusterOfferAPI) except the database ('affiliate' there) and the credentials,
 *       so this is a gateway copy rather than a re-export.
 */
'use strict';
const { proc } = require('../../db');
const config = require('../../config');
const { getText, postText, jsSerialize, netErrorMessage } = require('../_http');

const DB = 'shopping';

// "Basic " + Convert.ToBase64String(Encoding.Default.GetBytes("<keyId>:<keySecret>"))
const razorAuth = () => 'Basic ' + Buffer.from((config.app.GatewayRazorpayKeyId || '') + ':' + (config.app.GatewayRazorpayKeySecret || ''), 'latin1').toString('base64');

const _CreateOrderProps = ['amount', 'currency', 'receipt', 'payment_capture'];
class _CreateOrder {
  constructor(init) { this.amount = 0; this.currency = null; this.receipt = null; this.payment_capture = 0; Object.assign(this, init); }
}

// Create Order API Here
async function CreateOrder(amount, receipt) {
  const BaseURl = 'https://api.razorpay.com/v1/orders';
  const OBj_CreateOrder = new _CreateOrder({ amount, currency: 'INR', receipt, payment_capture: 1 });
  let StrPostData = jsSerialize(OBj_CreateOrder); // JavaScriptSerializer.Serialize
  const PostRequest = StrPostData;
  try {
    StrPostData = await postText(BaseURl, StrPostData, { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
    try {
      // Db.Database.ExecuteSqlCommand("USP_MANAGEGATEWAYRESPONSE @AMOUNT,@ORDERID,@Request,@Response", ...)
      // PORT-NOTE: USP_MANAGEGATEWAYRESPONSE is not in the Db_Shopping schema dump; any failure is swallowed exactly like the legacy inner catch.
      await proc(DB, 'usp_managegatewayresponse', { amount, orderid: receipt, request: PostRequest, response: StrPostData });
    } catch (e) {
      return StrPostData;
    }
    return StrPostData;
  } catch (expMessage) {
    return netErrorMessage(expMessage);
  }
}

// Fetch All Order Made
async function FetchAllOrders() {
  const BaseURl = 'https://api.razorpay.com/v1/orders';
  let StrPostData = '';
  try {
    StrPostData = await getText(BaseURl, { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

// Fetch Order Details By Order Id
// PORT-NOTE: legacy URL has a ":" before the id ("orders/:<id>"); kept as is.
async function FetchByOrdersId(OrderId) {
  const BaseURl = 'https://api.razorpay.com/v1/orders/:' + OrderId + '';
  let StrPostData = '';
  try {
    StrPostData = await getText(BaseURl, { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

// Fetch All Payment Made For Order
// PORT-NOTE: legacy URL has a ":" before the id ("orders/:<id>/payments"); kept as is.
async function FetchPaymentMadeForOrder(OrderId) {
  const BaseURl = 'https://api.razorpay.com/v1/orders/:' + OrderId + '/payments';
  let StrPostData = '';
  try {
    StrPostData = await getText(BaseURl, { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

// value.ToString("yyyyMMddHHmmssffff") (local time, 4 fraction digits)
function GetTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}0`;
}

module.exports = { CreateOrder, FetchAllOrders, FetchByOrdersId, FetchPaymentMadeForOrder, GetTimestamp, _CreateOrder, _CreateOrderProps };
