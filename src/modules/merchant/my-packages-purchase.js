'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/MyPackagesPurchase.cs (MyPackagesPurchaseController, 2 actions). DB: 'shopping' */
const express = require('express');
const { proc, procOne } = require('../../db');
const config = require('../../config');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const router = express.Router();
const DB = 'shopping';
// NOTE: legacy SqlQuery<MyPackages> (class in MyPackages.cs) - properties:
const PROPS = ['ROWNUMBER', 'NAME', 'DISCRIPTION', 'PURCHASEDDATE', 'ACTIVATIONDAYS', 'NO_OF_PRODUCT', 'NO_OF_SERVICE', 'ISDEALS', 'ISTRAILPACKAGE', 'STATUS', 'AMOUNT', 'MPID'];
const s = (v, d = '') => (v === undefined || v === null ? d : String(v));

// route-config: merchant/z8tZG_slash_e89897_slash_RKYsf_kjkjhbslash_kjk787876m8EkQv95zYWYRmdC1h -> Index
// auth ([SessionExpireCheck])
router.all(['/merchant/MyPackagesPurchase/Index{/:id}', '/merchant/z8tZG_slash_e89897_slash_RKYsf_kjkjhbslash_kjk787876m8EkQv95zYWYRmdC1h'], auth, asyncHandler(async (req, res) => {
  const ORDERID = s(req.p.ORDERID);
  const fromDate = s(req.p.fromDate);
  const toDate = s(req.p.toDate);
  const SearchField = s(req.p.SearchField);
  const SearchValue = s(req.p.SearchValue);
  const page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? 1 : parseInt(req.p.page, 10);
  const PLID = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_get_merchantpackages_active', {
    plid: PLID, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
  });
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row (0 when no rows)
  const TotalRecord = rows.length && rows[0].totalcount != null ? parseInt(rows[0].totalcount, 10) || 0 : 0;
  res.json({
    view: '~/Views/MyPackagesPurchase/Index.cshtml',
    Model: mapRows(rows, PROPS),
    CurrentPage: page, fromDate, toDate, SearchField, ORDERID, SearchValue,
    GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  });
}));

// auth (legacy cast Session["Plid"]; a missing session threw and was answered with '/page-not-found')
router.all('/merchant/MyPackagesPurchase/PackagePurchaseRequest{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const PMID = req.p.PMID === undefined || req.p.PMID === null || req.p.PMID === '' ? 0 : parseInt(req.p.PMID, 10);
    let outputResult = '', transactionID = '';
    const source = 'Merchant Package';
    const requestedURL = String(config.app.CompanyDomain || '');
    const successurl = requestedURL + '/secure-payment-gateway/package-payment-success';
    const failureurl = requestedURL + '/secure-payment-gateway/package-payment-success';
    const inprocessurl = requestedURL + '/secure-payment-gateway/package-payment-inprocess';
    const canceledurl = requestedURL + '/secure-payment-gateway/package-payment-cancel';
    const Plid = Number(req.user.plid);
    if (Plid > 0) {
      const r = await procOne(DB, 'usp_merchantpackagepurchase_onlinerequests', {
        plid: Plid, pmid: PMID, source, successurl, failureurl, inprocessurl, cancelledurl: canceledurl,
      });
      outputResult = s(r && r.stroutput);
      transactionID = s(r && r.transactionid);
      if (outputResult.toUpperCase() === 'SUCCESS' && transactionID !== '' && successurl !== '' && failureurl !== '' && inprocessurl !== '' && canceledurl !== '' && source !== '') {
        const BaseURL = String(config.app.PaymentURL || '');
        const Url = BaseURL + 'Home?refrenceid=' + await UtilityClass.Encryptword(transactionID)
          + '&successurl=' + await UtilityClass.Encryptword(successurl)
          + '&failureurl=' + await UtilityClass.Encryptword(failureurl)
          + '&inprocessurl=' + await UtilityClass.Encryptword(inprocessurl)
          + '&canceledurl=' + await UtilityClass.Encryptword(canceledurl)
          + '&source=' + await UtilityClass.Encryptword('Merchant Package')
          + '&PMID=0' + '&Plid=' + await UtilityClass.Encryptword(String(Plid));
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
