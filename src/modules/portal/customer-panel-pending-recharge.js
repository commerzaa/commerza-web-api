'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\Pending_Recharge.cs (class Pending_RechargeController => /portal/Pending_Recharge/...)
// Database: shopping (Db_Shopping). [DistributerSessionExpireCheck] has a commented-out body => no extra check.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB, nStr, optInt, parseInt32, outInt, masterpageshow } = require('./_shared/batch-07-common');

const router = express.Router();
const C = '/portal/Pending_Recharge';

/** class ALLCUSTOMERRECHARGELIST (Controllers/CustomerPanel/Completed_Recharge.cs) */
const ALLCUSTOMERRECHARGELIST = ['ROWNUMBER', 'ID', 'CLID', 'NAME', 'MOBILENO', 'OPERATORTYPE', 'OPERRATORNAME', 'OPERATORSERVICE', 'AMOUNT', 'STATUS',
  'TRANSACTIONID', 'RECHARGEDATE', 'ISANDROIDORWEB', 'MLMWALLET', 'CUSTOMERWALLET', 'PAYUMONEY', 'REMARKS'];

// ---------------------------------------------------------------- Index(SearchField, SearchValue, Fromdate, Todate1, int? page, RechargeType, OperatorWise, TransID)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/Pending_Recharge" -> Pending_Recharge/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/Pending_Recharge'], ps.customerAuth, asyncHandler(async (req, res) => {
  const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
  const SearchField = d('SearchField');
  const SearchValue = d('SearchValue');
  const Fromdate = d('Fromdate');
  const Todate1 = d('Todate1');
  const RechargeType = d('RechargeType');
  const OperatorWise = d('OperatorWise');
  const TransID = d('TransID');
  let page = optInt(req.p.page);
  const ViewBag = { masterpageshow: masterpageshow(req) };
  // Convert.ToInt32(AppSettings["DID"].ToString())
  const didSetting = config.app.DID;
  if (didSetting === undefined || didSetting === null) throw new TypeError('Object reference not set to an instance of an object.');
  const DID = parseInt32(didSetting);
  const MaxRows = UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const Clid = req.user.plid;
  const status = '0';
  const rows = await db.proc(DB, 'usp_get_customer_allrecharge_reports', {
    MODE: 1, STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: Fromdate.trim(), TODATE: Todate1.trim(), SEARCHFIELD: SearchField.trim(),
    SEARCHVALUE: SearchValue.trim(), STATUS: status, CLID: Clid, DID, RECHARGETYPE: RechargeType, OPERATORWISE: OperatorWise, TRANSID: TransID,
  });
  const _ALLCUSTOMERRECHARGELIST = mapRows(rows, ALLCUSTOMERRECHARGELIST);
  const TotalRecord = outInt(rows, 'totalcount');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = Fromdate;
  ViewBag.toDate = Todate1;
  res.json({ view: '~/Views/CustomerPanel/Pending_Recharge/Index.cshtml', Model: _ALLCUSTOMERRECHARGELIST, ...ViewBag });
}));

module.exports = router;
