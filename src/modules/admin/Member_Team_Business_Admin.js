'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_Team_Business_Admin.cs (class Member_Team_Business_AdminController => /Member_Team_Business_Admin/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outIntOf, decOutIntOf, trimS, errorView,
} = require('./_shared/batch10_common');

const router = express.Router();
const C = 'Member_Team_Business_Admin';

/** class MemberTeamBusiness_list */
const PROPS = ['RowNumber', 'Level', 'TotalRegisteredMember', 'TotalActiveMember', 'TotalBusinessVolume'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string userName)
async function ExportReport(req, res, userName, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'MemberTeamBusinessAdmin_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  // [Usp_LevelWiseIncomeDetails_Admin] @UserName,@TotalMember out,@InActiveMember out,@ActiveMember out,@BusinessVolume out,@TotalRecord out,@StartRowIndex,@MaxRows
  const rows = await db.proc(DB, 'Usp_LevelWiseIncomeDetails_Admin', {
    UserName: trimS(userName), StartRowIndex: 1, MaxRows: 9999999,
  });
  const MemberTeamBusinessList = mapRows(rows, PROPS);
  if (MemberTeamBusinessList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'MemberTeamBusinessAdmin.xls', Filename,
      rawHeaders: 'S.No. \tLevel \tTotal Member \tInactive Member \tActive Member \tTotal Business\t',
      rows: MemberTeamBusinessList, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'Level')) + ' \t');
        w(tab(cellStr(item, 'TotalRegisteredMember')) + ' \t');
        // PORT-NOTE: legacy wrote TotalRegisteredMember again under "Inactive Member" (kept).
        w(tab(cellStr(item, 'TotalRegisteredMember')) + ' \t');
        w(tab(cellStr(item, 'TotalActiveMember')) + ' \t');
        w(tab(cellStr(item, 'TotalBusinessVolume')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string userName, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Member-Team-Business-Report" -> Member_Team_Business_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-Team-Business-Report'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let userName = nStr(req.p.userName); if (userName === null) userName = '';
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  let page = nInt(req.p.page); if (page === null) page = 1;
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK @url,@ISACTIVE out
  const Employeeid = req.user.emp_id;
  const ip = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  try {
    const MaxRows = dynamicpagging;
    const rows = await db.proc(DB, 'Usp_LevelWiseIncomeDetails_Admin', {
      UserName: userName.trim(), StartRowIndex: page, MaxRows, orderbydate,
    });
    const MemberTeamBusinessList = mapRows(rows, PROPS);
    const Totalmem = outIntOf(rows, 'totalmember');
    const inActiveMem = outIntOf(rows, 'inactivemember');
    const ActiveMem = outIntOf(rows, 'activemember');
    const BusinessVol = decOutIntOf(rows, 'businessvolume');
    const Totalrecord = outIntOf(rows, 'totalrecord');
    Object.assign(ViewBag, {
      totalmem: Totalmem, totalinactmem: inActiveMem, dynamicpagging, orderbydate, totalactmem: ActiveMem, totalbusiness: BusinessVol,
      userName, CurrentPage: page, GridPageSize: MaxRows, TotalRecord: Totalrecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField: 0, SearchValue: 0,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, userName, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Member_Team_Business_Admin/Index.cshtml', Model: MemberTeamBusinessList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'Usp_LevelWiseIncomeDetails_Admin');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string userName)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.userName), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
