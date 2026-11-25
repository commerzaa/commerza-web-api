'use strict';
// Ported from ClusterofferShopingPortal\Controllers\AllDownlineMemberList.cs (class All_Downline_Member_ListController => /portal/All_Downline_Member_List/...)
// Database: shopping (Db_Shopping; portal DataBaseContext). Proc: USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE. Table: Member_master.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, cvtInt32 } = require('./_shared/batch-01-common');

const router = express.Router();

/** class AllDownlineMemberLeftRight */
const PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName',
  'LCount', 'RCount', 'SideName'];

const nIntOrNull = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const t = String(v).trim();
  return /^[+-]?\d+$/.test(t) ? Number(t) : null; // int? binding: unparsable => null (model state error)
};

// ---------------------------------------------------------------- Index(string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/All-Downline-Member-List" -> All_Downline_Member_List/Index
router.all(['/portal/All_Downline_Member_List/Index{/:id}', '/portal/referral/All-Downline-Member-List'], ps.customerAuth,
  asyncHandler(async (req, res) => {
    const str = (k) => (req.p[k] === undefined || req.p[k] === null ? '' : String(req.p[k]));
    const fromdate = str('fromdate');
    const todate = str('todate');
    const Username = str('Username');
    const EmailID = str('EmailID');
    const SponserID = str('SponserID');
    const Name = str('Name');
    let Side = nIntOrNull(req.p.Side);
    if (Side === null) Side = 0;
    const Level = str('Level');
    let page = nIntOrNull(req.p.page);

    const Plid = Number(req.user.plid);
    let loginid = '';
    // db._Member_Master.Where(a => a.PLID == Plid).FirstOrDefault()
    const row = await db.queryOne(DB, 'select username from member_master where plid = @plid limit 1', { plid: Plid });
    if (row !== null && row !== undefined) loginid = row.username;
    const MaxRows = 50;
    if (page === null) page = 1;

    const rows = await db.proc(DB, 'usp_new_member_get_member_downlinelist_side_wise', {
      loginid,
      startrowindex: page,
      maxrows: MaxRows,
      searchfield: '',
      searchvalue: '',
      fromdate: fromdate.trim(),
      todate: todate.trim(),
      levenumber: cvtInt32(Level === '' ? '0' : Level),
      side: Side,
      name: Name.trim(),
      username: Username.trim(),
      emailid: EmailID.trim(),
      sponserid: SponserID.trim(),
      checkadminside: 0,
    });
    const LRMember = mapRows(rows, PROPS);
    // int.Parse(spOutputL.Value.ToString()) - OUT @TotalCount is repeated as a column of every row.
    // PORT-NOTE: with no rows PostgreSQL cannot return the OUT value => 0 (legacy got the proc's value).
    let TotalRecord = 0;
    if (rows.length) {
      const k = Object.keys(rows[0]).find((x) => x.toLowerCase() === 'totalcount');
      const v = k === undefined ? null : rows[0][k];
      const n = parseInt(v === null || v === undefined ? '' : String(v), 10);
      if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
      TotalRecord = n;
    }
    const ViewBag = {
      CurrentPage: page,
      GridPageSize: MaxRows,
      TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate: fromdate,
      toDate: todate,
      side: Side,
      SponserID,
      Level,
    };
    return res.json({ view: '~/Views/CustomerPanel/All_Downline_Member_List/Index.cshtml', Model: LRMember, ViewBag });
  }));

module.exports = router;
