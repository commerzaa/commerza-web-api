'use strict';
// Ported from Franchise\Controllers\CustomerPanel\REFERALCOMMISSION.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/REFERALCOMMISSION';
const PROPS = ['ROWNUMBER', 'EMAILID', 'DATE', 'MerchantName', 'MerchantEmailid', 'GROSSAMOUNT', 'MerchantPackage', 'COMM_PER', 'COMMISSION', 'Wallet', 'ExchangeStatus'];

// auth
// route-config: franchisee/z8tZG_slash_e89897_slash_RKYsf_kjkjhbslash_kjk787876mYWYRmdC1h
router.all([P + '/Index{/:id}', '/franchise/franchisee/z8tZG_slash_e89897_slash_RKYsf_kjkjhbslash_kjk787876mYWYRmdC1h'], auth, asyncHandler(async (req, res) => {
  let { ORDERID, fromDate, toDate, page, SearchField, SearchValue } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchValue == null) SearchValue = '';
  page = (page == null || page === '') ? 1 : parseInt(page, 10);
  if (SearchField == null) SearchField = '';
  if (ORDERID == null) ORDERID = '';
  const PLID = 0;
  const DID = parseInt(req.user.did, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc('shopping', 'usp_get_franchisee_referalcommission_deatils', {
    ID: PLID, TYPE: 2, STARTROWINDEX: page, MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue,
    FROMDATE: fromDate, TODATE: toDate, DID,
  });
  const merchnatInvoiceDetails = mapRows(rows, PROPS);
  const tc = rows[0] ? Object.keys(rows[0]).find((k) => k.toLowerCase() === 'totalcount') : undefined;
  const TotalRecord = tc !== undefined ? parseInt(rows[0][tc], 10) : 0;
  const ViewBag = {
    CurrentPage: page, fromDate, toDate, SearchField, ORDERID, SearchValue, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  res.json({ Model: merchnatInvoiceDetails, ViewBag, ...ViewBag });
}));

// auth
router.all(P + '/PackagePurchaseRequest{/:id}', auth, asyncHandler(async (req, res) => {
  const PMID = req.p.PMID == null || req.p.PMID === '' ? 0 : parseInt(req.p.PMID, 10);
  try {
    let outputResult = ''; let transactionID = ''; let successurl = ''; let failureurl = '';
    let inprocessurl = ''; let canceledurl = ''; const source = 'Merchant Package';
    const requestedURL = config.app.CompanyDomain.toString();
    successurl = requestedURL + '/secure-payment-gateway/package-payment-success';
    failureurl = requestedURL + '/secure-payment-gateway/package-payment-failed';
    inprocessurl = requestedURL + '/secure-payment-gateway/package-payment-inprocess';
    canceledurl = requestedURL + '/secure-payment-gateway/package-payment-cancel';
    const Plid = 0;
    if (Plid > 0) {
      const o = await db.procOne('shopping', 'usp_merchantpackagepurchase_onlinerequests', {
        PLID: Plid, PMID, SOURCE: source, SUCCESSURL: successurl, FAILUREURL: failureurl, INPROCESSURL: inprocessurl, CANCELLEDURL: canceledurl,
      });
      const g = (n) => { const k = o && Object.keys(o).find((x) => x.toLowerCase() === n); return k ? String(o[k]) : ''; };
      outputResult = g('stroutput');
      transactionID = g('transactionid');
      if (outputResult.toUpperCase() === 'SUCCESS' && transactionID !== '' && successurl !== '' && failureurl !== '' && inprocessurl !== '' && canceledurl !== '' && source !== '') {
        const BaseURL = config.app.PaymentURL.toString();
        const enc = (v) => UtilityClass.Encryptword(v);
        const Url = BaseURL + 'Home?refrenceid=' + await enc(transactionID) + '&successurl=' + await enc(successurl) + '&failureurl=' + await enc(failureurl) +
          '&inprocessurl=' + await enc(inprocessurl) + '&canceledurl=' + await enc(canceledurl) + '&source=' + await enc('Merchant Package') +
          '&PMID=0' + '&Plid=' + await enc(String(Plid)) + '';
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
