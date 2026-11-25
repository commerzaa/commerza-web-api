'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\Address.cs (class AddressController => /portal/Address/...)
// Database: shopping (Db_Shopping).
// [DistributerSessionExpireCheck]: body commented out in legacy => no extra check.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view, masterpageshow, outv, s, toInt64 } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/Address';

/** class Addres */
const ADDRES = ['PINCODE', 'COUNTRYNAME', 'PHONENO1', 'ShortAddress', 'LandMark', 'VillageName', 'CityName', 'StateName', 'DistrictName', 'PhoneNo2',
  'USERNAME', 'CNAME', 'id', 'CountryId', 'ADDRESSTYPE1'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/Address" and "customer/Address-Mobile" -> Address/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/Address', '/portal/customer/Address-Mobile'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.masterpageshow = masterpageshow(req);
  const PLID = toInt64(req.user.plid);
  const rows = await db.proc(DB, 'USP_GETCUSTOMER_ADDRESS', { PLID });
  const address = mapRows(rows, ADDRES);
  // spOutput.Value.ToString() (@MESSAGE OUT). PORT-NOTE: read from the result row; with no row it is "" (legacy DBNull.ToString()).
  ViewBag.status = s(outv(rows, 'MESSAGE'));
  return view(res, '~/Views/UserPanel/Member_Profile/Address.cshtml', address, ViewBag);
}));

module.exports = router;
