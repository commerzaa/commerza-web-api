'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Right_Downline_Member_List.cs (Right_Downline_Member_ListController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: RightDownlineMemberList -> referral/7iGKqzH0WfX38zMubtbUWg==
 */
const express = require('express');
const { queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const C = 'Right_Downline_Member_List';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const toInt = (v) => { if (v === undefined || v === null) return 0; const n = parseInt(v, 10); if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
const P_RIGHT = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName',
  'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/7iGKqzH0WfX38zMubtbUWg=='], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, SearchField, SearchValue, Name, Level, ActivationStatus } = req.p;
  let page = optInt(req.p.page);
  let Side = optInt(req.p.Side);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  fromdate = nz(fromdate); todate = nz(todate); SearchField = nz(SearchField); SearchValue = nz(SearchValue); Name = nz(Name);
  if (Side === null) Side = 0;
  Level = nz(Level);
  if (ActivationStatus === undefined || ActivationStatus === null) ActivationStatus = '0';

  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
  if (row) loginid = row.username;
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount / @TotalLRBV / @TOTALLRINCOME OUT params are same-named columns of the first result row (0 when empty)
  const raw = await proc(DB, 'usp_new_member_get_member_downlinelist_side_wise', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromdate.trim(), todate: todate.trim(),
    levenumber: toInt(Level === '' ? '0' : Level), side: 2, name: '', username: '', emailid: '', sponserid: '', checkadminside: 0, activationstatus: toInt(ActivationStatus),
  });
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(raw);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.side = Side;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  ViewBag.ddlcustpage = ddlcustpage;
  const ts = await scalar(DB, 'select status from tbl_submenurole_memberpanel where sid=12 limit 1');
  const TreeStatus = ts === null ? 0 : Number(ts);
  ViewBag.TreeStatus = TreeStatus === 1 ? 1 : 0;
  res.json({ Model: mapRows(raw, P_RIGHT), ViewBag });
}));

module.exports = router;
