'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_Settings.cs (class Binary_SettingsController => /Binary_Settings/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, col, reqInt, netDateStr } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Binary_Settings';

/** class BinarySettingRecord */
const PROPS = ['SELFBV', 'DLBV', 'DRBV', 'DLMEMBER', 'DRMEMBER', 'MODIFYBY', 'MODIFYDATE', 'LASTUPDATEDDATE'];

// ---------------------------------------------------------------- Index()
// auth
// route-config: "AdminPanel/Binary-Settings" -> Binary_Settings/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Binary-Settings'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Count = Number(await db.scalar(DB, 'select count(payid) from payout', {})) || 0;
  ViewBag.Count = Count;
  const settings = mapRows(await db.proc(DB, 'USP_BINARYSETING_HISTORY', {}), PROPS);
  return res.json({ view: '~/Views/AdminPanel/Binary_Settings/Index.cshtml', Model: settings, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateBinarySettings(decimal SELFBV, decimal DLBV, decimal DRBV, int DLMEMBER, int DRMEMBER, int REQUIREDBV)
// auth (reads Session["Admin_User"] outside the try)
router.all(`/admin/${C}/UpdateBinarySettings{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SELFBV = reqInt(req.p.SELFBV, 'SELFBV', 'System.Decimal');
  const DLBV = reqInt(req.p.DLBV, 'DLBV', 'System.Decimal');
  const DRBV = reqInt(req.p.DRBV, 'DRBV', 'System.Decimal');
  const DLMEMBER = reqInt(req.p.DLMEMBER, 'DLMEMBER');
  const DRMEMBER = reqInt(req.p.DRMEMBER, 'DRMEMBER');
  const REQUIREDBV = reqInt(req.p.REQUIREDBV, 'REQUIREDBV');
  const Empid = req.user.emp_id;
  const MODIFYBY = Empid;
  let Result = 0;
  try {
    const Date_ = netDateStr(new Date()); // DateTime.Now.ToString()
    const row = await db.procOne(DB, 'USP_BINARYSETING', {
      EMPID: Empid, SELFBV, DLBV, DRBV, DLMEMBER, DRMEMBER, REQUIREDBV, MODIFYBY, MODIFYDATE: Date_,
    });
    const v = col(row, 'intresult');
    if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
    Result = parseInt(v, 10);
  } catch (ex) {
    // swallowed (legacy empty catch)
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult GetBinarySettingRecord()
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/GetBinarySettingRecord{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Empid = req.user.emp_id;
  // ISNULL(MODIFYDATE,'') => SQL Server '' as datetime = 1900-01-01
  const BinarySettingRecord = mapRows(await db.query(DB, `select coalesce(selfbv, 0) as selfbv, coalesce(dlbv, 0) as dlbv, coalesce(drbv, 0) as drbv,
    coalesce(dlmember, 0) as dlmember, coalesce(drmember, 0) as drmember, coalesce(modifyby, 0) as modifyby,
    coalesce(modifydate, '1900-01-01'::timestamp) as modifydate from tbl_binary_eligibility_setting where modifyby = @Empid`, { Empid }), PROPS);
  return res.json(BinarySettingRecord);
}));

module.exports = router;
