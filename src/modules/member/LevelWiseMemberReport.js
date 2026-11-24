'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/LevelWiseMemberReport.cs  (LevelWiseMemberReportController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/LevelWiseMemberReport';
const PROPS = ['RowNumber', 'Level', 'TotalRegisteredMember', 'TotalActiveMember', 'TotalBusinessVolume'];
const s = (v) => (v === undefined || v === null ? '' : String(v));
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index(int? page, string fromDate, string toDate)  [SessionExpireCheck]
// route-config: referral/J_plus_4FvJpj3jcsy5RKDx_plus_fgCoQjC9POkqinNhZhGZ0LWE=
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/J_plus_4FvJpj3jcsy5RKDx_plus_fgCoQjC9POkqinNhZhGZ0LWE='], auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize(); // MaxRows is read but unused by the C#
  let Obj = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // PORT-NOTE: @TotalMember / @InActiveMember / @ActiveMember / @BusinessVolume OUT are read from columns of the first result row ('' when no rows)
    const rows = await proc(DB, 'usp_levelwiseincomedetails', { plid: Plid });
    Obj = mapRows(rows, PROPS);
    ViewBag.totalmem = s(outv(rows[0], 'totalmember'));
    ViewBag.totalinactmem = s(outv(rows[0], 'inactivemember'));
    ViewBag.totalactmem = s(outv(rows[0], 'activemember'));
    ViewBag.totalbusiness = s(outv(rows[0], 'businessvolume'));
  } catch (ExpObj) {
    await errInsert(req, 'Usp_LevelWiseIncomeDetails', ExpObj);
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ view: '~/Views/CustomerPanel/LevelWiseMemberReport/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
