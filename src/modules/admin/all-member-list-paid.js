'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_Member_List_Paid.cs (class All_Member_List_paidController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const State = require('../../lib/admin/State');
const CITY = require('../../lib/admin/City');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, nre, toInt32, toDec, outStr, col, view, perms, fmtDate, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02-common');

const router = express.Router();
const C = 'All_Member_List_paid';

/** class AllMemberListPaid */
const AMLP_PROPS = ['ROWNUMBER', 'Regno', 'LoginId', 'Membername', 'mobile', 'Emailid', 'RESPOUNSERemailID', 'respounserId', 'RespounserName', 'Regdate',
  'ppv', 'gpv', 'PANNO', 'PBV', 'CITYNAME', 'ACCOUNTNO', 'BANKNAME', 'IFSCCODE', 'Active', 'Activestatus', 'PV', 'LID', 'RID', 'rootID', 'TLBV', 'TRBV',
  'PaidBV', 'address', 'addres', 'Kycstatus', 'Status', 'ChallanStatus', 'IsPanVerified', 'ChallanVerifiedOrNot', 'Member_Unique_Id', 'DOC', 'Package',
  'PackageCount', 'Password', 'Username', 'AllPackageAmount', 'COUNTPACKAGE', 'TOTALAMTBYID', 'TotalPayableAmount', 'PARENTID'];
/** class Package (declared in this C# file) */
const PACKAGE_PROPS = ['Regno', 'AllPackageName', 'PuchaseDate', 'TotalPayableAmount', 'BVPERCENTAGE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

const genProc = (p) => db.proc(DB, 'usp_All_memberList_paid', {
  StartRowIndex: p.page, MaxRows: p.MaxRows, SearchField: p.SearchField.trim(), SearchValue: p.SearchValue.trim(), fromDate: p.fromDate.trim(),
  ToDate: p.toDate.trim(), userType: p.ddlStatus.trim(), VarifiedPanStatus: p.VarifiedPanStatus.trim(), USERDOWNLINEMEMBER: p.UserDownlineSearch,
  SIDE: p.Side, Emp_ID: p.Empid, Page_Name: url, SessionID: '0', activationdate: p.activationdate, orderbydate: p.orderbydate, MAINSEARCH: p.MainSearch,
});

// [SessionExpireCheck] public void ExportReport(string orderbydate, string SearchField, string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, int? page, string UserDownlineSearch, int? Empid, int? Side, string activationdate, string MainSearch)
async function ExportReport(req, res, a, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Member_List_Paid_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = 1000000;
  if (a.page === null) a.page = 1;
  for (const k of ['SearchField', 'SearchValue', 'fromDate', 'toDate', 'ddlStatus', 'VarifiedPanStatus']) if (a[k] === null) throw nre();
  const rows = await genProc({ ...a, MaxRows });
  const list = mapRows(rows, AMLP_PROPS);
  if (list.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Member_List_Paid.xls', Filename,
      headers: ['S.No.', 'Userid', 'Username', 'Name', 'Join Date', 'Activation Date', 'Package', 'Total'],
      rows: list,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'usp_All_memberList_paid',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.LoginId)) + ' \t');
        w(tab(cs(item.Username)) + ' \t');
        w(tab(cs(item.Membername)) + ' \t');
        w(tab(fmtDate(item.Regdate, 'dd-MMM-yyyy HH:mm tt')) + ' \t');
        w(tab(fmtDate(item.DOC, 'dd-MMM-yyyy HH:mm tt')) + ' \t');
        w(tab(cs(item.PackageCount)) + ' \t');
        w(tab(n2(item.TOTALAMTBYID)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, int? page, string btnexel, string UserDownlineSearch, int? Side, string activationdate, string MainSearch)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/All-Member-List-Paid" -> All_Member_List_Paid/Index (controller names are case-insensitive)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/All-Member-List-Paid'], adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => nstr(req.p[k]);
  let dynamicpagging = nint(req.p.dynamicpagging);
  let page = nint(req.p.page);
  let Side = nint(req.p.Side);
  const a = {
    orderbydate: s('orderbydate'), SearchField: s('SearchField'), SearchValue: s('SearchValue'), VarifiedPanStatus: s('VarifiedPanStatus'),
    fromDate: s('fromDate'), toDate: s('toDate'), ddlStatus: s('ddlStatus'), UserDownlineSearch: s('UserDownlineSearch'), activationdate: s('activationdate'),
    MainSearch: s('MainSearch'),
  };
  let btnexel = s('btnexel');
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  for (const k of Object.keys(a)) if (a[k] === null) a[k] = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (btnexel === null) btnexel = '';
  if (Side === null) Side = 0;
  const Empid = req.user.emp_id;
  await perms(url, Empid, ViewBag);
  try {
    const MaxRows = toInt32(dynamicpagging);
    if (page === null) page = 1;
    const rows = await genProc({ ...a, page, MaxRows, Side, Empid });
    const AllEPinRequestsList = mapRows(rows, AMLP_PROPS);
    const tc = outStr(col(rows[0], 'totalcount'));
    const ta = outStr(col(rows[0], 'totalallpackagamt'));
    Object.assign(ViewBag, {
      dynamicpagging, orderbydate: a.orderbydate, CurrentPage: page, TOTALAVAILABLES: toDec(ta === '' ? '0' : ta), GridPageSize: MaxRows,
      TotalRecord: parseInt(tc === '' ? '0' : tc, 10), NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: a.SearchField,
      SearchValue: a.SearchValue, fromDate: a.fromDate, UserDownlineSearch: a.UserDownlineSearch, toDate: a.toDate, Side, ddlStatus: a.ddlStatus,
      VarifiedPanStatus: a.VarifiedPanStatus, activationdate: a.activationdate, MainSearch: a.MainSearch,
    });
    const S = new State();
    const Cc = new CITY();
    ViewBag.LiState = await S.State_List_On_CID(96);
    ViewBag.LiCity = await Cc.City_List_On_CID(96);
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, { ...a, page, Empid, Side }, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/All_Member_List_paid/Index.cshtml', AllEPinRequestsList, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'usp_All_memberList_paid');
    return view(res, '~/Views/PageNotFound/Index.cshtml');
  }
}));

// ---------------------------------------------------------------- [SessionExpireCheck] public void ExportReport(...)
// auth ([SessionExpireCheck])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => nstr(req.p[k]);
  const r = await ExportReport(req, res, {
    orderbydate: s('orderbydate'), SearchField: s('SearchField'), SearchValue: s('SearchValue'), VarifiedPanStatus: s('VarifiedPanStatus'),
    fromDate: s('fromDate'), toDate: s('toDate'), ddlStatus: s('ddlStatus'), page: nint(req.p.page), UserDownlineSearch: s('UserDownlineSearch'),
    Empid: nint(req.p.Empid), Side: nint(req.p.Side), activationdate: s('activationdate'), MainSearch: s('MainSearch'),
  }, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult GetPackageDetail(Int64 regno)
// auth ([SessionExpireCheck])
router.all(`/admin/${C}/GetPackageDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const raw = req.p.regno;
  const regno = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isInteger(regno)) {
    return res.status(500).json({ message: "The parameters dictionary contains a null entry for parameter 'regno' of non-nullable type 'System.Int64'" });
  }
  const PackageDetail = mapRows(await db.proc(DB, 'USP_SCALERDATA', { Mode: 2, Identity: '', Uniqueid: regno }), PACKAGE_PROPS);
  return res.json(PackageDetail);
}));

module.exports = router;
