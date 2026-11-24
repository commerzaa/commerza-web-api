'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/ReferalMerchant.cs (ReferalMerchantController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'ReferalMerchant';

const PROPS = ['ROWNUMBER', 'DOC', 'EMAILID', 'PHONE', 'Name', 'ADDRESS', 'PackagesName', 'Amount'];
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);

// auth ([SessionExpireCheck])
const indexHandler = asyncHandler(async (req, res) => {
  let { ORDERID, fromDate, toDate, page, SearchField, SearchValue } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchValue == null) SearchValue = '';
  if (page == null || page === '') page = 1; else page = parseInt(page, 10);
  if (Number.isNaN(page)) throw new Error('The parameters dictionary contains an invalid entry for parameter \'page\'.');
  if (SearchField == null) SearchField = '';
  if (ORDERID == null) ORDERID = '';
  const PLID = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_get_merchantreferal', {
    plid: PLID, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  const ViewBag = {
    CurrentPage: page, fromDate, toDate, SearchField, ORDERID, SearchValue, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  res.json({ view: '~/Views/ReferalMerchant/Index.cshtml', Model: mapRows(rows, PROPS), ViewBag });
});

// auth
// route-config: merchant/z8tZG_slash_e89897_slash_RKYsf_slash_m8EkQv95zYWYRmdC1h
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/z8tZG_slash_e89897_slash_RKYsf_slash_m8EkQv95zYWYRmdC1h'], auth, indexHandler);

module.exports = router;
