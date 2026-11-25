'use strict';
// Ported from Member\Controllers\WebhooksPayUMoneyController.cs (Web API controller; database: affiliate - Db_Affiliate)
// WebApiConfig routes: api/payumoney/success|failed|dispute|refund  => /member/api/payumoney/<action>
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// [FromBody] JObject: null for GET / missing body
function bodyObject(req) {
  if (req.method !== 'POST') return null;
  const b = req.body;
  if (b && typeof b === 'object' && !Array.isArray(b)) return b;
  return null;
}

// JObject["key"].ToString(): missing key => NullReferenceException, JSON null => "", strings raw, containers as indented JSON
function jstr(obj, key) {
  const v = obj[key];
  if (v === undefined) throw NRE();
  if (v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

const ok = () => ({ Flag: 'success', Message: 'Webhooks Response Received', ExceptionMessage: '' });
const invalid = () => ({ Flag: 'error', Message: 'Invalid Call !', ExceptionMessage: 'Invalid Call !' });

// Insert Into Tbl_PayUMoneyWebHooksLog(CreateDate,WebHooks,Status,TypeId) Values(DBO.FUN_GETCURRENTDATE(), <json>, 1, <typeId>)
async function logHook(JsonObject, typeId) {
  await db.exec(DB, 'Insert Into tbl_payumoneywebhookslog(createdate,webhooks,status,typeid) Values(now(), @w, 1, @t)', {
    w: JSON.stringify(JsonObject, null, 2), t: typeId,
  });
}

// Success / Failed share the same parsing + USP_WEBHOOKSMANAGEMENT call
async function paymentHook(JsonObject, typeId) {
  if (JsonObject !== null) await logHook(JsonObject, typeId);
  if (JsonObject !== null) {
    const amount = jstr(JsonObject, 'amount');
    const paymentMode = jstr(JsonObject, 'paymentMode');
    const udf5 = jstr(JsonObject, 'udf5');
    const udf3 = jstr(JsonObject, 'udf3');
    const split_info = jstr(JsonObject, 'split_info');
    const udf4 = jstr(JsonObject, 'udf4');
    const udf1 = jstr(JsonObject, 'udf1');
    const udf2 = jstr(JsonObject, 'udf2');
    const customerName = jstr(JsonObject, 'customerName');
    const productInfo = jstr(JsonObject, 'productInfo');
    const customerPhone = jstr(JsonObject, 'customerPhone');
    const additionalCharges = jstr(JsonObject, 'additionalCharges');
    const paymentId = jstr(JsonObject, 'paymentId');
    const customerEmail = jstr(JsonObject, 'customerEmail');
    const merchantTransactionId = jstr(JsonObject, 'merchantTransactionId');
    const error_Message = jstr(JsonObject, 'error_Message');
    const notificationId = jstr(JsonObject, 'notificationId');
    const hash = jstr(JsonObject, 'hash');
    const status = jstr(JsonObject, 'status');
    // PORT-NOTE: DataUtility.ExecuteSqlSP(Param, "[DBO].[USP_WEBHOOKSMANAGEMENT]") => db.proc; @STROUTPUT / @INTRESULT are InputOutput params sent as NULL
    await db.proc(DB, 'usp_webhooksmanagement', {
      amount: amount.trim(), paymentMode: paymentMode.trim(), udf5: udf5.trim(), udf3: udf3.trim(), split_info: split_info.trim(),
      udf4: udf4.trim(), udf1: udf1.trim(), udf2: udf2.trim(), customerName: customerName.trim(), productInfo: productInfo.trim(),
      customerPhone: customerPhone.trim(), additionalCharges: additionalCharges.trim(), paymentId: paymentId.trim(),
      customerEmail: customerEmail.trim(), merchantTransactionId: merchantTransactionId.trim(), error_Message: error_Message.trim(),
      notificationId: notificationId.trim(), hash: hash.trim(), status: status.trim(), STROUTPUT: null, INTRESULT: null,
    });
    return ok();
  }
  return invalid();
}

// public (payment gateway webhook)
router.all(['/member/api/payumoney/success', '/member/WebhooksPayUMoney/Success{/:id}'], asyncHandler(async (req, res) => { // route-config (WebApiConfig)
  res.json(await paymentHook(bodyObject(req), 1));
}));

// public (payment gateway webhook)
router.all(['/member/api/payumoney/failed', '/member/WebhooksPayUMoney/Failed{/:id}'], asyncHandler(async (req, res) => { // route-config (WebApiConfig)
  res.json(await paymentHook(bodyObject(req), 2));
}));

// public (payment gateway webhook)
router.all(['/member/api/payumoney/dispute', '/member/WebhooksPayUMoney/Dispute{/:id}'], asyncHandler(async (req, res) => { // route-config (WebApiConfig)
  const JsonObject = bodyObject(req);
  if (JsonObject !== null) await logHook(JsonObject, 3);
  res.json(ok());
}));

// public (payment gateway webhook)
router.all(['/member/api/payumoney/refund', '/member/WebhooksPayUMoney/Refund{/:id}'], asyncHandler(async (req, res) => { // route-config (WebApiConfig)
  const JsonObject = bodyObject(req);
  if (JsonObject !== null) await logHook(JsonObject, 4);
  res.json(ok());
}));

module.exports = router;
