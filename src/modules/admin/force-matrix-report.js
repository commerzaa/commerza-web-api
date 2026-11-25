'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ForceMatrixReport.cs (class ForceMatrixReportController => /admin/ForceMatrixReport/...)
// Database: affiliate (Db_Affiliate). No RouteConfig entry.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ForceMatrixReport';

/** class LevelDownLine (defined in ForceMatrixReport.cs) */
const LEVEL_DOWNLINE_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status',
  'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName',
  'root_userName', 'LCount', 'RCount', 'SideName'];

// ---------------------------------------------------------------- Index(string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus, int? LEVENUMBERto)
// auth
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let Username = B.nStr(req.p.Username);
  let EmailID = B.nStr(req.p.EmailID);
  let SponserID = B.nStr(req.p.SponserID);
  let page = B.nInt(req.p.page);
  let Name = B.nStr(req.p.Name);
  let Side = B.nInt(req.p.Side);
  let Level = B.nStr(req.p.Level);
  let ActivationStatus = B.nStr(req.p.ActivationStatus);
  let LEVENUMBERto = B.nInt(req.p.LEVENUMBERto);
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  if (EmailID === null) EmailID = '';
  if (LEVENUMBERto === null) LEVENUMBERto = 0;
  if (SponserID === null) SponserID = '';
  if (Name === null) Name = '';
  if (Side === null) Side = 0;
  if (Level === null) Level = '';
  if (ActivationStatus === null) ActivationStatus = '0';
  // select USERNAME from MEMBER_MASTER with(nolock) where PLID=1  (FirstOrDefault => null when none)
  // PORT-NOTE: MEMBER_MASTER has no PLID column in the Db_Affiliate schema dump (REGNO is the key); the query is kept as written, so it
  // fails (500) exactly like the legacy page would against that schema.
  const r = await db.queryOne(DB, 'select username from member_master where plid = 1 limit 1', {});
  const loginid = r ? B.col(r, 'username') : null;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: the legacy EF text passed the values POSITIONALLY ("@LoginID,...,@ToDate,@LEVENUMBERfrom,@side,@TotalCount out,...");
  // against the current USP_LEVELDOWNLINE signature (@level before @LEVENUMBERfrom, @LEVENUMBERto before @SIDE) the positions do
  // not line up. The values are bound here by their intended names.
  const rows = await db.proc(DB, 'USP_LEVELDOWNLINE', {
    LOGINID: loginid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: fromdate.trim(), TODATE: todate.trim(),
    LEVENUMBERfrom: B.cvtInt(Level === '' ? '0' : Level), SIDE: Side, NAME: Name.trim(), USERNAME: Username.trim(), EMAILID: EmailID.trim(),
    SPONSERID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: B.cvtInt(ActivationStatus), LEVENUMBERto,
  });
  const LRMember = mapRows(rows, LEVEL_DOWNLINE_PROPS);
  const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0; // int.Parse(@TotalCount OUT)
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.Name = Name;
  ViewBag.Username = Username;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  return res.json({ view: '~/Views/AdminPanel/ForceMatrixReport/Index.cshtml', Model: LRMember, ...ViewBag });
}));

module.exports = router;
