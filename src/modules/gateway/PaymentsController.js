'use strict';
/**
 * Port of Payment Gateway Controllers/PaymentsController.cs (PayU integration test page). No database access.
 * C# members: PayUGateway, successUrl, failUrl. Model Eblaa_Payments.Models.PayU is a property bag (plain object here).
 *
 * Callers: PayUGateway is a developer test page (browser); successUrl / failUrl are PayU browser callbacks (form POST) => public.
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const config = require('../../config');
const PF = require('../../lib/gateway/PaymentFunctions');

const PaymentFunctions = PF.PaymentFunctions || PF;
const P = '/gateway/Payments';

// public (test page)
router.all(`${P}/PayUGateway{/:id}`, asyncHandler(async (req, res) => {
  // PORT-NOTE: legacy hard-codes the PayU test key ("key") and salt; they are read from config here
  // (config.app.PayUGatewayTestKey / config.app.PayUGatewayTestSalt) - never copied into code.
  const parameters = {
    key: String(config.app.PayUGatewayTestKey || ''),
    txnid: '8j87isoidf',
    amount: '1000.00',
    productinfo: 'shirt',
    firstname: 'nazim',
    email: 'nazim@gmail.com',
    udf1: 'optional_value1',
    phone: '9971607600',
    // udf2, udf3, udf4, udf5 not provided - will be empty strings
  };

  const model = {
    key: parameters.key,
    transaction: parameters.txnid,
    amount: Number(parameters.amount), // Convert.ToDecimal("1000.00")
    productInfo: parameters.productinfo,
    customerName: parameters.firstname,
    email: parameters.email,
    phone: parameters.phone,
    surl: null,
    furl: null,
    hash: null,
  };

  const salt = String(config.app.PayUGatewayTestSalt || '');

  // key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt (lib Utility.PaymentFunctions.GenerateHash)
  model.hash = await PaymentFunctions.GenerateHash(parameters, salt);

  model.surl = 'http://localhost:45200/Payments/successUrl';
  model.furl = 'http://localhost:45200/Payments/failUrl';
  return res.json({ view: '~/Views/Payments/PayUGateway.cshtml', Model: model });
}));

/** successUrl / failUrl: read Request.Form["mihpayid"|"status"|"mode"|"amount"] (unused) and return null => EmptyResult */
function readPayUForm(req) {
  const form = req.body && typeof req.body === 'object' ? req.body : {};
  const mihPayId = form.mihpayid;
  const status = form.status;
  const mode = form.mode;
  const amount = form.amount;
  return { mihPayId, status, mode, amount };
}

// public (PayU surl callback)
router.all(`${P}/successUrl{/:id}`, asyncHandler(async (req, res) => {
  void readPayUForm(req);
  return res.status(200).end();
}));

// public (PayU furl callback)
router.all(`${P}/failUrl{/:id}`, asyncHandler(async (req, res) => {
  void readPayUForm(req);
  return res.status(200).end();
}));

module.exports = router;
