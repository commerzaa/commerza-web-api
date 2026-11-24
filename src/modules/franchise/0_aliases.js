'use strict';
// RouteConfig.cs friendly URLs (routes.MapRoute) that map to an action, forwarded to the real handlers.
// Named 0_* so it is mounted first; it rewrites req.url and hands over to the later routers.
const express = require('express');
const router = express.Router();

const ALIASES = {
  'franchisee/Aggregate-Wallet-Statement': 'Aggregate_Wallet_Statement/Index',
  'franchisee/PayYou-Setting': 'PayYou_Setting/Index',
  'franchisee/SMS-API': 'Sms_ApiSetting/Index',
  'franchisee/contact-us': 'Common/ContactUs',
  'store-front': 'OuterPages/AdvertiseSell',
  'term-conditions': 'OuterPages/TermAndConditionAdvertiseSell',
  'how-it-work': 'OuterPages/Howit_work',
  'advertise-benefits': 'OuterPages/Benefites',
  // RouteConfig maps 'franchisee/_plus_O8iwOz_slash_ZX7rbcFYdW4peA==' to controller pending_order, which does not exist in the Franchise project (dead route, not ported).
};

for (const [url, target] of Object.entries(ALIASES)) {
  router.all(`/franchise/${url}`, (req, res, next) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `/franchise/${target}${qs}`;
    next('router');
  });
}
module.exports = router;
