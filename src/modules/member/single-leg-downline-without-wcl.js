'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Single_Leg_Downline_WithoutWCL.cs (Single_Leg_Downline_WithoutWCLController) */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Single_Leg_Downline_WithoutWCL';
const PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV',
  'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount',
  'SideName', 'TITLE'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/8FTN_plus_WYOT_slashSingle_Downlinewcl_Udq91TGJMNm_slash_fzMy5u1tRa" -> Single_Leg_Downline_WithoutWCL/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/8FTN_plus_WYOT_slashSingle_Downlinewcl_Udq91TGJMNm_slash_fzMy5u1tRa'], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, SearchValue, SearchField, Username, SponserID, Name, Level, ActivationStatus } = req.p;
  let page = toInt(req.p.page);
  let Side = toInt(req.p.Side);
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (SearchValue == null) SearchValue = '';
  if (SearchField == null) SearchField = '';
  if (SponserID == null) SponserID = '';
  if (Name == null) Name = '';
  if (Level == null) Level = '';
  if (ActivationStatus == null) ActivationStatus = '0';
  if (Side == null) Side = 0;
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select username from member_master where regno = @plid limit 1', { plid: Plid });
  if (row) loginid = row.username;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  // The legacy EXEC passes its arguments positionally: the 8th slot (@levenumber) is the procedure's @LEVENUMBERfrom
  const rows = await proc(DB, 'usp_singlelegdownline', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: fromdate.trim(), todate: todate.trim(), levenumberfrom: parseInt(Level === '' ? '0' : Level, 10), side: Side,
    name: Name.trim(), username: '', emailid: '', sponserid: SponserID.trim(), checkadminside: 0,
    activationstatus: parseInt(ActivationStatus, 10),
  });
  // PORT-NOTE: @TotalCount OUT (and @TotalLRBV / @TOTALLRINCOME, unused) read from the first result row (0 when there are no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate: fromdate, toDate: todate, Name, Username: Username === undefined ? null : Username, side: Side, SponserID, Level, ActivationStatus,
    },
  });
}));

module.exports = router;
