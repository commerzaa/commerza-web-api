'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AddMoneyController.cs (class AddMoneyController => /portal/AddMoney/...)
// Database: shopping (Db_Shopping).
// [CheckResellerTimeout] / [DistributerSessionExpireCheck]: bodies commented out in legacy => no check.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const CompanySettings = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, view, masterpageshow, outv, s, need, bindDecimal, toInt32 } = require('./_shared/batch-02-common');

const { CompanyMasterSettings } = CompanySettings;
const router = express.Router();
const C = '/portal/AddMoney';

// ---------------------------------------------------------------- Index()
// auth ([SessionExpireCheck])
// route-config: "customer/addmoney" -> AddMoney/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/addmoney'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.masterpageshow = masterpageshow(req);
  if (ps.isCustomer(req)) {
    const Plid = Number(req.user.plid);
    if (Plid !== 0) {
      const end = UtilityClass.Encryptword('Checkout'); // computed and unused in legacy
      void end;
      ViewBag.UserWallet = await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid));
    }
    return view(res, '~/Views/CustomerPanel/AddMoney/Index.cshtml', undefined, ViewBag);
  }
  return view(res, '~/', undefined, ViewBag);
}));

// ---------------------------------------------------------------- AddMoneyToWallet(decimal addedMoney = 0)
// public (legacy: no filter; without a session the (Login)Session["Plid"] cast threw and the catch returned "/page-not-found" - reproduced inline)
router.all(`${C}/AddMoneyToWallet{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const addedMoney = bindDecimal(req.p.addedMoney, 0);
  try {
    if (addedMoney < 0) {
      return res.json('Amount should be positive');
    }
    let outputResult = ''; let transactionID = '';
    const source = 'Add Money';
    const requestedURL = need(config.app.CompanyDomain); // ConfigurationManager.AppSettings["CompanyDomain"].ToString()
    const successurl = requestedURL + '/secure-jewria-payment-gateway/payment-success';
    const failureurl = requestedURL + '/secure-jewria-payment-gateway/payment-failed';
    const inprocessurl = requestedURL + '/secure-jewria-payment-gateway/payment-inprocess';
    const canceledurl = requestedURL + '/secure-jewria-payment-gateway/payment-cancel';
    if (!ps.isCustomer(req)) throw new TypeError('Object reference not set to an instance of an object.');
    const Plid = Number(req.user.plid);
    if (Plid > 0) {
      const rows = await db.proc(DB, 'USP_ADDMONEYREQUESTS', {
        CLID: Plid, AMOUNT: addedMoney, SOURCE: source, SUCCESSURL: successurl, FAILUREURL: failureurl, INPROCESSURL: inprocessurl,
        CANCELLEDURL: canceledurl,
      });
      outputResult = s(outv(rows, 'STROUTPUT'));
      transactionID = s(outv(rows, 'TRANSACTIONID'));
      if (outputResult.toUpperCase() === 'SUCCESS' && transactionID !== '' && successurl !== '' && failureurl !== '' && inprocessurl !== ''
        && canceledurl !== '' && source !== '') {
        let PMID = CompanySettings.PMID;
        if (PMID === 0) {
          // string resellerDomain = Request.Url.GetLeftPart(UriPartial.Authority); (unused)
          await CompanyMasterSettings.GetResellerData();
          PMID = CompanySettings.PMID;
        }
        const BaseURL = need(config.app.PaymentURL); // AppSettings["PaymentURL"].ToString()
        const E = (v) => UtilityClass.Encryptword(v);
        const Url = BaseURL + 'Home?refrenceid=' + E(transactionID) + '&successurl=' + E(successurl) + '&failureurl=' + E(failureurl)
          + '&inprocessurl=' + E(inprocessurl) + '&canceledurl=' + E(canceledurl) + '&source=' + E('Add Money') + '&PMID=' + E(String(PMID)) + '';
        return res.json(Url);
      }
      return res.json('/page-not-found');
    }
    return res.json('/page-not-found');
  } catch (ex) {
    return res.json('/page-not-found');
  }
}));

module.exports = router;
