'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MatchWise_Scale_Game_Setting.cs (class MatchWise_Scale_Game_SettingController)
// Database: affiliate (Db_Affiliate). Tables: tbl_matchmaster, tbl_matchscalegamesetting. Proc: USP_MATCHSCALESETTING.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, outStr, firstCol, at, nullRef, errorView } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'MatchWise_Scale_Game_Setting';

/** class MatchWiseSetting */
const PROPS = ['FromMatch', 'ToMatch', 'MultipleTime'];

// ---------------------------------------------------------------- Index(int? page, int? mode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/MatchWise-Scale-Game-Setting" -> MatchWise_Scale_Game_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MatchWise-Scale-Game-Setting'], adminAuth, asyncHandler(async (req, res) => {
  let mode = nInt(req.p.mode); if (mode === null) mode = 1;
  const ViewBag = {};
  try {
    const t = firstCol(await db.query(DB, 'select count(1) from tbl_matchmaster where isactive = 1', {}));
    ViewBag.TotalMatch = t === null ? 0 : Number(t);
    ViewBag.MatchRecord = mapRows(await db.query(DB, `select coalesce(frommatch, 0) as frommatch, coalesce(tomatch, 0) as tomatch,
      coalesce(multipletime, 0) as multipletime from tbl_matchscalegamesetting where active = 1`, {}), PROPS);
    return res.json({ view: '~/Views/AdminPanel/MatchWise_Scale_Game_Setting/Index.cshtml', ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'Index');
  }
}));

// ---------------------------------------------------------------- JsonResult MatchScaleSetting(string[] AllMatchValue)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/MatchScaleSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AllMatchValue = req.p.AllMatchValue;
  if (AllMatchValue === undefined) AllMatchValue = req.p['AllMatchValue[]'];
  if (AllMatchValue === undefined || AllMatchValue === null) throw nullRef();
  if (!Array.isArray(AllMatchValue)) AllMatchValue = [AllMatchValue];
  let Result = '';
  const JsonString = String(at(AllMatchValue, 0));
  // JavaScriptSerializer.Deserialize<MatchWiseSetting[]>(JsonString) (case-insensitive property names; missing => 0)
  const parsed = JSON.parse(JsonString);
  const pick = (o, name) => {
    const k = Object.keys(o || {}).find((x) => x.toLowerCase() === name.toLowerCase());
    return k === undefined || o[k] === null ? 0 : Number(o[k]);
  };
  const Match = parsed === null ? null : parsed.map((o) => ({ FromMatch: pick(o, 'FromMatch'), ToMatch: pick(o, 'ToMatch'), MultipleTime: pick(o, 'MultipleTime') }));
  if (Match === null) throw nullRef();
  for (let i = 0; i < Match.length; i++) {
    // USP_MATCHSCALESETTING @FROMMATCH,@TOMATCH,@MULTIPLETIME,@RESULT out
    const row = await db.procOne(DB, 'USP_MATCHSCALESETTING', { FROMMATCH: Match[i].FromMatch, TOMATCH: Match[i].ToMatch, MULTIPLETIME: Match[i].MultipleTime });
    Result = outStr(row, 'result');
  }
  return res.json(Result);
}));

module.exports = router;
