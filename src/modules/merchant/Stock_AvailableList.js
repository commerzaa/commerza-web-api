'use strict';
/** Ported from Shoping Portal Merchant Panel\Controllers\CustomerPanel\Stock_AvailableList.cs (Stock_AvailableListController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const P = '/merchant/Stock_AvailableList';
const nz = (v, d) => (v === undefined || v === null ? d : v);

// auth ([SessionExpireCheck]) // route-config: merchant/Stock-AvailableList
router.all([`${P}/Index{/:id}`, '/merchant/merchant/Stock-AvailableList'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const fromDate = nz(p.fromDate, '');
  const toDate = nz(p.toDate, '');
  const SearchField = nz(p.SearchField, '');
  const SearchValue = nz(p.SearchValue, '');
  const MPRIDs = 0;
  const Plid = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await proc('shopping', 'USP_GET_STOCK_IN_STORE_LIST', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, searchfiel: SearchField, searchvalue: SearchValue, branchid: Plid,
  });
  const AvailableStockList = mapRows(rows, ['ROWNUMBER', 'SPRID', 'CATEGORYNAME', 'PRODUCTNAME', 'GST', 'STOCKIN', 'STOCKOUT', 'STOCKNET', 'SELLMRP', 'DAP',
    'Discountpercentage', 'Subcategory']);
  const n = parseInt(((rows && rows[0]) || {}).totalcount, 10);
  res.json({
    Model: AvailableStockList,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord: Number.isNaN(n) ? 0 : n,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    MPRID: MPRIDs,
  });
}));

module.exports = router;
