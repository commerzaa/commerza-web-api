'use strict';
// Ported from Member/Common/Controllers/currencyConvertersController.cs  (currencyConvertersController, 2 actions)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');

const BASE = '/member/currencyConverters';

async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index: view only, no session check -> public
// route-config: currencyConverters
// public
router.all([`${BASE}/Index{/:id}`, BASE], asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/currencyConverters/currencyConverter.cshtml' });
}));

// [HttpPost] CurrencyConverter(string currencyFrom, string currencyTo, decimal value) - no session check -> public
// public
router.post(`${BASE}/CurrencyConverter{/:id}`, asyncHandler(async (req, res) => {
  const currencyFrom = req.p.currencyFrom;
  const currencyTo = req.p.currencyTo;
  const value = Number(req.p.value);
  let BTCRateInInr = 0;
  try {
    const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/' + currencyFrom + '/?convert=' + currencyTo + '';
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (d) => d });
    const ObjBTCRateManagement = JSON.parse(r.data);
    for (const Item of ObjBTCRateManagement) {
      if (String(Item.id) === currencyFrom) {
        BTCRateInInr = Number(Item['price_' + String(currencyTo).toLowerCase()]);
        BTCRateInInr = BTCRateInInr * value;
      }
    }
  } catch (ExpObj) {
    BTCRateInInr = 0;
    await errInsert(req, 'CurrencyConverter', ExpObj);
  }
  res.json(BTCRateInInr);
}));

module.exports = router;
