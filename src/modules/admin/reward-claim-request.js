'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\RewardClaimRequest.cs
// (class Common.Controllers.AdminPanel.RewardClaimRequestController => /admin/RewardClaimRequest/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, view, perms, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, outParseIntZ, toInt32, outStr, outRaw, nre,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'RewardClaimRequest';

/** class RewardClaimRequestList */
const RCR_PROPS = ['ROWNUMBER', 'Name', 'CRID', 'RAID', 'PayMode', 'RewardsName', 'RequestDate', 'Amount', 'AdminCharges', 'TDS_PER', 'TDS_AMT',
  'ADMIN_AMT', 'ClaimStatus'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

const trimS = (v) => { if (v === null || v === undefined) throw nre(); return String(v).trim(); };

// public void ExportReport(string fromdate, string todate, string ddlSearchValue, string txtSearchValue)
async function ExportReport(req, res, fromdate, todate, ddlSearchValue, txtSearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'RewardClaimRequestList_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  // (no @orderbydate => proc default)
  const rows = await db.proc(DB, 'USP_ALL_RewardClaimRequest', {
    STARTROWINDEX: 1, MAXROWS: 999999, FROMDATE: trimS(fromdate), TODATE: trimS(todate), ddlSearchValue, txtSearchValue,
  });
  const AllRewardRequestList = mapRows(rows, RCR_PROPS);
  if (AllRewardRequestList.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'RewardClaimRequestList.xls', Filename,
      headers: ['S.No.', 'UserName', 'Rewards Name', 'Pay Mode', 'Amount', 'Admin Charges', 'Request Date', 'Status'],
      rows: AllRewardRequestList,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.Name)) + ' \t');
        w(tab(cs(item.RewardsName)) + ' \t');
        w(tab(cs(item.PayMode)) + ' \t');
        w(tab(cs(item.Amount)) + ' \t');
        w(tab(cs(item.AdminCharges)) + ' \t');
        w(tab(cs(item.RequestDate)) + ' \t');
        w(tab(cs(item.ClaimStatus)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string ddlSearchValue, string btnexel, string txtSearchValue, string fromdate, string todate, int? page)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Reward-Claim-Request" -> RewardClaimRequest/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Reward-Claim-Request'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let ddlSearchValue = nstr(req.p.ddlSearchValue);
  let btnexel = nstr(req.p.btnexel);
  let txtSearchValue = nstr(req.p.txtSearchValue);
  let fromdate = nstr(req.p.fromdate);
  let todate = nstr(req.p.todate);
  let page = nint(req.p.page);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Empid = req.user.emp_id;
  await perms(url, Empid, ViewBag);
  let AllRewardRequestList = [];
  try {
    if (dynamicpagging === null) dynamicpagging = 100;
    if (orderbydate === null) orderbydate = '';
    if (ddlSearchValue === null) ddlSearchValue = '';
    if (txtSearchValue === null) txtSearchValue = '';
    if (fromdate === null) fromdate = '';
    if (btnexel === null) btnexel = '';
    if (todate === null) todate = '';
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_ALL_RewardClaimRequest', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate.trim(), TODATE: todate.trim(), ddlSearchValue, txtSearchValue, orderbydate,
    });
    AllRewardRequestList = mapRows(rows, RCR_PROPS);
    const TotalRecord = outParseIntZ(rows, 'TOTALCOUNT');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = ddlSearchValue; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.SearchValue = txtSearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, fromdate, todate, ddlSearchValue, txtSearchValue, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/RewardClaimRequest/Index.cshtml', AllRewardRequestList, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_LEVELINCOME_REPORTS');
    // Response.Redirect("/page-not-found") (the following return View(...) was never rendered)
    return res.json({ redirect: '/page-not-found' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string ddlSearchValue, string txtSearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.fromdate), nstr(req.p.todate), nstr(req.p.ddlSearchValue), nstr(req.p.txtSearchValue), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult ApproveRequest(string CRID, string RAID)
// auth (reads Session["Admin_User"]; no try/catch in legacy)
router.all(`/admin/${C}/ApproveRequest{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const CRID = nstr(req.p.CRID);
  const RAID = nstr(req.p.RAID);
  const ApproveidId = req.user.emp_id;
  const rows = await db.proc(DB, 'USP_ApproveRequest', { CRID: toInt32(CRID), RAID: toInt32(RAID), Approveby: ApproveidId });
  const ResValue = outStr(outRaw(rows, 'INTRESULT'));
  return res.json(ResValue);
}));

module.exports = router;
