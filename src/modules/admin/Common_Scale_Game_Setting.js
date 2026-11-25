'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Common_Scale_Game_Setting.cs
// (class Common_Scale_Game_SettingController => /admin/Common_Scale_Game_Setting/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Common_Scale_Game_Setting';

/** class MatchSetting */
const MATCH_PROPS = ['FromMatch', 'ToMatch', 'MultipleTime'];

// ---------------------------------------------------------------- ActionResult Index(int? page, int? mode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Common-Scale-Game-Setting" -> Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Common-Scale-Game-Setting'], adminAuth, asyncHandler(async (req, res) => {
  let mode = B.nInt(req.p.mode);
  if (mode === null) mode = 1; // assigned, otherwise unused (legacy)
  const ViewBag = {};
  try {
    const TotalMatch = await db.scalar(DB, 'select count(1) from tbl_matchmaster where isactive = 1', {});
    ViewBag.TotalMatch = TotalMatch === null ? 0 : Number(TotalMatch);
    const MatchSetting = mapRows(await db.query(DB, `select coalesce(frommatch,0) as frommatch, coalesce(tomatch,0) as tomatch,
      coalesce(multipletime,0) as multipletime from tbl_commonscalegamesetting where active = 1`, {}), MATCH_PROPS);
    // PORT-NOTE: SqlQuery<MatchSetting> mapped the columns FROMMATCH/TOMATCH/MULTIPLETIME case-insensitively to FromMatch/ToMatch/MultipleTime.
    ViewBag.MatchRecord = MatchSetting;
    return res.json({ view: '~/Views/AdminPanel/Common_Scale_Game_Setting/Index.cshtml', ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'Index');
  }
}));

// ---------------------------------------------------------------- JsonResult CommonScaleSetting(string[] AllMatchValue)
// auth (admin setting write; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/CommonScaleSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AllMatchValue = req.p.AllMatchValue;
  if (AllMatchValue === undefined) AllMatchValue = req.p['AllMatchValue[]'];
  if (AllMatchValue !== undefined && AllMatchValue !== null && !Array.isArray(AllMatchValue)) AllMatchValue = [AllMatchValue];
  let Result = '';
  if (!AllMatchValue || AllMatchValue[0] === undefined || AllMatchValue[0] === null) throw B.nullRef(); // AllMatchValue[0].ToString()
  const JsonString = typeof AllMatchValue[0] === 'string' ? AllMatchValue[0] : JSON.stringify(AllMatchValue[0]);
  const parsed = JSON.parse(JsonString); // js.Deserialize<MatchSetting[]>(JsonString)
  const Match = (parsed || []).map((m) => {
    const o = {};
    for (const k of MATCH_PROPS) { const v = B.col(m, k); o[k] = v === undefined || v === null || v === '' ? 0 : parseInt(v, 10); }
    return o;
  });
  for (let i = 0; i < Match.length; i++) {
    const row = await db.procOne(DB, 'USP_COMMONSCALESETTING', {
      FROMMATCH: Match[i].FromMatch, TOMATCH: Match[i].ToMatch, MULTIPLETIME: Match[i].MultipleTime,
    });
    Result = B.outStr(row, 'result');
  }
  return res.json(Result);
}));

module.exports = router;
