'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Utilities_Commission_Structure.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const P = '/franchise/Utilities_Commission_Structure';

const MASTER_COMMISSION = ['ROWNUMBER', 'TVRCSID', 'OPERATORNAME', 'OPERATORCODE', 'SERVICENAME', 'BILLTYPE', 'COMMISSION', 'SURCHARGE', 'STATUS', 'CREATEDATE', 'ACTIVE', 'PACKAGE1COMMISSION', 'PACKAGE2COMMISSION', 'PACKAGE3COMMISSION', 'PACKAGE4COMMISSION', 'ADMINSURCHARGE', 'DID', 'VENDORNAME', 'TVID'];
const PRODUCT_COMMISSION = ['ROWNUMBER', 'TPPCID', 'MAINCATNAME', 'CATNAME', 'SUBCATNAME', 'ACTUALCOMMPACKAGE1', 'ACTUALCOMMPACKAGE2', 'ACTUALCOMMPACKAGE3', 'ACTUALCOMMPACKAGE4'];
const RESELLERPACKAGES = ['TRPID', 'SERVICENAME', 'PACKAGENAME', 'PACKAGEAMOUNT', 'PACKAGEFEATURES', 'ACTIVE', 'BUYSTATUS', 'ISTRIAL'];
const SERVICE_TYPE = ['STID', 'ServiceType'];

async function Index(req, res) {
  const DID = parseInt(req.user.did, 10);
  res.json({ DID });
}
// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/Utilities-Commission-Structure
router.all('/franchise/franchisee/Utilities-Commission-Structure{/:id}', auth, asyncHandler(Index));

// PORT-NOTE: the four helpers below are public instance methods (MVC treats them as actions; the legacy response would be
// List.ToString()); they return the lists as JSON here.
// auth
router.all(P + '/UtlityCommission_List{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc('shopping', 'usp_utilitycommission_list', { stid: parseInt(req.p.stid, 10), did: req.p.DID });
  res.json(mapRows(rows, MASTER_COMMISSION));
}));
// auth
router.all(P + '/ProductCommission_List{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc('shopping', 'usp_productcommission_list', {});
  res.json(mapRows(rows, PRODUCT_COMMISSION));
}));
// auth
router.all(P + '/ReselerPackage{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc('shopping', 'get_resellerallpackages', { trsid: parseInt(req.p.Trsid, 10), did: req.p.Did });
  res.json(mapRows(rows, RESELLERPACKAGES));
}));
// auth
router.all(P + '/UtilityService_type{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc('shopping', 'usp_getservicetype', { trsid: parseInt(req.p.Trsid, 10) });
  res.json(mapRows(rows, SERVICE_TYPE));
}));

module.exports = router;
