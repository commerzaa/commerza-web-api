'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Auto_Matrix_Downline.cs (Auto_Matrix_DownlineController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: AutoMatrixDownline -> referral/8wy1UOO1qRgOtZVYXOY86Z_slash_breOzCiwZ (id optional)
 */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const C = 'Auto_Matrix_Downline';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const toInt = (v) => { if (v === undefined || v === null) return 0; const n = parseInt(v, 10); if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
const P_FORCE = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName',
  'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName', 'TITLE'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/8wy1UOO1qRgOtZVYXOY86Z_slash_breOzCiwZ{/:id}'], auth, asyncHandler(async (req, res) => {
  let { fromdate, SearchValue, SearchField, todate, Username, SponserID, Name, Level, ActivationStatus } = req.p;
  let page = optInt(req.p.page);
  let Side = optInt(req.p.Side);
  fromdate = nz(fromdate); todate = nz(todate); SearchValue = nz(SearchValue); SearchField = nz(SearchField); SponserID = nz(SponserID); Name = nz(Name); Level = nz(Level);
  if (ActivationStatus === undefined || ActivationStatus === null) ActivationStatus = '0';
  if (Side === null) Side = 0;
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
  if (row) loginid = row.username;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount / @TotalLRBV / @TOTALLRINCOME OUT params are same-named columns of the first result row (0 when empty)
  const raw = await proc(DB, 'usp_forcematrics', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromdate.trim(), todate: todate.trim(),
    levenumber: toInt(Level === '' ? '0' : Level), side: Side, name: Name.trim(), username: '', emailid: '', sponserid: SponserID.trim(), checkadminside: 0,
    activationstatus: toInt(ActivationStatus),
  });
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(raw);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.Name = Name;
  ViewBag.Username = Username;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  res.json({ Model: mapRows(raw, P_FORCE), ViewBag });
}));

module.exports = router;
