'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Bv_Report.cs (Bv_ReportController, 1 action). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, mvcIntN, nullRef, outOf, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'Bv_Report';

/** class Bv_ReportList */
const BV_REPORT_PROPS = ['ROWNUMBER', 'CUSTOMERNAME', 'ORDERID', 'ORDER_NETAMT', 'ORDERDATE', 'ORDER_BV', 'RESELLERNAME', 'Relased', 'ISDistributed'];

/** int.Parse(<output SqlParameter>.Value.ToString()). Decimal outputs declared without Scale come back with scale 0 (fraction dropped). */
function outInt(rows, name, isDecimal) {
  const v = outOf(rows, name);
  if (v === undefined) return 0; // PORT-NOTE: no result row => 0
  if (v === null) return toInt32(''); // DBNull.ToString() = "" => FormatException
  const n = Number(v);
  return isDecimal ? Math.trunc(n) : toInt32(String(v));
}

// ---------------------------------------------------------------- [DistributerSessionExpireCheck] Index(int? page, string fromDate, string toDate, string SearchField, string Orderid, string Status)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: customer/Bv-Report -> Bv_Report/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/customer/Bv-Report'], ps.customerAuth, asyncHandler(async (req, res) => {
  let page = mvcIntN(req, 'page');
  let fromDate = mvcStr(req, 'fromDate');
  let toDate = mvcStr(req, 'toDate');
  let SearchField = mvcStr(req, 'SearchField');
  let Orderid = mvcStr(req, 'Orderid');
  let Status = mvcStr(req, 'Status');
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (SearchField === null) SearchField = 'Orderid';
  if (Status === null) Status = '';
  if (Orderid === null) Orderid = '';
  const ViewBag = {};
  ViewBag.masterpageshow = ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';

  // int DID = Convert.ToInt32(ConfigurationManager.AppSettings["DID"].ToString());  (unused; throws when the key is missing)
  if (config.app.DID === undefined || config.app.DID === null) nullRef();
  toInt32(String(config.app.DID));

  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const Clid = req.user.plid;
  const mode = 0;
  // DBO.USP_GET_CUSTOMERBVDETAILS @MODE,@STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@TOTALCOUNT out,@SEARCHFIELD,@SEARCHVALUE,@STATUS,@CLID
  const rows = await db.proc(DB, 'usp_get_customerbvdetails', {
    mode, startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, searchfield: SearchField, searchvalue: Orderid.trim(),
    status: Status, clid: Clid,
  });
  // PORT-NOTE: @TOTALCOUNT OUT is read from the first result row.
  const TotalRecord = outInt(rows, 'totalcount', false);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = Orderid;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;

  // DBO.USP_GET_CUSTOMERTOTALBV @CLID,@TOTALBV out,@RELEASEDBV out  (SqlQuery<Int32>(...).FirstOrDefault() result unused)
  const bv = await db.proc(DB, 'usp_get_customertotalbv', { clid: Clid });
  ViewBag.TotalBV = outInt(bv, 'totalbv', true);
  ViewBag.ReleasedBV = outInt(bv, 'releasedbv', true);

  return res.json({ view: '~/Views/CustomerPanel/Bv_Report/Index.cshtml', Model: mapRows(rows, BV_REPORT_PROPS), ...ViewBag });
}));

module.exports = router;
