'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AddMoney_mobileController.cs (class AddMoney_mobileController => /portal/AddMoney_mobile/...)
// Database: shopping (Db_Shopping).
// [CheckResellerTimeout]: body commented out in legacy => no check.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const ps = require('./_shared/portal-session');
const { DB, view, outv, s, bindDecimal, toInt32 } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/AddMoney_mobile';

// ---------------------------------------------------------------- Index()
// auth ([SessionExpireCheck])
// route-config: "customer/addmoney-mobile" -> AddMoney_mobile/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/addmoney-mobile'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  if (ps.isCustomer(req)) {
    const Plid = Number(req.user.plid);
    if (Plid !== 0) {
      ViewBag.UserWallet = await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid));
    }
    return view(res, '~/Views/CustomerPanel/AddMoney_mobile/Index.cshtml', undefined, ViewBag);
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
    const successurl = 'secure-jewria-payment-gateway/payment-success';
    const failureurl = 'secure-jewria-payment-gateway/payment-failed';
    const inprocessurl = 'secure-jewria-payment-gateway/payment-inprocess';
    const canceledurl = 'secure-jewria-payment-gateway/payment-cancel';
    const source = 'Add Money';
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
        const E = (v) => UtilityClass.Encryptword(v);
        const Url = '/secure-jewria-payment-gateway?refrenceid=' + E(transactionID) + '&successurl=' + E(successurl) + '&failureurl=' + E(failureurl)
          + '&inprocessurl=' + E(inprocessurl) + '&canceledurl=' + E(canceledurl) + '&source=' + E(source) + '';
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
