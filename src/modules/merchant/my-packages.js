'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\MyPackages.cs (MyPackagesController)  - DB: shopping (Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const config = require('../../config');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const P = '/merchant/MyPackages';
const PROPS = ['ROWNUMBER', 'NAME', 'DISCRIPTION', 'PURCHASEDDATE', 'ACTIVATIONDAYS', 'NO_OF_PRODUCT', 'NO_OF_SERVICE', 'ISDEALS', 'ISTRAILPACKAGE', 'STATUS', 'AMOUNT', 'MPID'];

function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k !== undefined ? row[k] : null;
}
const outStr = (row, name) => {
  const v = outVal(row, name);
  if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  return String(v);
};

// auth ([SessionExpireCheck]) ; route-config: merchant/z8tZG_slash_e89897_slash_RKYsf_kjkjhbslash_m8EkQv95zYWYRmdC1h
router.all([`${P}/Index{/:id}`, P, '/merchant/z8tZG_slash_e89897_slash_RKYsf_kjkjhbslash_m8EkQv95zYWYRmdC1h'], ...guard, asyncHandler(async (req, res) => {
  let { ORDERID, fromDate, toDate, page, SearchField, SearchValue } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchValue == null) SearchValue = '';
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (SearchField == null) SearchField = '';
  if (ORDERID == null) ORDERID = '';
  const PLID = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc(DB, 'usp_get_merchantpackages', {
    plid: PLID, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
  });
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row (0 when no rows)
  const TotalRecord = rows.length && rows[0].totalcount != null ? parseInt(rows[0].totalcount, 10) : 0;
  const ViewBag = {
    CurrentPage: page, fromDate, toDate, SearchField, ORDERID, SearchValue, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  res.json({ Model: mapRows(rows, PROPS), ViewBag, ...ViewBag });
}));

// auth
router.all(`${P}/PackagePurchaseRequest{/:id}`, ...guard, asyncHandler(async (req, res) => {
  try {
    let PMID = req.p.PMID;
    PMID = (PMID === undefined || PMID === null || PMID === '') ? 0 : parseInt(PMID, 10);
    if (Number.isNaN(PMID)) throw new Error('The parameter conversion from type System.String to type System.Int32 failed.');
    let outputResult = '';
    let transactionID = '';
    const source = 'Merchant Package';
    const requestedURL = String(config.app.CompanyDomain || '');
    const successurl = requestedURL + '/secure-payment-gateway/package-payment-success';
    const failureurl = requestedURL + '/secure-payment-gateway/package-payment-failed';
    const inprocessurl = requestedURL + '/secure-payment-gateway/package-payment-inprocess';
    const canceledurl = requestedURL + '/secure-payment-gateway/package-payment-cancel';
    const Plid = Number(req.user.plid);
    if (Plid > 0) {
      const o = await db.procOne(DB, 'usp_merchantpackagepurchase_onlinerequests', {
        plid: Plid, pmid: PMID, source, successurl, failureurl, inprocessurl, cancelledurl: canceledurl,
      });
      outputResult = outStr(o, 'stroutput');
      transactionID = outStr(o, 'transactionid');
      if (outputResult.toUpperCase() === 'SUCCESS' && transactionID !== '' && successurl !== '' && failureurl !== '' && inprocessurl !== '' && canceledurl !== '' && source !== '') {
        const BaseURL = String(config.app.PaymentURL);
        const Url = BaseURL + 'Home?refrenceid=' + await UtilityClass.Encryptword(transactionID) + '&successurl=' + await UtilityClass.Encryptword(successurl)
          + '&failureurl=' + await UtilityClass.Encryptword(failureurl) + '&inprocessurl=' + await UtilityClass.Encryptword(inprocessurl)
          + '&canceledurl=' + await UtilityClass.Encryptword(canceledurl) + '&source=' + await UtilityClass.Encryptword('Merchant Package')
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
