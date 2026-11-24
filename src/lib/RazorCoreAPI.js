/** Exports (static, all async): CreateOrder(amount: Int32, receipt): string; FetchAllOrders(): string; FetchByOrdersId(OrderId): string; FetchPaymentMadeForOrder(OrderId): string; GetTimestamp(value: Date): string */
'use strict';
const { proc } = require('../db');
const config = require('../config');

const { getText, postText, jsSerialize, netErrorMessage } = require('./_http');

const razorAuth = () => 'Basic ' + Buffer.from(config.app.razorpayKeyId + ':' + config.app.razorpayKeySecret).toString('base64');

async function CreateOrder(amount, receipt) {
  const BaseURl = 'https://api.razorpay.com/v1/orders';
  const PostRequest = jsSerialize({ amount, currency: 'INR', receipt, payment_capture: 1 });
  let StrPostData = PostRequest;
  try {
    StrPostData = await postText(BaseURl, PostRequest, { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
    try {
      // DataBaseContext => Db_Affiliate. PORT-NOTE: USP_MANAGEGATEWAYRESPONSE is not in either schema dump; failure is swallowed exactly like the legacy catch.

      await proc('affiliate', 'usp_managegatewayresponse', { amount, orderid: receipt, request: PostRequest, response: StrPostData });
    } catch (e) {
      return StrPostData;
    }
    return StrPostData;
  } catch (expMessage) {
    return netErrorMessage(expMessage);
  }
}

async function FetchAllOrders() {
  let StrPostData = '';
  try {
    StrPostData = await getText('https://api.razorpay.com/v1/orders', { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

// PORT-NOTE: legacy URL has a ":" before the id ("orders/:<id>"); kept
async function FetchByOrdersId(OrderId) {
  let StrPostData = '';
  try {
    StrPostData = await getText('https://api.razorpay.com/v1/orders/:' + OrderId + '', { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

async function FetchPaymentMadeForOrder(OrderId) {
  let StrPostData = '';
  try {
    StrPostData = await getText('https://api.razorpay.com/v1/orders/:' + OrderId + '/payments', { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

async function GetTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}0`;
}

module.exports = { CreateOrder, FetchAllOrders, FetchByOrdersId, FetchPaymentMadeForOrder, GetTimestamp };
