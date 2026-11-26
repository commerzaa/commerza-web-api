'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Profile_Update_History.cs (class Profile_Update_HistoryController => /admin/Profile_Update_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nre, nint, nstr, toInt32, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02-common');
const { outIntOf, errorView } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'Profile_Update_History';

/** class MemberProfileDetails */
const MEMBERPROFILEDETAILS_PROPS = ['ROWNUMBER', 'TITLE', 'NAME', 'DESIGNATION', 'EMAILID', 'USERNAME', 'LOGINID', 'DOB', 'FATHERORMOTHERNAME',
  'GENDER', 'HIGHESTQUALIFICATION', 'IDTYPE', 'IDREFNO', 'PANNO', 'PLID', 'ActivityDate', 'SID', 'CTID', 'Atc_WalletAddress', 'CityName', 'CID',
  'Remark', 'EMPID', 'IPADDRESS', 'phone'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, int? page) */
async function ExportReport(req, res, SearchField, SearchValue, page, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Profile_Update_History' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1; // eslint-disable-line no-param-reassign
  if (SearchField === null || SearchValue === null) throw nre(); // .Trim()
  // USP_MEMBER_PROFILE_HISTORY @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT out,@STRRESULT out  (no @orderbydate)
  const MemberProfileDetails = mapRows(await db.proc(DB, 'USP_MEMBER_PROFILE_HISTORY', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: '', TODATE: '',
  }), MEMBERPROFILEDETAILS_PROPS);
  return tsvDownload({
    req, res, ViewBag, xlsName: 'Profile_Update_History.xls', Filename,
    headers: ['S.No.', 'Username', 'Name', 'Contact', 'Email Id', 'Ipaddress'],
    rows: MemberProfileDetails,
    innerProc: 'MemberProfileDetails',
    outerProc: 'USP_MEMBER_PROFILE_HISTORY',
    cells: (item, w) => {
      w(tab(cs(item.ROWNUMBER)) + ' \t');
      w(tab(cs(item.USERNAME)) + ' \t');
      w(tab(cs(item.NAME)) + ' \t');
      w(tab(cs(item.phone)) + ' \t');
      w(tab(cs(item.EMAILID)) + ' \t');
      w(tab(cs(item.IPADDRESS)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, int? page, string btnexel, string ddlsearchDownline, string fromDate, string toDate)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Profile-Update-History" -> Profile_Update_History/Index
// Config: DynamicPagging
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Profile-Update-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let page = nint(req.p.page);
  let btnexel = nstr(req.p.btnexel);
  let ddlsearchDownline = nstr(req.p.ddlsearchDownline);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (SearchField === null) SearchField = '';
  if (fromDate === null) fromDate = '';
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = toInt32(value); // Convert.ToInt16(value)
  }
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  if (ddlsearchDownline === null) ddlsearchDownline = ''; // eslint-disable-line no-unused-vars
  if (SearchValue === null) SearchValue = '';
  if (btnexel === null) btnexel = '';
  const p = await inlinePerms(req.user.emp_id, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK (v == "0" ? "0" : v)
  try {
    const MaxRows = toInt32(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_MEMBER_PROFILE_HISTORY', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate,
      TODATE: toDate, orderbydate,
    });
    const MemberProfileDetails = mapRows(rows, MEMBERPROFILEDETAILS_PROPS);
    const TotalRecord = outIntOf(rows, 'TOTALCOUNT');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, page, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/Profile_Update_History/Index.cshtml', MemberProfileDetails, ViewBag);
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_MEMBER_PROFILE_HISTORY');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, int? page)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.SearchField), nstr(req.p.SearchValue), nint(req.p.page), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
