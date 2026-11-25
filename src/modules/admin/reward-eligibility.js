'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Reward_Eligibility.cs
// (class Reward_EligibilityController => /admin/Reward_Eligibility/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, view, perms, n2, nowStamp, tab, cs, nz, excelHistory, tsvDownload, mapRows, outParseInt,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'Reward_Eligibility';

/** class RoyalityRewardEligibility */
const RRE_PROPS = ['RowNumber', 'Level', 'TotalDownlineActiveMember', 'RequiredDownlineActiveMember', 'EligibilityStatus', 'TotalBusiness',
  'QualifyDate', 'RoyalityDescription'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** DbObj._Member_Master.Where(a => a.regNo == Plid).FirstOrDefault() - result unused (empty if-block in legacy) */
async function memberRow(Plid) {
  return db.queryOne(DB, 'select * from member_master where regno = @Plid limit 1', { Plid });
}

// public void ExportReport(string SearchField, string SearchValue)
async function ExportReport(req, res, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Reward_Eligibility_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const Plid = 1;
  await memberRow(Plid);
  // DbObj.Database.CommandTimeout = 2000
  const rows = await db.proc(DB, 'Usp_RoyalityStatusReport', {
    STARTROWINDEX: 1, MAXROWS: 999999, PLID: Plid, Mode: 1, USERNAME: SearchValue,
  });
  const ObjRoyalityRewardEligibility = mapRows(rows, RRE_PROPS);
  if (ObjRoyalityRewardEligibility.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Reward_Eligibility.xls', Filename,
      headers: ['S.No.', 'Level', 'Your Active Member', 'Required Active Member', 'Eligibility Status', 'Total Business', 'Qualify Date', 'Royalty'],
      rows: ObjRoyalityRewardEligibility,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.RowNumber)) + ' \t');
        w(tab(cs(item.Level)) + ' \t');
        w(tab(cs(item.TotalDownlineActiveMember)) + ' \t');
        w(tab(cs(item.RequiredDownlineActiveMember)) + ' \t');
        w(tab(cs(item.EligibilityStatus)) + ' \t');
        w(tab(n2(item.TotalBusiness)) + ' \t');
        w(tab(nz(item.QualifyDate)) + ' \t'); // Nullable<DateTime>.ToString()
        w(tab(cs(item.RoyalityDescription)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, string btnexel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Reward-Eligibility" -> Reward_Eligibility/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Reward-Eligibility'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromdate = nstr(req.p.fromdate);
  let todate = nstr(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  // (no try/catch in legacy: errors are unhandled => 500)
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  await perms(url, Empid, ViewBag);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const Plid = 1;
  await memberRow(Plid);
  // DbObj.Database.CommandTimeout = 2000
  const rows = await db.proc(DB, 'Usp_RoyalityStatusReport', {
    STARTROWINDEX: page, MAXROWS: MaxRows, PLID: Plid, Mode: 1, USERNAME: SearchValue,
  });
  const ObjRoyalityRewardEligibility = mapRows(rows, RRE_PROPS);
  const TotalRecord = outParseInt(rows, 'TOTALCOUNTRECORD');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, SearchField, SearchValue, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/Reward_Eligibility/Index.cshtml', ObjRoyalityRewardEligibility, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.SearchField), nstr(req.p.SearchValue), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
