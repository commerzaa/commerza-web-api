'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Branch_Ladger.cs (Branch_LadgerController, 1 action). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, csErr, mvcStr, mvcIntN, outOf, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'Branch_Ladger';

/** Controllers/CustomerPanel/Order_List.cs class AllOrderDetails (LiOrderNotes / LiOrderProduct are never filled here => null) */
const ALL_ORDER_DETAILS_PROPS = ['Address', 'BrCode', 'City', 'CustName', 'Description', 'EmailID', 'IntStatus', 'LiOrderNotes', 'LiOrderProduct',
  'LoginId', 'MobileNo', 'Name', 'order_BV', 'order_DAP', 'order_netAmt', 'order_qty', 'orderDate', 'orderID', 'PayMode', 'PayRemark', 'PayTransID',
  'PinCode', 'SH_Address', 'SH_City', 'SH_EmailID', 'SH_MobileNo', 'SH_Name', 'SH_PinCode', 'status', 'total_Ship_Ch', 'total_vat'];

const orEmpty = (v) => (v === null || v === undefined ? '' : String(v)); // Extension.ToStringOrEmpty
const at = (arr, i) => { if (i >= arr.length) throw csErr('IndexOutOfRangeException', 'Index was outside the bounds of the array.'); return arr[i]; };

// ---------------------------------------------------------------- [SessionExpireCheck] Index(string BLID, string LType, string fromDate, string toDate, string TransType, int? page)
// auth ([SessionExpireCheck])
// route-config: merchant/transactions -> Branch_Ladger/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/merchant/transactions'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let BLID = mvcStr(req, 'BLID');
  if (BLID === null) BLID = '0'; // eslint-disable-line no-unused-vars
  const LType = orEmpty(mvcStr(req, 'LType')); // eslint-disable-line no-unused-vars
  let fromDate = orEmpty(mvcStr(req, 'fromDate'));
  let toDate = orEmpty(mvcStr(req, 'toDate'));
  const TransType = orEmpty(mvcStr(req, 'TransType'));
  let page = mvcIntN(req, 'page');

  if (fromDate.trim() !== '') {
    const dates = fromDate.split('-');
    fromDate = orEmpty(at(dates, 2)) + '/' + orEmpty(at(dates, 1)) + '/' + orEmpty(at(dates, 0));
  }
  if (toDate.trim() !== '') {
    const dates = toDate.split('-');
    toDate = orEmpty(at(dates, 2)) + '/' + orEmpty(at(dates, 1)) + '/' + orEmpty(at(dates, 0));
  }
  if (page === null) page = 1;

  const BranchId = toInt32(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  // [DBO].[IMS_USP_GETORDERLIST] @STARTROWINDEX,@MAXROWS,@BRANCHID,@FROMDATE,@TODATE,@TOTALCOUNT OUT
  const rows = await db.proc(DB, 'ims_usp_getorderlist', {
    startrowindex: page, maxrows: MaxRows, branchid: toInt32(BranchId), fromdate: fromDate, todate: toDate,
  });
  // PORT-NOTE: @TotalCount OUT is read from the first result row (0 when the function returns no row).
  const t = outOf(rows, 'totalcount');
  const TotalRecord = t === undefined ? 0 : toInt32(t === null ? '' : String(t));
  return res.json({
    view: '~/Views/CustomerPanel/Branch_Ladger/Index.cshtml',
    Model: mapRows(rows, ALL_ORDER_DETAILS_PROPS),
    CurrentPage: page,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    TotalRecord,
    TransType,
    fromDate,
    GridPageSize: MaxRows,
    toDate,
  });
}));

module.exports = router;
