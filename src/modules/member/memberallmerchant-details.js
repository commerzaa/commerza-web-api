'use strict';
// Port of Member\Common\Controllers\CustomerPanel\MemberallmerchantDetails.cs (MemberallmerchantDetailsController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const errorInsert = async (e, procName, req) => {
  try { await new DataUtility().ErrorInsert(0, e && e.message, procName, 0, req.path); } catch (_) { /* ignore */ }
};
const orEmpty = (v) => (v === undefined || v === null ? '' : String(v));
const Props = ['ROWNUMBER', 'TOTALAMOUNT', 'PER', 'CPOINT', 'AMOUNT', 'ORDERNO', 'DATE', 'REMARKS', 'MID', 'MERCHANTNAME', 'ADDRESS', 'MERCHANTMOBILE', 'USERNAME', 'NAME'];

// route-config: referral/all-self-merchant-details -> MemberallmerchantDetails/Index
// auth
router.all(['/member/MemberallmerchantDetails/Index{/:id}', '/member/referral/all-self-merchant-details'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ViewBag = { mobile: req.user.mobile };
  const ddlcustpage = p.ddlcustpage === undefined || p.ddlcustpage === '' ? 100 : parseInt(p.ddlcustpage, 10);
  const SearchField = orEmpty(p.SearchField);
  const SearchValue = orEmpty(p.SearchValue);
  const fromDate = orEmpty(p.fromDate);
  const toDate = orEmpty(p.toDate);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === '' ? 1 : parseInt(p.page, 10);
  let AllFreeEpinList = [];
  try {
    const Plid = Number(req.user.plid);
    const rows = await db.proc(DB, 'sp_usermertant_details', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
      fromdate: fromDate.trim(), todate: toDate.trim(),
    });
    AllFreeEpinList = mapRows(rows, Props);
    const tc = outv(rows, 'totalcount');
    if (tc === null) throw new TypeError('Object reference not set to an instance of an object.');
    const TotalRecord = parseInt(String(tc), 10);
    if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(ExpObj, 'insert_email_newsletter', req);
  }
  res.json({ Model: AllFreeEpinList, ...ViewBag });
}));

module.exports = router;
