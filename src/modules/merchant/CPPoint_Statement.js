'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/CPPoint_Statement.cs (CPPoint_StatementController) - 1 action: Index
 * DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'CPPoint_Statement';
const PROPS = ['ROWNUMBER', 'TFHID', 'REGNO', 'TYPE', 'AMOUNT', 'DATE', 'REMARK', 'USERNAME', 'EMAILID', 'MOBILE', 'MESSAGE', 'NAME'];

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/cp-point-statement
// auth ([SessionExpireCheck])
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/cp-point-statement', '/merchant/merchant/cp-point-statement'], auth, asyncHandler(async (req, res) => {
  let { fromDate, toDate, page } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const BranchId = Number(req.user.plid);
  const r = await queryOne(DB, 'SELECT coalesce(credited_fund,0.00) AS "TOTAL", coalesce(debited_fund,0.00) AS "USED", coalesce(available_fund,0.00) AS "AVAILABLE" FROM portal_master WHERE plid=@plid LIMIT 1', { plid: BranchId });
  const objcp = r ? { TOTAL: r.TOTAL, USED: r.USED, AVAILABLE: r.AVAILABLE } : null;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_merchant_fund_request', {
    mode: 3, regno: BranchId, type: '', amount: '0', remark: '', paymentmode: '0', paymentmodename: '', challanimage: '', bankname: '',
    branchname: '', referencenumber: '', referencedate: '', fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
    ifsccode: '', transactionid: '', bankid: 0, cppoint: '0',
  });
  // PORT-NOTE: @TotalCount / @TOTALCPPOINT OUT are read from the "totalcount" / "totalcppoint" columns of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  const TotalCPPoint = rows.length ? Number(rows[0].totalcppoint || 0) : 0;
  res.json({
    view: '~/Views/CPPoint_Statement/Index.cshtml',
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CPDetails: objcp, BranchId, CurrentPage: page, TotalCPPoint, GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate, toDate,
    },
  });
}));

module.exports = router;
