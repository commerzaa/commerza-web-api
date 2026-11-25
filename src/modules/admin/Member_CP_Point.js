'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_CP_Point.cs (class Member_CP_PointController => /Member_CP_Point/...)
// Database: affiliate (Db_Affiliate). Proc: USP_MERCHANTTRANFER_Details.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, s0, outOf, cvtIntStrict } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Member_CP_Point';

/** class MembermerchantDetails */
const PROPS = ['RowNumber', 'DATE', 'REMARKS', 'AMOUNT', 'MerchantName', 'MerchantLoginid', 'MerchantEmailid', 'USERNAME', 'NAME'];

// ---------------------------------------------------------------- Index(int? page, string SearchField, string searchvalue, string fromDate, string toDate, string wfromDate,
//   string wtoDate, string RequestType, string username, int? ddlcustpage)
// auth (PORT-NOTE: legacy had no session check on this admin report - protected)
// route-config: "AdminPanel/member_cp-point" -> Member_CP_Point/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member_cp-point'], adminAuth, asyncHandler(async (req, res) => {
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  const fromDate = s0(req.p.fromDate);
  const searchvalue = s0(req.p.searchvalue);
  const SearchField = s0(req.p.SearchField);
  const toDate = s0(req.p.toDate);
  const RequestType = s0(req.p.RequestType);
  let page = nInt(req.p.page);
  try {
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    const Plid = 0;
    // USP_MERCHANTTRANFER_Details @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@Rolename,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@REGNO
    const rows = await db.proc(DB, 'USP_MERCHANTTRANFER_Details', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: searchvalue.trim(), Rolename: '', FROMDATE: fromDate.trim(),
      TODATE: toDate.trim(), REGNO: Plid,
    });
    const list = mapRows(rows, PROPS);
    const ViewBag = { fromDate, toDate, searchvalue, RequestType };
    const tc = outOf(rows, 'totalcount');
    const TotalRecord = cvtIntStrict(tc === '' && rows.length === 0 ? '0' : tc); // PORT-NOTE: no row => OUT value unavailable => 0
    Object.assign(ViewBag, { CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), ddlcustpage });
    return res.json({ view: '~/Views/AdminPanel/Member_CP_Point/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found") (ends the request)
  }
}));

module.exports = router;
