'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\ResellerPackageController.cs
 * Actions: Index, resellerPackagePurchaseRequest, UtlityCommission_List (3)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const RESELLER_SERVICES_PROPS = ['TRSID', 'SERVICENAME'];
const ACTIVEPACKAGE_PROPS = ['PACKAGENAME', 'SERVICENAME'];
const PACKAGE_HISTORY_PROPS = ['ROWNUMBER', 'DID', 'PACKAGENAME', 'Purchasedate', 'PACKAGEAMOUNT', 'INVOICENO', 'SERVICENAME'];
const MASTER_COMMISSION_PROPS = ['ROWNUMBER', 'TVRCSID', 'OPERATORNAME', 'OPERATORCODE', 'SERVICENAME', 'BILLTYPE', 'COMMISSION', 'SURCHARGE', 'STATUS', 'CREATEDATE', 'ACTIVE',
  'PACKAGE1COMMISSION', 'PACKAGE2COMMISSION', 'PACKAGE3COMMISSION', 'PACKAGE4COMMISSION', 'ADMINSURCHARGE', 'DID', 'VENDORNAME', 'TVID'];

// route-config: franchisee/reseller-package
// auth
router.all(['/franchise/ResellerPackage/Index{/:id}', '/franchise/franchisee/reseller-package'], auth, asyncHandler(async (req, res) => {
  let _Package_history = [];
  let _RESELLER_SERVICES = [];
  let _ActivePackage = [];
  const ViewBag = {};
  const Did = parseInt(req.user.did, 10);
  try {
    _RESELLER_SERVICES = mapRows(await db.proc(DB, 'USP_GETRESELLER_SERVICES', { MODE: 1, DID: Did }), RESELLER_SERVICES_PROPS);
    ViewBag.serviceid = _RESELLER_SERVICES;
    _ActivePackage = mapRows(await db.proc(DB, 'USP_GETRESELLER_SERVICES', { MODE: 2, DID: Did }), ACTIVEPACKAGE_PROPS);
    ViewBag._ActivePackage = _ActivePackage;
    _Package_history = mapRows(await db.proc(DB, 'USP_GETPURCHASEDPACKAGED_HISTORY', { DID: Did }), PACKAGE_HISTORY_PROPS);
    ViewBag.Packagepurchasehistory = _Package_history;
    const tr = await db.scalar(DB, 'SELECT coalesce(TRANSATIONPAYUMONEYRATE,0) FROM TBL_COMPANYSETTINGS WHERE PMID=8 LIMIT 1');
    ViewBag.TransactionRate = tr === null || tr === undefined ? 0 : tr;
  } catch (ex) { /* swallowed in legacy */ }
  res.json({ Model: _RESELLER_SERVICES, ViewBag });
}));

// auth
router.all('/franchise/ResellerPackage/resellerPackagePurchaseRequest{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const TRPID = req.p.TRPID === undefined || req.p.TRPID === null || req.p.TRPID === '' ? 0 : parseInt(req.p.TRPID, 10);
    let outputResult = '', transactionID = '';
    const source = 'Reseller Package';
    const requestedURL = String(config.app.CompanyDomain || '');
    const successurl = `${requestedURL}/secure-payment-gateway/package-payment-success`;
    const failureurl = `${requestedURL}/secure-payment-gateway/package-payment-failed`;
    const inprocessurl = `${requestedURL}/secure-payment-gateway/package-payment-inprocess`;
    const canceledurl = `${requestedURL}/secure-payment-gateway/package-payment-cancel`;
    const DID = Number(req.user.did);
    if (DID > 0) {
      const r = await db.procOne(DB, 'USP_RESELLERPACKAGEPURCHASE_ONLINEREQUESTS', {
        DID, TRPID, SOURCE: source, SUCCESSURL: successurl, FAILUREURL: failureurl, INPROCESSURL: inprocessurl, CANCELLEDURL: canceledurl,
      });
      outputResult = String(r && r.stroutput !== null && r.stroutput !== undefined ? r.stroutput : '');
      transactionID = String(r && r.transactionid !== null && r.transactionid !== undefined ? r.transactionid : '');
      if (outputResult.toUpperCase() === 'SUCCESS' && transactionID !== '' && successurl !== '' && failureurl !== '' && inprocessurl !== '' && canceledurl !== '' && source !== '') {
        const BaseURL = String(config.app.PaymentURL || '');
        const PMID = Math.trunc(DID);
        const Url = `${BaseURL}Home?refrenceid=${await UtilityClass.Encryptword(transactionID)}&successurl=${await UtilityClass.Encryptword(successurl)}&failureurl=${await UtilityClass.Encryptword(failureurl)}&inprocessurl=${await UtilityClass.Encryptword(inprocessurl)}&canceledurl=${await UtilityClass.Encryptword(canceledurl)}&source=${await UtilityClass.Encryptword('Reseller Package')}&PMID=${await UtilityClass.Encryptword(String(PMID))}`;
        return res.json(Url);
      }
      return res.json('/page-not-found');
    }
    return res.json('/page-not-found');
  } catch (ex) {
    return res.json('/page-not-found');
  }
}));

// auth
router.all('/franchise/ResellerPackage/UtlityCommission_List{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_UTILITYCOMMISSION_LIST', { OPERATORNAME: req.p.servicename, DID: req.p.DID });
  res.json(mapRows(rows, MASTER_COMMISSION_PROPS));
}));

module.exports = router;
