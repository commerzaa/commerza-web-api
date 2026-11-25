'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BINARYRate.cs (class BINARYRateController => /admin/BINARYRate/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { outVal, netDefault, reqNum, sp } = require('./_shared/batch04-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BINARYRate';

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/binary-Rate" -> BINARYRate/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/binary-Rate{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  // try/catch in legacy returned the same view in both branches
  res.json({ view: '~/Views/AdminPanel/BINARYRate/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult UpdateOrAddRoiSetting(string username, decimal DailyRate)
// auth (reads Session["Admin_User"] outside the try => NullReferenceException without a session)
router.all(`/admin/${C}/UpdateOrAddRoiSetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const username = sp(req, 'username');
  const DailyRate = reqNum(req, 'DailyRate', 'System.Decimal');
  let OutPutMessage = '';
  const Empid = req.user.emp_id; // eslint-disable-line no-unused-vars
  try {
    const loginID = req.user.emp_loginid; // eslint-disable-line no-unused-vars
    const Date_ = netDefault(new Date()); // DateTime.Now.ToString()
    const userid = req.user.emp_id;
    // USP_Binary_SETTING @usename,@DAILYRATE,@LASTUPDATE,@MODIFYBY,@INTRESULT OUT
    const rows = await db.proc(DB, 'USP_Binary_SETTING', { usename: username, DAILYRATE: DailyRate, LASTUPDATE: Date_, MODIFYBY: userid });
    const v = outVal(rows, 'INTRESULT');
    // Convert.ToInt32(IntResult.Value).ToString(): DBNull => InvalidCastException (caught below, "" returned)
    if (v === null || v === '') throw new Error('Object cannot be cast from DBNull to other types.');
    OutPutMessage = String(Math.round(Number(v)));
    return res.json(OutPutMessage);
  } catch (ex) {
    // legacy empty catch
  }
  return res.json(OutPutMessage);
}));

module.exports = router;
