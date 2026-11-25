'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Pending_Kyc.cs (class Pending_KycController => /admin/Pending_Kyc/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const State = require('../../lib/admin/State');
const CITY = require('../../lib/admin/City');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, nStr, errorView, outIntOf } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'Pending_Kyc';

/** class PendingKycList */
const PENDING_KYC_PROPS = ['ROWNUMBER', 'RegNo', 'LoginId', 'MEMBERNAME', 'MOBILE', 'EmailID', 'REGDATE', 'Kyc_Update', 'KycStatus'];

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, int? listkyc, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Kyc-Admin" -> Pending_Kyc/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Kyc-Admin'], adminAuth, asyncHandler(async (req, res) => {
  const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
  const SearchField = d('SearchField');
  const SearchValue = d('SearchValue');
  const fromDate = d('fromDate');
  const toDate = d('toDate');
  const ddlStatus = d('ddlStatus');
  const VarifiedPanStatus = d('VarifiedPanStatus');
  let listkyc = nInt(req.p.listkyc);
  if (listkyc === null) listkyc = 0;
  let page = nInt(req.p.page);
  const ViewBag = {};
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    // db.Database.CommandTimeout = 1000
    const rows = await db.proc(DB, 'Usp_Pending_Kyc', {
      StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(),
      ToDate: toDate.trim(), kycstaus: listkyc,
    });
    const AllEPinRequestsList = mapRows(rows, PENDING_KYC_PROPS);
    const TotalRecord = outIntOf(rows, 'TotalCount');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlStatus = ddlStatus;
    ViewBag.VarifiedPanStatus = VarifiedPanStatus;
    ViewBag.LiState = await new State().State_List_On_CID(96);
    ViewBag.LiCity = await new CITY().City_List_On_CID(96);
    return res.json({ view: '~/Views/AdminPanel/Pending_Kyc/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'Usp_Pending_Kyc');
  }
}));

module.exports = router;
