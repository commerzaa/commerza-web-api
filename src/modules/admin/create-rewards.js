'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Create_Rewards.cs (class Create_RewardsController => /admin/Create_Rewards/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Create_Rewards';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class AllRewardDetail */
const ARD_PROPS = ['RowNumber', 'RMID', 'Title', 'Description', 'Price', 'date', 'Image', 'NoOfPairs', 'Req_Income'];

/** private static bool ThumbnailCallback() { throw new NotImplementedException(); } (GetThumbnailImageAbort delegate, never invoked) */
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }
void ThumbnailCallback;

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Create_Rewards' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const Rewarddetails = mapRows(await db.proc(DB, 'usp_GetAllRewardDetail', { StartRowIndex: 1, MaxRows: 999999 }), ARD_PROPS);
  if (Rewarddetails.length > 0) {
    let srno = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Create_Rewards.xls', Filename, downloadName: ' Create_Rewards.xls',
      headers: ['S.No.', 'Rank', 'Rank Bonus', 'Required Incentive', 'Create Date'],
      rows: Rewarddetails, innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(srno)) + ' \t');
        w(B.tab(B.cellStr(item, 'Title')) + ' \t');
        w(B.tab(B.cellStr(item, 'Description')) + ' \t');
        w(B.tab(B.dec2(item.Req_Income)) + ' \t');
        w(B.tab(B.cellStr(item, 'date')) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Create-Rewards" -> Create_Rewards/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Create-Rewards'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = value === undefined || value === null || value === '' ? 0 : parseInt(value, 10);
  }
  const ViewBag = {};
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  if (page === null) page = 1;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc(DB, 'usp_GetAllRewardDetail', { StartRowIndex: page, MaxRows });
  const Rewarddetails = mapRows(rows, ARD_PROPS);
  // PORT-NOTE: @TotalCount OUT read from the result row column "totalcount" (no row => 0).
  const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.dynamicpagging = dynamicpagging;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Create_Rewards/Index.cshtml', Model: Rewarddetails, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult SubmitRewarddetail(string Rmid, string mode, string RewardTitle, string description, decimal RewardPrice, string NoOfPairs, string imagename, decimal reqincome)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/SubmitRewarddetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RewardPrice = B.reqDec(req.p.RewardPrice, 'RewardPrice');
  const reqincome = B.reqDec(req.p.reqincome, 'reqincome');
  const Rmid = B.nStr(req.p.Rmid);
  const mode = B.nStr(req.p.mode);
  const RewardTitle = B.nStr(req.p.RewardTitle);
  const description = B.nStr(req.p.description);
  const NoOfPairs = B.nStr(req.p.NoOfPairs);
  const imagename = B.nStr(req.p.imagename);
  let imgname = '';
  if (imagename === null) throw B.nullRef(); // imagename.Trim()
  if (imagename.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.RewardImagePath; // AppSettings["RewardImagePath"]
    if (imagename !== '') {
      base64String = imagename;
      // decimal.ToString() keeps the bound scale (e.g. "100.50") => use the posted text
      const priceText = String(req.p.RewardPrice).trim();
      imgname = B.cleanName(RewardTitle) + '-' + priceText + '-' + 0 + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(B.mapPath(SavePaths), imgname);
    const b = B.decodeBase64Image(base64String);
    const sharp = require('sharp');
    await sharp(b).metadata(); // Image.FromStream
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      const o = path.join(B.mapPath(SavePaths), oldimage);
      if (fs.existsSync(o)) fs.unlinkSync(o);
    }
    await B.saveScaledImage(b, strValidFullName);
  }
  const empcode = req.user.emp_code; void empcode; // read, unused (legacy)
  const row = await db.procOne(DB, 'usp_CreateReward', {
    RMID: B.cvtInt(Rmid), Mode: mode, Rewardtitle: RewardTitle, Rewarddescription: description, Rewardprice: RewardPrice, reqincome,
    Rewardimage: imgname, NoOfPairs, point_for_open: 0, Periods: 0,
  });
  const OutputResult = B.outStr(row, 'result');
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult deleteReward(string RMID)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/deleteReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const empcode = req.user.emp_code; void empcode;
  const row = await db.procOne(DB, 'usp_GetRewardDetail', { rmid: B.cvtInt(B.nStr(req.p.RMID)), mode: 2 });
  const OutputResult = B.outStr(row, 'result');
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult GetRewardDetail(string rmid)
// auth (admin data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/GetRewardDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // objutil.GetDataSetSP(@RMID, @mode=1, @result) => Tables[0]
  const rows = await db.proc(DB, 'usp_GetRewardDetail', { RMID: B.cvtInt(B.nStr(req.p.rmid)), mode: 1 });
  const toDec2 = (v) => { if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); return Number(v).toFixed(2); };
  const rDetail = rows.map((dtrow) => ({
    RMID: B.str(B.col(dtrow, 'RMID')),
    Title: B.str(B.col(dtrow, 'Title')),
    Description: B.str(B.col(dtrow, 'Description')),
    Price: toDec2(B.col(dtrow, 'Price')),
    Image: B.str(B.col(dtrow, 'Image')),
    NoOfPairs: B.str(B.col(dtrow, 'NoOfPairs')),
    Req_Income: toDec2(B.col(dtrow, 'Req_Income')),
  }));
  return res.json(rDetail);
}));

module.exports = router;
