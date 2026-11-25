'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\PeofileUpdateController.cs (class PeofileUpdateController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, cvtInt, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, cellStr, tab, outOf, trimS,
} = require('./_shared/batch11_common');

const router = express.Router();
const C = 'PeofileUpdate';

/** class ProfileUpdate */
const PROFILEUPDATE_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'MOBILE', 'EMAILID', 'DOB', 'GENDER', 'PANNO', 'ACTIVATIONDATE', 'CityName'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

const tab3 = (v) => String(v).replace(/\t/g, '   '); // Regex.Replace(GENDER, "\t", "   ") (3 spaces in legacy)

// public void ExportReport(string UserName, string Mobile, string EmailID, string Name, string From, string To, int? page)
async function ExportReport(req, res, UserName, Mobile, EmailID, Name, From, To, page, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Sales_Report_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // computed, unused (legacy)
  void MaxRows;
  if (page === null) page = 1;
  // PORT-NOTE: legacy passes EmailID (not Name) as @Name, and omits @orderbydate - kept.
  const rows = await db.proc(DB, 'Usp_Profile_Update', {
    STARTROWINDEX: '1', MAXROWS: '10000', UserName: trimS(UserName), Name: trimS(EmailID), Mobile: trimS(Mobile), EmailID: trimS(EmailID),
    From: trimS(From), To: trimS(To),
  });
  const AllEPinRequestsList = mapRows(rows, PROFILEUPDATE_PROPS);
  if (AllEPinRequestsList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Sales_Report.xls', Filename,
      headers: ['S.No.', 'Date', 'OrderId', 'UserName', 'ContactNo.', 'EmailID', 'Package', 'Amount', 'Mode', 'Details'],
      rows: AllEPinRequestsList,
      innerProc: 'ProfileUpdate',
      outerProc: 'Usp_Profile_Update',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'NAME')) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(cellStr(item, 'EMAILID').trim()) + ' \t');
        w(tab(cellStr(item, 'DOB')) + ' \t');
        w(tab3(cellStr(item, 'GENDER')) + ' \t');
        w(tab(cellStr(item, 'PANNO')) + ' \t');
        w(tab(cellStr(item, 'ACTIVATIONDATE')) + ' \t');
        w(tab(cellStr(item, 'CityName')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string UserName, string Mobile, string EmailID, string Name, string fromDate, string toDate, int? page, int? ddlcustpage, string btnexel, string SearchField, string SearchValue)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Profile-Update" -> PeofileUpdate/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Profile-Update'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let UserName = nStr(req.p.UserName);
  let Mobile = nStr(req.p.Mobile);
  let EmailID = nStr(req.p.EmailID);
  let Name = nStr(req.p.Name);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (UserName === null) UserName = '';
  if (Mobile === null) Mobile = '';
  if (SearchValue === null) SearchValue = '';
  if (SearchField === null) SearchField = '';
  if (EmailID === null) EmailID = '';
  if (Name === null) Name = '';
  if (fromDate === null) fromDate = '';
  if (dynamicpagging === null) dynamicpagging = cvtInt(config.app.DynamicPagging);
  if (orderbydate === null) orderbydate = '';
  if (toDate === null) toDate = '';
  ViewBag.excelactive = await excelLink(url);
  if (page === null) page = 1;
  if (btnexel === null) btnexel = '';
  const Employeeid = req.user.emp_id;
  const MaxRows = Number(dynamicpagging);
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  // PORT-NOTE: legacy binds SearchField to @UserName and SearchValue to @Name (the UserName/Name params are only echoed) - kept.
  const rows = await db.proc(DB, 'Usp_Profile_Update', {
    STARTROWINDEX: page, MAXROWS: MaxRows, UserName: SearchField.trim(), Name: SearchValue.trim(), Mobile: Mobile.trim(), EmailID: EmailID.trim(),
    From: fromDate.trim(), To: toDate.trim(), orderbydate,
  });
  const AllEPinRequestsList = mapRows(rows, PROFILEUPDATE_PROPS);
  const tc = outOf(rows, 'TOTALCOUNT');
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused, legacy)
  ViewBag.UserName = UserName;
  ViewBag.EmailID = EmailID;
  ViewBag.Mobile = Mobile;
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.From = fromDate;
  ViewBag.To = toDate;
  ViewBag.Name = Name;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, UserName, Mobile, EmailID, Name, fromDate, toDate, page, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/PeofileUpdate/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"], returns member data)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('UserName'), v('Mobile'), v('EmailID'), v('Name'), v('From'), v('To'), nInt(req.p.page), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
