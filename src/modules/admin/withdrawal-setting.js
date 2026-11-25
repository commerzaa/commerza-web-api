'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\WithdrawalSetting.cs (class WithdrawalSettingController => /admin/WithdrawalSetting/...)
// Database: affiliate (Db_Affiliate). Table: settings.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'WithdrawalSetting';

/** class Withdrwal */
const WITHDRWAL_PROPS = ['Row', 'THOAWSID', 'MinWithdrawal', 'MaxWithdrawal', 'Emp_Name', 'ActivityReport'];

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Withdrawal" -> WithdrawalSetting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Withdrawal'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  try {
    // SELECT ACTIVE from SETTINGS where CAPTION='IsBtcWithdrawalUniqueOrNot'  (FirstOrDefault; null row => NullReferenceException)
    const Row = await db.queryOne(DB, "select active from settings where caption = 'IsBtcWithdrawalUniqueOrNot' limit 1", {});
    if (!Row) throw B.nullRef();
    const a = Row.active;
    if (a === true || a === 1 || a === '1') ViewBag.Row = 1; else ViewBag.Row = 0;
    const Withdrwal = mapRows(await db.proc(DB, 'Usp_ManageATCANDWithDrawalSettings', { Mode: '3' }), WITHDRWAL_PROPS);
    return res.json({ view: '~/Views/AdminPanel/WithdrawalSetting/Index.cshtml', Model: Withdrwal, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_ManageATCANDWithDrawalSettings');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateATCRateAndWithdrawalSettings(string MinWithdrawal, string MaxWithdrawal, string AdminWithKyc, string TDSWithkyc,
//   string AdminWithoutKyc, string TDSWithoutkyc, string processingfee, string startEnd, string multipleof, string noofdaydiff, string withdrawalday, string nooflineday, string KYC)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateATCRateAndWithdrawalSettings{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const userid = req.user.emp_id;
  // [Usp_ManageATCANDWithDrawalSettings] @MinWithdrawal,@MaxWithdrawal,@UserId,@Mode,@IntResult OUT,@AdminWithKyc,@TDSWithkyc,@AdminWithoutKyc,
  //   @TDSWithoutkyc,@processingfee,@startEnd,@multipleof,@noofdaydiff,@withdrawalday,@nooflineday,@KYC
  const params = {
    MinWithdrawal: B.cvtDec(s('MinWithdrawal')),
    MaxWithdrawal: B.cvtDec(s('MaxWithdrawal')),
    UserId: userid,
    Mode: '2',
    AdminWithKyc: B.cvtDec(s('AdminWithKyc')),
    TDSWithkyc: B.cvtDec(s('TDSWithkyc')),
    AdminWithoutKyc: B.cvtDec(s('AdminWithoutKyc')),
    TDSWithoutkyc: B.cvtDec(s('TDSWithoutkyc')),
    processingfee: B.cvtDec(s('processingfee')),
    startEnd: B.cvtInt(s('startEnd')),
    multipleof: B.cvtDec(s('multipleof')),
    noofdaydiff: B.cvtInt(s('noofdaydiff')),
    withdrawalday: s('withdrawalday'),
    nooflineday: B.cvtInt(s('nooflineday')),
    KYC: B.cvtInt(s('KYC')),
  };
  const row = await db.procOne(DB, 'Usp_ManageATCANDWithDrawalSettings', params);
  const OutPutMessage = B.outStr(row, 'intresult');
  return res.json(OutPutMessage);
}));

// ---------------------------------------------------------------- JsonResult UpdateBtcWithdrawalUnique(string Active)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateBtcWithdrawalUnique{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Active = B.nStr(req.p.Active);
  void req.user.emp_id; // int userid = Session["Admin_User"].Emp_ID (unused)
  // "update SETTINGS Set ACTIVE=" + Active + " where CAPTION='IsBtcWithdrawalUniqueOrNot'"
  // PORT-NOTE: parameterised (legacy concatenated the value: SQL injection). A non-numeric value made the T-SQL fail (500); the bound value
  // is cast to int then to the bit/boolean column, which fails the same way.
  const ret = await db.exec(DB,
    "update settings set active = ((@Active)::int <> 0) where caption = 'IsBtcWithdrawalUniqueOrNot'", { Active });
  return res.json(ret);
}));

module.exports = router;
