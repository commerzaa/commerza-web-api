'use strict';
// Ported from Member/Controllers/BitcoinGraphController.cs  (no DB access)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');

// C# ToString("#,##0,,M", InvariantCulture): value divided by 1,000,000, rounded, thousands separated, suffix M
const fmtM = (v) => Math.round(Number(v) / 1e6).toLocaleString('en-US') + 'M';

// public (outer page). route-config: url "BitcoinGraph" -> BitcoinGraph/Index
router.all(['/member/BitcoinGraph/Index{/:id}', '/member/BitcoinGraph'], asyncHandler(async (req, res) => {
  const ViewBag = {};
  let BTCRateUsd = 0; let percent_change_24h = 0; let High = 0;
  try {
    const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/bitcoin/?convert=Usd';
    const Result = (await axios.get(UrlForHit, { responseType: 'text', transformResponse: (d) => d })).data;
    const ObjBTCRateManagement = JSON.parse(Result);
    if (!Array.isArray(ObjBTCRateManagement)) throw new Error('Error reading JArray from JsonReader.');
    for (const Item of ObjBTCRateManagement) {
      if (String(Item.symbol) === 'BTC') {
        BTCRateUsd = Number(Item.price_usd);
        ViewBag.BTCRateInInr = BTCRateUsd;

        ViewBag.market_cap_usd = fmtM(Number(Item.market_cap_usd));

        percent_change_24h = Number(Item.percent_change_24h);
        High = (BTCRateUsd * percent_change_24h) / 100;
        ViewBag.percent_change_24h = percent_change_24h;
        ViewBag.High = High;

        ViewBag.available_supply = fmtM(Number(Item.available_supply));

        ViewBag.percent_change_7d = (BTCRateUsd * Number(Item.percent_change_7d)) / 100;

        ViewBag.percent_change_1h = (BTCRateUsd * Number(Item.percent_change_1h)) / 100;

        ViewBag.rank = Number(Item.rank);

        ViewBag.last_updated = Number(Item.last_updated);
      }
    }
  } catch (ExpObj) {
    BTCRateUsd = 0;
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Index', 0, req.path); } catch (_) { /* ignore */ }
  }
  res.json({ View: '~/Views/BitcoinGraph/BitcoinGraph.cshtml', ViewBag });
}));

module.exports = router;
