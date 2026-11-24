'use strict';
// Ported from Member\Controllers\CustomerPanel\Force_Matrics_Downline_WithoutWCL.cs (Force_Matrics_Downline_WithoutWCLController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Force_Matrics_Downline_WithoutWCL';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
// PORT-NOTE: OUT parameters (@TotalCount, @TotalLRBV, @TOTALLRINCOME) are read from columns of the first result row (0 when absent / NULL)
const numOut = (rows, name) => { const v = outv(rows, name); return v === undefined || v === null || v === '' ? 0 : Number(v); };
// ForceMatricsList (Force_Matrics_List.cs)
const PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName', 'TITLE'];

// route-config: referral/8FTN_plus_WYOT_slash_downline_wclUdq91TGJMNm_slash_fzMy5u1tRa
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/8FTN_plus_WYOT_slash_downline_wclUdq91TGJMNm_slash_fzMy5u1tRa'], ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  let { fromdate, SearchValue, SearchField, todate, Username, SponserID, Name, Level, ActivationStatus } = p;
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  let Side = p.Side === undefined || p.Side === null || p.Side === '' ? null : parseInt(p.Side, 10);
  if (fromdate === undefined || fromdate === null) fromdate = '';
  if (todate === undefined || todate === null) todate = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SponserID === undefined || SponserID === null) SponserID = '';
  if (Name === undefined || Name === null) Name = '';
  if (Level === undefined || Level === null) Level = '';
  if (ActivationStatus === undefined || ActivationStatus === null) ActivationStatus = '0';
  if (Side === null) Side = 0;
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await db.queryOne(DB, 'select username from member_master where regno = @r limit 1', { r: Plid });
  if (row) loginid = row.username;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const lv = parseInt(Level === '' ? '0' : Level, 10);
  const act = parseInt(ActivationStatus, 10);
  if (Number.isNaN(lv) || Number.isNaN(act)) throw new TypeError('Input string was not in a correct format.');
  const rows = await db.proc(DB, 'usp_forcematrixdownline', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(), levenumber: lv, side: Side,
    Name: Name.trim(), Username: '', EmailID: '', SponserID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: act,
  });
  const TotalRecord = numOut(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate,
    toDate: todate,
    Name,
    Username: Username === undefined ? null : Username,
    side: Side,
    SponserID,
    Level,
    ActivationStatus,
  };
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
}));

module.exports = router;
