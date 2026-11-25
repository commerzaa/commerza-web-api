'use strict';
/** Ported from Member\Common\Controllers\currencyConverterController.cs (currencyConverterController) */
const express = require('express');
const axios = require('axios');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const P = '/member/currencyConverter';

// public (no session check in legacy; view only)
// route-config: url "currencyConverter" -> currencyConverter/Index
router.all([`${P}/Index{/:id}`, P, '/member/currencyConverter'], asyncHandler(async (req, res) => {
  res.json({});
}));

// public ([HttpPost])
router.post(`${P}/CurrencyConverter{/:id}`, asyncHandler(async (req, res) => {
  const { currencyFrom, currencyTo } = req.p;
  const value = Number(req.p.value);
  let BTCRateInInr = 0;
  try {
    const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/' + currencyFrom + '/?convert=' + currencyTo + '';
    const resp = await axios.get(UrlForHit, { responseType: 'text', transformResponse: [(d) => d] });
    const ObjBTCRateManagement = JSON.parse(resp.data);
    for (const Item of ObjBTCRateManagement) {
      if (String(Item.id) === currencyFrom) {
        BTCRateInInr = Number(Item['price_' + String(currencyTo).toLowerCase()]);
        if (Number.isNaN(BTCRateInInr)) throw new Error('Input string was not in a correct format.');
        BTCRateInInr = BTCRateInInr * value;
      }
    }
  } catch (ExpObj) {
    BTCRateInInr = 0;
    try {
      await new DataUtility().ErrorInsert(0, ExpObj.message, 'CurrencyConverter', 0, req.path);
    } catch (e) { console.error(e.message); }
  }
  res.json(BTCRateInInr);
}));

module.exports = router;
