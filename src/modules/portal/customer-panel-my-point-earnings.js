'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyPointEarnings.cs
// (class MyPointEarningsController => /portal/MyPointEarnings/...). Database: shopping (Db_Shopping).
// PORT-NOTE: Usp_ActivityReportManager's OUT parameters (@TEarnedBy*, @TToatlEarned, @TOTALCOUNTPARAM, @UserName) are not passed: the
// legacy passed exactly their default values ("0.00", "0", "") and PostgreSQL functions return OUT values as result columns.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view, outVal, outTotal, nInt, nStr, str, toInt32, toNumber } = require('./_shared/batch-06-common');

const router = express.Router();

/** class ActivityBonus */
const ACTIVITYBONUS_PROPS = ['SNO', 'DATE', 'EarnedByView', 'EarnedByShare', 'EarnedByBlog', 'EarnedByClassified', 'EarnedByBusinessListing',
  'ToatlEarned'];
/** class LinkDetails */
const LINKDETAILS_PROPS = ['SNO', 'DATE', 'LinkOrTitle', 'EarnedPoints'];

// ---------------------------------------------------------------- Index(SearchField, SearchValue, fromdate, todate, int? page)
// auth ([SessionExpireCheck])
// route-config: "referral/my-earnings-points" -> MyPointEarnings/Index
router.all(['/portal/MyPointEarnings/Index{/:id}', '/portal/MyPointEarnings', '/portal/referral/my-earnings-points'], ps.SessionExpireCheck,
  asyncHandler(async (req, res) => {
    const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
    const SearchField = d('SearchField');
    const SearchValue = d('SearchValue');
    const fromdate = d('fromdate');
    const todate = d('todate');
    let page = nInt(req.p.page);
    if (page === null) page = 1;
    const MaxRows = 50;
    const rows = await db.proc(DB, 'usp_activityreportmanager', {
      PLID: req.user.plid, DATE: '', STARTROWINDEX: page, MAXROWS: MaxRows, MODE: '3',
    });
    const Obj = mapRows(rows, ACTIVITYBONUS_PROPS);
    const TotalRecord = outTotal(rows, 'totalcountparam');
    const ViewBag = {
      CurrentPage: page,
      GridPageSize: MaxRows,
      TotalRecord,
      NoPerPage: MaxRows,
      SearchField,
      SearchValue,
      fromDate: fromdate,
      toDate: todate,
    };
    view(res, '~/Views/CustomerPanel/MyPointEarnings/Index.cshtml', Obj, ViewBag);
  }));

// ---------------------------------------------------------------- GetDataByDate(string Date, string Mode) : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all('/portal/MyPointEarnings/GetDataByDate{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_activityreportmanager', {
    PLID: req.user.plid, DATE: req.p.Date === undefined ? null : req.p.Date, STARTROWINDEX: '1', MAXROWS: '100',
    MODE: req.p.Mode === undefined ? null : req.p.Mode,
  });
  res.json(mapRows(rows, LINKDETAILS_PROPS));
}));

// ---------------------------------------------------------------- SubmitOrRequestPoints(string Mode, string Value) : JsonResult
// auth (unguarded (Login)Session["Plid"] cast inside the branch)
router.all('/portal/MyPointEarnings/SubmitOrRequestPoints{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const Mode = nStr(req.p.Mode);
  const Value = nStr(req.p.Value);
  let Result = '';
  if (Mode !== '0' && Value !== '') {
    const row = await db.procOne(DB, 'usp_earningspointsmanagement', {
      Mode: toInt32(toNumber(Mode)), PLID: req.user.plid, POINT: toNumber(Value), Date: '',
    });
    Result = str(outVal(row, 'intoutputresult'));
  } else {
    Result = 'Some Error in processing your request. Try Again!';
  }
  res.json(Result);
}));

module.exports = router;
