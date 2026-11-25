'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Force_Matrics_List.cs  (Force_Matrics_ListController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc, queryOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/Force_Matrics_List';
const PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV',
  'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName', 'TITLE'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
// Convert.ToInt32(string): FormatException on non-numeric input
const convInt = (v) => { const n = Number(String(v).trim()); if (String(v).trim() === '' || !Number.isInteger(n)) throw new Error('Input string was not in a correct format.'); return n; };

// Index(string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus)
// route-config: referral/8FTN_plus_WYOT_slash_V9MJ4YfsNKikOdh_slash_q0p9Ts
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/8FTN_plus_WYOT_slash_V9MJ4YfsNKikOdh_slash_q0p9Ts'], auth, asyncHandler(async (req, res) => {
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const Username = nn(req.p.Username);
  const EmailID = nn(req.p.EmailID);
  const SponserID = nn(req.p.SponserID);
  const Name = nn(req.p.Name);
  let Side = toInt(req.p.Side);
  if (Side === null) Side = 0;
  const Level = nn(req.p.Level);
  const ActivationStatus = req.p.ActivationStatus === undefined || req.p.ActivationStatus === null ? '0' : String(req.p.ActivationStatus);
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select username from member_master where regno = @plid limit 1', { plid: Plid });
  if (row) loginid = row.username;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = toInt(req.p.page);
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount / @TotalLRBV / @TOTALLRINCOME OUT are read from the first result row (TotalCount 0 when no rows)
  const rows = await proc(DB, 'usp_forcematrics', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: fromdate.trim(), todate: todate.trim(),
    levenumber: convInt(Level === '' ? '0' : Level), side: Side, name: Name.trim(), username: Username.trim(), emailid: EmailID.trim(),
    sponserid: SponserID.trim(), checkadminside: 0, activationstatus: convInt(ActivationStatus),
  });
  const ForceMatricsList = mapRows(rows, PROPS);
  const tr = parseInt(outv(rows[0], 'totalcount'), 10);
  const TotalRecord = Number.isNaN(tr) ? 0 : tr;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate: fromdate, toDate: todate,
    Name, Username, side: Side, SponserID, Level, ActivationStatus,
  };
  res.json({ view: '~/Views/CustomerPanel/Force_Matrics_List/Index.cshtml', Model: ForceMatricsList, ViewBag });
}));

module.exports = router;
