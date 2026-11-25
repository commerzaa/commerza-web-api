'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_CommunityGroupController.cs (class Add_CommunityGroupController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, nre, toInt32, outStr, col, view, inlinePerms, excelLink, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Add_CommunityGroup';

/** class CoreCommetie_Group */
const CCG_PROPS = ['USERNAME', 'MOBILE', 'EMAILID', 'TRBV', 'REDATE', 'DATEACTIVATION', 'ROWNUMBER', 'REGNO', 'GROUPNAME', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// public void ExportReport(string UserName, string Mobile, string EmailID, string TotalBusiness, string From, string SearchField, string To, string STATUS)
async function ExportReport(req, res, UserName, Mobile, EmailID, TotalBusiness, From, SearchField, To, STATUS, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Add_CommunityGroup_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  for (const v of [UserName, Mobile, EmailID, TotalBusiness, From, SearchField, STATUS, To]) if (v === null) throw nre();
  // dbo.USP_CREATE_CORECOMMITY_GROUP ... ,@TOTALCOUNT out  (no @orderbydate)
  const rows = await db.proc(DB, 'USP_CREATE_CORECOMMITY_GROUP', {
    StartRowIndex: 1, MaxRows: 999999, UserName: UserName.trim(), Mobile: Mobile.trim(), EmailID: EmailID.trim(),
    TotalBussiness: TotalBusiness.trim(), From: From.trim(), SearchField: SearchField.trim(), Status: STATUS.trim(), To: To.trim(),
  });
  const list = mapRows(rows, CCG_PROPS);
  if (list.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Add_CommunityGroup.xls', Filename,
      headers: ['S.No.', 'Username', 'Name', 'Mobile', 'Email Id', 'Total Business', 'Reg Date', 'Date Activation', 'Status'],
      rows: list,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.USERNAME)) + ' \t');
        w(tab(cs(item.USERNAME)) + ' \t'); // legacy wrote USERNAME twice (Name column)
        w(tab(cs(item.MOBILE)) + ' \t');
        w(tab(cs(item.EMAILID)) + ' \t');
        w(tab(n2(item.TRBV)) + ' \t');
        w(tab(cs(item.REDATE)) + ' \t');
        w(tab(cs(item.DATEACTIVATION)) + ' \t');
        // (no Status cell, like legacy)
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string UserName, string STATUS, string btnexel, string SearchField, string Mobile, string EmailID, string TotalBusiness, string From, string To, int? page, int? ddlcustpage)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Community-Group" -> Add_CommunityGroup/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Community-Group'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let UserName = nstr(req.p.UserName);
  let STATUS = nstr(req.p.STATUS);
  let btnexel = nstr(req.p.btnexel);
  let SearchField = nstr(req.p.SearchField);
  let Mobile = nstr(req.p.Mobile);
  let EmailID = nstr(req.p.EmailID);
  let TotalBusiness = nstr(req.p.TotalBusiness);
  let From = nstr(req.p.From);
  let To = nstr(req.p.To);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const ViewBag = {};

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (btnexel === null) btnexel = '';
  if (UserName === null) UserName = '';
  if (Mobile === null) Mobile = '';
  if (EmailID === null) EmailID = '';
  if (TotalBusiness === null) TotalBusiness = '';
  if (From === null) From = '';
  if (To === null) To = '';
  if (SearchField === null) SearchField = '';
  else if (SearchField === 'Registration Date') SearchField = 'Registration Date';
  else if (SearchField === 'Activation Date') SearchField = 'Activation Date';
  if (STATUS === null) STATUS = '';
  const MaxRows = toInt32(dynamicpagging);
  ViewBag.excelactive = await excelLink(url);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_CREATE_CORECOMMITY_GROUP', {
    StartRowIndex: page, MaxRows, UserName: UserName.trim(), Mobile: Mobile.trim(), EmailID: EmailID.trim(),
    TotalBussiness: TotalBusiness.trim(), From: From.trim(), SearchField: SearchField.trim(), Status: STATUS.trim(), To: To.trim(), orderbydate,
  });
  const AllEPinRequestsList = mapRows(rows, CCG_PROPS);
  const tc = outStr(col(rows[0], 'totalcount'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, UserName, Mobile, EmailID, TotalBusiness, From, SearchField, To, STATUS, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/Add_CommunityGroup/Index.cshtml', AllEPinRequestsList, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nstr(req.p[k]);
  const r = await ExportReport(req, res, v('UserName'), v('Mobile'), v('EmailID'), v('TotalBusiness'), v('From'), v('SearchField'), v('To'), v('STATUS'), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Insert_COMMITY_GROUP(string RegNo, string ADID, string AssignBy)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/Insert_COMMITY_GROUP{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const REGNO = toInt32(nstr(req.p.RegNo));
  const Assignby = req.user.emp_id; // AssignBy parameter is ignored (legacy used the session Emp_ID)
  // DBO.usp_tblCoreCommunity_Histroy @RegNo,'','',@AssignBy,'',@adid
  // PORT-NOTE: positional '' for @FromDate/@ToDate (datetime: '' => 1900-01-01) and @Status (int: '' => 0) in SQL Server;
  // passed as 1900-01-01 / 0 here.
  await db.proc(DB, 'usp_tblCoreCommunity_Histroy', {
    RegNo: REGNO, FromDate: '1900-01-01', ToDate: '1900-01-01', AssignBy: Assignby, Status: 0, adid: nstr(req.p.ADID),
  });
  return res.json('');
}));

module.exports = router;
