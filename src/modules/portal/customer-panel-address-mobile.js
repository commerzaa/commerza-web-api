'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\Address_Mobile.cs (class Address_MobileController => /portal/Address_Mobile/...)
// Database: shopping (Db_Shopping). (No RouteConfig entry: "customer/Address-Mobile" maps to AddressController.)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view, outv, s, toInt64 } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/Address_Mobile';

/** class Addres */
const ADDRES = ['PINCODE', 'COUNTRYNAME', 'PHONENO1', 'ShortAddress', 'LandMark', 'VillageName', 'CityName', 'StateName', 'DistrictName', 'PhoneNo2',
  'USERNAME', 'CNAME', 'id', 'CountryId', 'ADDRESSTYPE1'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${C}/Index{/:id}`, C], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const PLID = toInt64(req.user.plid);
  const rows = await db.proc(DB, 'USP_GETCUSTOMER_ADDRESS', { PLID });
  const address = mapRows(rows, ADDRES);
  ViewBag.status = s(outv(rows, 'MESSAGE')); // spOutput.Value.ToString() (@MESSAGE OUT)
  return view(res, '~/Views/UserPanel/Member_Profile/Address_Mobile.cshtml', address, ViewBag);
}));

module.exports = router;
