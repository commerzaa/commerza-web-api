/** Exports (static, all async unless noted): OrderidResponse (mutable string property, read as Helper.OrderidResponse); GetApiCall(url): any|""; PostApiCall(url): any; MTBalance(): any; rechargeapi(mobile, operators, amount: float, client_id): any|""; FetchElicricityBill(operators, client_id): any|""; RechargeApiStatus(client_id): any|"{}"; checkPaymentRazor(paymentID): payment attributes|error message string; checkbyOrderID(orderid): void (sets OrderidResponse); FetchByOrdersId(OrderId): string; FetchPaymentMadeForOrder(OrderId): string; UniqueGenerate(): string. Models (StatusModel{status,message}, tbl_serviceProviders) are plain objects. */
'use strict';
const axios = require('axios');
const Razorpay = require('razorpay');
const config = require('../config');
const { scalar } = require('../db');
const { getText, netErrorMessage } = require('./_http');

const razorAuth = () => 'Basic ' + Buffer.from(config.app.razorpayKeyId + ':' + config.app.razorpayKeySecret).toString('base64');

const Helper = {
  OrderidResponse: '',
};

/** JSON.parse of a response; legacy JavaScriptSerializer.Deserialize<dynamic> */
const parse = (json) => JSON.parse(json);

Helper.GetApiCall = async function GetApiCall(url) {
  const rate = '';
  try {
    const json = await getText(url);
    return parse(json);
  } catch (e) { /* swallowed in legacy */ }
  return rate;
};

// legacy had the try/catch commented out: errors propagate
Helper.PostApiCall = async function PostApiCall(url) {
  const r = await axios.post(url, '', { responseType: 'text', transformResponse: [(d) => d], timeout: 100000 });
  return parse(typeof r.data === 'string' ? r.data : String(r.data));
};

Helper.MTBalance = async function MTBalance() {
  const api = 'http://login.isharechargeapi.com/api/v1/getbalance?api_token=' + config.app.RechargeTokenKey;
  return Helper.GetApiCall(api);
};

Helper.rechargeapi = async function rechargeapi(mobile, operators, amount, client_id) {
  const rate = '';
  try {
    const api = 'http://login.isharechargeapi.com/api/v1/recharge?api_token=' + config.app.RechargeTokenKey + '&number=' + mobile + '&provider_id=' + operators + '&amount=' + amount + '&client_id=' + client_id;
    return await Helper.PostApiCall(api);
  } catch (e) { /* swallowed in legacy */ }
  return rate;
};

Helper.FetchElicricityBill = async function FetchElicricityBill(operators, client_id) {
  const rate = '';
  try {
    const api = 'http://login.isharechargeapi.com/api/v1/FetchBallance?operatid=' + operators + '&customer=' + client_id + '';
    return await Helper.PostApiCall(api);
  } catch (e) { /* swallowed in legacy */ }
  return rate;
};

Helper.RechargeApiStatus = async function RechargeApiStatus(client_id) {
  try {
    const api = 'http://login.isharechargeapi.com/api/v1/RechargeStatus?api_token=' + config.app.RechargeTokenKey + '&client_id=' + client_id;
    const json = await getText(api);
    return parse(json);
  } catch (e) { return '{}'; }
};

Helper.checkPaymentRazor = async function checkPaymentRazor(paymentID) {
  try {
    const client = new Razorpay({ key_id: config.app.razorpayKeyId, key_secret: config.app.razorpayKeySecret });
    const payment = await client.payments.fetch(paymentID);
    const da = payment; // payment.Attributes
    Helper.OrderidResponse = '';
    return da;
  } catch (ex) {
    const msg = (ex && ex.error && ex.error.description) || (ex && ex.message) || String(ex);
    Helper.OrderidResponse = msg;
    return msg;
  }
};

// PORT-NOTE: legacy ignores the orderid argument and always requests the hard-coded order id below (async void: exceptions are not observable by callers)
Helper.checkbyOrderID = async function checkbyOrderID(orderid) {
  const _object = await getText('https://api.razorpay.com/v1/orders/order_KHm1qtFLAILHHQ/payments', { Authorization: razorAuth() });
  Helper.OrderidResponse = _object.toString();
};

// PORT-NOTE: legacy URL has a ":" before the id ("orders/:<id>"); kept
Helper.FetchByOrdersId = async function FetchByOrdersId(OrderId) {
  const BaseURl = 'https://api.razorpay.com/v1/orders/:' + OrderId + '';
  let StrPostData = '';
  try {
    StrPostData = await getText(BaseURl, { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (ex) {
    StrPostData = netErrorMessage(ex);
  }
  return StrPostData;
};

Helper.FetchPaymentMadeForOrder = async function FetchPaymentMadeForOrder(OrderId) {
  const BaseURl = 'https://api.razorpay.com/v1/orders/:' + OrderId + '/payments';
  let StrPostData = '';
  try {
    StrPostData = await getText(BaseURl, { 'Content-Type': 'application/json', Authorization: razorAuth() }, 100000);
  } catch (ex) { /* swallowed in legacy */ }
  return StrPostData;
};

Helper.UniqueGenerate = async function UniqueGenerate() {
  const RandomID = 'order_' + String(Math.floor(Math.random() * 999999999)).padStart(9, '0');
  // DefaultConnection => Db_Affiliate
  const exists = await scalar('affiliate', 'select 1 from tbl_recharge where referenceno=@RandomID limit 1', { RandomID });
  if (exists !== null && exists !== undefined) return Helper.UniqueGenerate();
  return RandomID;
};

module.exports = Helper;
