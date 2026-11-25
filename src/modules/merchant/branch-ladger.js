'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\CustomerPanel\Branch_Ladger.cs (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('merchant')];
// model AllOrderDetails is defined elsewhere in the app; column names returned as the procedure gives them
const AOD = ['Address', 'BrCode', 'City', 'CustName', 'Description', 'EmailID', 'IntStatus', 'LiOrderNotes', 'LiOrderProduct', 'LoginId', 'MobileNo', 'Name', 'order_BV', 'order_DAP', 'order_netAmt', 'order_qty', 'orderDate', 'orderID', 'PayMode', 'PayRemark', 'PayTransID', 'PinCode', 'SH_Address', 'SH_City', 'SH_EmailID', 'SH_MobileNo', 'SH_Name', 'SH_PinCode', 'status', 'total_Ship_Ch', 'total_vat'];
const toStr = (v) => (v === undefined || v === null ? '' : String(v)); // ToStringOrEmpty
const reformat = (d) => {
  if (d.trim() === '') return d;
  const dates = d.split('-');
  if (dates.length < 3) throw new RangeError('Index was outside the bounds of the array.');
  return toStr(dates[2]) + '/' + toStr(dates[1]) + '/' + toStr(dates[0]);
};

// auth
// route-config: merchant/transactions
router.all(['/merchant/Branch_Ladger/Index{/:id}', '/merchant/merchant/transactions'], ...guard, asyncHandler(async (req, res) => {
  let { BLID, TransType, page } = req.p;
  if (BLID == null) BLID = '0';
  let fromDate = toStr(req.p.fromDate);
  let toDate = toStr(req.p.toDate);
  TransType = toStr(TransType);
  fromDate = reformat(fromDate);
  toDate = reformat(toDate);
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const BranchId = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc('shopping', 'ims_usp_getorderlist', {
    STARTROWINDEX: page, MAXROWS: MaxRows, BRANCHID: BranchId, FROMDATE: fromDate, TODATE: toDate,
  });
  // PORT-NOTE: @TOTALCOUNT OUT read from the 'totalcount' column of the first row
  const TotalRecord = rows.length && rows[0].totalcount != null ? parseInt(rows[0].totalcount, 10) : 0;
  res.json({
    Model: mapRows(rows, AOD), CurrentPage: page, NoPerPage: await UtilityClass.GridNumbersPerPage(), TotalRecord,
    TransType, fromDate, GridPageSize: MaxRows, toDate,
  });
}));

module.exports = router;
