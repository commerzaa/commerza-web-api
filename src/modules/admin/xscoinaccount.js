'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\XSCOINACCOUNT.cs (class XSCOINACCOUNTController => /admin/XSCOINACCOUNT/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'XSCOINACCOUNT';

/** class XSCOINACCOUNT */
const XSCOIN_PROPS = ['ROWNUMBER', 'USERNAME', 'EMAILID', 'MOBILE', 'PACKAGENAME', 'AMOUNT', 'TOKENBALANCE', 'DATE'];

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/XS-COIN-ACCOUNT" -> XSCOINACCOUNT/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/XS-COIN-ACCOUNT'], adminAuth, asyncHandler(async (req, res) => {
  const SearchField = B.s0(req.p.SearchField);
  const SearchValue = B.s0(req.p.SearchValue);
  const fromdate = B.s0(req.p.fromdate);
  const todate = B.s0(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  const ViewBag = {};
  try {
    const MaxRows = B.cvtInt(ddlcustpage);
    if (page === null) page = 1;
    // db.Database.CommandTimeout = 1000
    // [USP_XSCOINCLASSICACCOUNT] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@TOTALCOUNT OUT
    const rows = await db.proc(DB, 'USP_XSCOINCLASSICACCOUNT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    });
    const AllFreeEpinList = mapRows(rows, XSCOIN_PROPS);
    const TotalRecord = B.outIntOf(rows, 'TOTALCOUNT'); // int.Parse(v == "" ? "0" : v)
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    return res.json({ view: '~/Views/AdminPanel/XSCOINACCOUNT/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_XSCOINCLASSICACCOUNT');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

module.exports = router;
