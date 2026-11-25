'use strict';
// Ported from Member/Controllers/CustomerPanel/All_UplineMember_List.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc, scalar, queryOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const AllUplineMemberLeftRight = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName', 'TITLE', 'PackageAmt'];

// auth (legacy: Session["Plid"] == null -> redirect Home/Index). route-config: url "referral/1MzS0XX72VdVJs0U8RDMb322gzjSa1zi"
router.all(['/member/All_UplineMember_List/Index{/:id}', '/member/All_UplineMember_List', '/member/referral/1MzS0XX72VdVJs0U8RDMb322gzjSa1zi'], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, SearchField, SearchValue, page, Name, Side, Level, ActivationStatus } = req.p;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (Name == null) Name = '';
  if (Side == null || Side === '') Side = 0; else Side = Number(Side);
  if (Level == null) Level = '';
  if (ActivationStatus == null) ActivationStatus = '0';
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select username from member_master where regno = @Plid limit 1', { Plid });
  if (row) loginid = row.username;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1; else page = Number(page);
  const rows = await proc(DB, 'usp_new_member_get_member_upline_side_wise', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: String(fromdate).trim(), todate: String(todate).trim(),
    levenumber: parseInt(Level === '' ? '0' : Level, 10), side: Side,
    name: '', username: '', emailid: '', sponserid: '', checkadminside: 0, activationstatus: parseInt(ActivationStatus, 10),
  });
  // PORT-NOTE: @TotalCount/@TotalLRBV/@TOTALLRINCOME OUT read from the first result row (0 if none)
  const TotalRecord = rows.length ? Math.trunc(Number(rows[0].totalcount || 0)) : 0;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate, toDate: todate, side: Side, SearchField, SearchValue, Level, ActivationStatus,
  };
  const TreeStatus = Number(await scalar(DB, 'select status from TBL_SUBMENUROLE_MEMBERPANEL where sid=12 limit 1')) || 0;
  ViewBag.TreeStatus = TreeStatus === 1 ? 1 : 0;
  res.json({ View: '~/Views/CustomerPanel/All_UplineMember_List/Index.cshtml', Model: mapRows(rows, AllUplineMemberLeftRight), ViewBag });
}));

module.exports = router;
