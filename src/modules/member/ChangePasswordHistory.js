'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\ChangePasswordHistory.cs (ChangePasswordHistoryController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/ChangePasswordHistory';
const PROPS = ['ROWNUMBER', 'UserName', 'EMAIL', 'IPAddress', 'Status', 'Date', 'Type', 'LONGITUDE', 'LATITUDE'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/_slash_g5NIkf5SdhdXPIHHReTpqk81kdLEGH9" -> ChangePasswordHistory/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/_slash_g5NIkf5SdhdXPIHHReTpqk81kdLEGH9'], auth, asyncHandler(async (req, res) => {
  let { orderbydate, SearchField, btnexel, SearchValue, fromdate, todate } = req.p;
  let ddlcustpage = toInt(req.p.ddlcustpage);
  let page = toInt(req.p.page);
  const Plid = Number(req.user.plid);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (orderbydate == null) orderbydate = '';
  if (btnexel == null) btnexel = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  try {
    const MaxRows = ddlcustpage;
    if (page == null) page = 1;
    const rows = await proc(DB, 'usp_changepasswordhistoryofmember_report', {
      regno: String(Plid), startrowindex: page, maxrows: MaxRows, fromdate, todate,
      searchfiel: SearchField.trim(), searchvalue: SearchValue.trim(), orderbydate,
    });
    // PORT-NOTE: @TOTALCOUNT OUT read from the "totalcount" column of the first row (0 when there are no rows)
    const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    // btnexel == "Export Excel": the legacy ExportReport call is commented out (no-op)
    res.json({
      Model: mapRows(rows, PROPS),
      ViewBag: {
        CurrentPage: page, GridPageSize: MaxRows, TotalRecord, orderbydate, NoPerPage: await UtilityClass.GridNumbersPerPage(),
        SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
      },
    });
  } catch (ex) {
    console.error(ex.message);
    res.json({ view: '~/Views/PageNotFound/Index.cshtml' }); // return View("~/Views/PageNotFound/Index.cshtml")
  }
}));

module.exports = router;
