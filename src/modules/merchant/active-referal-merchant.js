'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/ActiveReferalMerchant.cs (ActiveReferalMerchantController) - 1 action
 * DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'ActiveReferalMerchant';
const PROPS = ['ROWNUMBER', 'DOC', 'EMAILID', 'PHONE', 'Name', 'ADDRESS', 'PackagesName', 'Amount']; // List<ReferalMerchant>

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/z8tZG_slash_e89897_slash_RKYstyutyuf_slash_m8EkQv95zYWYRmdC1h
// auth ([SessionExpireCheck])
router.all([
  `/merchant/${C}/Index{/:id}`, `/merchant/${C}`,
  '/merchant/z8tZG_slash_e89897_slash_RKYstyutyuf_slash_m8EkQv95zYWYRmdC1h',
  '/merchant/merchant/z8tZG_slash_e89897_slash_RKYstyutyuf_slash_m8EkQv95zYWYRmdC1h',
], auth, asyncHandler(async (req, res) => {
  let { ORDERID, fromDate, toDate, page, SearchField, SearchValue } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (SearchValue == null) SearchValue = '';
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (SearchField == null) SearchField = '';
  if (ORDERID == null) ORDERID = '';
  const PLID = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_get_merchantreferal_active', {
    plid: PLID, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    view: '~/Views/ActiveReferalMerchant/Index.cshtml',
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CurrentPage: page, fromDate, toDate, SearchField, ORDERID, SearchValue, GridPageSize: MaxRows, TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
    },
  });
}));

module.exports = router;
