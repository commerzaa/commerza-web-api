'use strict';
/**
 * Port of Member/Common/Controllers/IPNController.cs (IPNController : ApiController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate' (DataUtility.ExecuteSqlSP)
 */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();

// JObject["key"].ToString(): a missing key is null => NullReferenceException; JSON null => ""
function jstr(o, key) {
  if (o === null || o === undefined || typeof o !== 'object' || !(key in o)) throw new Error('Object reference not set to an instance of an object.');
  const v = o[key];
  if (v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function GETIPNDETAILS(req, res) {
  let JsonObject = req.body;
  if (JsonObject === undefined || JsonObject === null || (typeof JsonObject === 'object' && !Array.isArray(JsonObject) && Object.keys(JsonObject).length === 0 && req.method === 'GET')) JsonObject = null;
  try {
    const ipn_version = jstr(JsonObject, 'ipn_version');
    const ipn_type = jstr(JsonObject, 'ipn_type');
    const ipn_mode = jstr(JsonObject, 'ipn_mode');
    const ipn_id = jstr(JsonObject, 'ipn_id');
    const merchant = jstr(JsonObject, 'merchant');
    const address = jstr(JsonObject, 'address');
    const txn_id = jstr(JsonObject, 'txn_id');
    const status = jstr(JsonObject, 'status');
    const status_text = jstr(JsonObject, 'status_text');
    const currency = jstr(JsonObject, 'currency');
    const confirms = jstr(JsonObject, 'confirms');
    const amount = jstr(JsonObject, 'amount');
    const amounti = jstr(JsonObject, 'amounti');
    const fee = '0.0000000';
    const feei = '0.0000000';
    const dest_tag = '';

    const P = DataUtility.SqlParameter;
    const Param = [
      P('@IPN_VERSION', ipn_version.trim()),
      P('@IPN_TYPE', ipn_type.trim()),
      P('@IPN_MODE', ipn_mode.trim()),
      P('@IPN_ID', ipn_id.trim()),
      P('@MERCHANT', merchant.trim()),
      P('@ADDRESS', address.trim()),
      P('@TXN_ID', txn_id.trim()),
      P('@STATUS', status.trim()),
      P('@STATUS_TEXT', status_text.trim()),
      P('@CURRENCY', currency.trim()),
      P('@CONFIRMS', confirms.trim()),
      P('@AMOUNT', amount.trim()),
      P('@AMOUNTI', amounti.trim()),
      P('@FEE', fee.trim()),
      P('@FEEI', feei.trim()),
      P('@DEST_TAG', dest_tag.trim()),
      // PORT-NOTE: InputOutput params (@STROUTPUT varchar(200), @INTRESULT int) are sent as Output so they are returned as result columns.
      P('@STROUTPUT', null, 'Output'),
      P('@INTRESULT', null, 'Output'),
    ];
    const ObjDut = new DataUtility();
    await ObjDut.ExecuteSqlSP(Param, '[DBO].[Usp_InstantPaymentNotification]');
    res.json({ Flag: 'success', Message: 'API Response Received', Arryjson: JsonObject, ExceptionMessage: '' });
  } catch (EX) {
    res.json({ Flag: 'error', Message: EX.message, Arryjson: JsonObject, ExceptionMessage: EX.message });
  }
}

// public (payment-gateway IPN callback). WebApiConfig route "api/auto-deposit-ipn" -> IPN/GETIPNDETAILS, [HttpGet, HttpPost]
router.get('/member/api/auto-deposit-ipn', asyncHandler(GETIPNDETAILS));
router.post('/member/api/auto-deposit-ipn', asyncHandler(GETIPNDETAILS));

module.exports = router;
