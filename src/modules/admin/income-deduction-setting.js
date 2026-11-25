'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Income_Deduction_Setting.cs
// (class Income_Deduction_SettingController => /admin/Income_Deduction_Setting/...). Database: affiliate (Db_Affiliate).
// The file also declares `public class SubMenuTitleWithIncomeDeduction` (model => SUBMENU_PROPS).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { optionalAuth } = require('../../middleware/auth');
const { mapRows } = require('../../utils/shape');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Income_Deduction_Setting';

/** class SubMenuTitleWithIncomeDeduction */
const SUBMENU_PROPS = ['INT_ID', 'SECTION', 'SECTION_NAME', 'TDS_WITHKYC', 'INT_STATUS', 'DTM_DATE', 'DTM_UPDATE_DATE', 'TDS_WITHOUTKYC',
  'ADMINCHARGE_WITHKYC', 'ADMINCHARGE_WITHOUTKYC', 'DEDUCTION_TIME_ID', 'DEDUCTION_TIME_NAME', 'IS_VISIBLE', 'CreditedInWalletTypeName',
  'CreditedInWalletTypeid', 'IsWithdrawalIncome', 'TITLE'];

const SESSION_EXPIRED = 'Session Expired. Please login again';

/** C# decimal.ToString() keeps the column scale (pg numerics arrive as JS numbers) */
function decStr(v, scale) {
  if (v === null || v === undefined) throw new Error('The cast to value type \'System.Decimal\' failed because the materialized value is null.');
  return Number(v).toFixed(scale);
}
function intVal(v) {
  if (v === null || v === undefined) throw new Error('The cast to value type \'System.Int32\' failed because the materialized value is null.');
  return Number(v);
}
/** a request value concatenated into the legacy INSERT as a numeric SQL literal (empty / non-numeric => SQL syntax error) */
function sqlNum(v) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error("Incorrect syntax near ','.");
  return s;
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (legacy had no session check; admin settings page => protected)
// route-config: "AdminPanel/income-deduction-setting" -> Income_Deduction_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/income-deduction-setting'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // select count(PAYID) from PAYOUT
  const Count = Number(await db.scalar(DB, 'select count(payid) from payout', {})) || 0;
  ViewBag.Count = Count;
  const SubMenuTitle = mapRows(await db.proc(DB, 'USP_GETSUBMENUTITLEBYSID', {}), SUBMENU_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Income_Deduction_Setting/Index.cshtml', Model: SubMenuTitle, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Show_Hide_Tds(int id, int value, int mode)
// auth (optionalAuth + legacy "Session Expired. Please login again" JSON)
router.all(`/admin/${C}/Show_Hide_Tds{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const id = B.reqInt(req.p.id, 'id');
  const value = B.reqInt(req.p.value, 'value');
  const mode = B.reqInt(req.p.mode, 'mode');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    const Empid = req.user.emp_id;
    // Usp_Update_Income_Deduction @id,@value,@mode,@incometype,@tds,@admincharge,@tdssection,@Empid,@intResult out
    const r = await db.procOne(DB, 'Usp_Update_Income_Deduction', {
      id, value, mode, incometype: '', tds: 0, admincharge: 0, tdssection: 0, Empid,
    });
    const stringret = B.str(B.col(r, 'intResult'));
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_Update_Income_Deduction');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult Edit_Data(int RID)
// auth (optionalAuth + legacy "Session Expired. Please login again" JSON)
router.all(`/admin/${C}/Edit_Data{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const RID = B.reqInt(req.p.RID, 'RID');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    let stringret = '';
    let TdsWithKYC = '0'; let TdsWithoutKyc = '0'; let AdminchargeWithkyc = '0'; let Adminchargewithoutkyc = '0'; const Incomepercentage = '0';
    let Status = 0; let DeductionTimeId = 0;
    let DtmUpdatedate = '';
    let CreditedInWalletTypeid = 0; let IsWithdrawalIncome = 0;
    let sectionname = '';
    // db._Income_Deduction.Where(a => a.INT_ID == RID).FirstOrDefault()  (table TDS_SECTION)
    const row = await db.queryOne(DB, 'select * from tds_section where int_id = @RID limit 1', { RID });
    if (row) {
      TdsWithKYC = decStr(B.col(row, 'tds_withkyc'), 8);
      TdsWithoutKyc = decStr(B.col(row, 'tds_withoutkyc'), 2);
      AdminchargeWithkyc = decStr(B.col(row, 'admincharge_withkyc'), 8);
      Adminchargewithoutkyc = decStr(B.col(row, 'admincharge_withoutkyc'), 8);
      Status = intVal(B.col(row, 'int_status'));
      DeductionTimeId = intVal(B.col(row, 'deduction_time_id'));
      DtmUpdatedate = B.netFormat(B.col(row, 'dtm_update_date'), 'MM/dd/yyyy');
      CreditedInWalletTypeid = intVal(B.col(row, 'creditedinwallettypeid'));
      IsWithdrawalIncome = intVal(B.col(row, 'iswithdrawalincome'));
      sectionname = B.col(row, 'section_name');
    }
    const s = (x) => (x === null || x === undefined ? '' : String(x));
    stringret = stringret + '^' + 'Success' + '^' + TdsWithKYC + '^' + TdsWithoutKyc + '^' + AdminchargeWithkyc + '^' + Adminchargewithoutkyc + '^'
      + Incomepercentage + '^' + Status + '^' + DeductionTimeId + '^' + DtmUpdatedate + '^' + CreditedInWalletTypeid + '^' + IsWithdrawalIncome + '^'
      + s(sectionname);
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Edit_Data');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult GetDiscriptionById(int id)
// auth (legacy had no session check; admin settings data => protected)
router.all(`/admin/${C}/GetDiscriptionById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const id = B.reqInt(req.p.id, 'id');
  // db._WalletType.Where(a => a.TWTID == id).Select(a => a.Description).FirstOrDefault()
  const r = await db.queryOne(DB, 'select description from tbl_wallettype where twtid = @id limit 1', { id });
  const discript = r ? B.col(r, 'description') : null;
  return res.json(discript === undefined ? null : discript);
}));

// ---------------------------------------------------------------- JsonResult Updateincometype(...23 string params)
// auth (optionalAuth + legacy "Session Expired. Please login again" JSON)
router.all(`/admin/${C}/Updateincometype{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    const userid = req.user.emp_id;
    // Insert into TDS_SECTION_HISTORY (...) values('<Sectionname>',<tdswithkyc1>,<ddldeduction1>,<TDSwithoutkyc1>,<Iswithdrwalincome1>,<admincharge1>,
    //   <adminchargewithoutkyc1>,<wallettypename1>,<userid>,Getdate(),1)   (parameterised; values were concatenated as SQL literals)
    // PORT-NOTE: the legacy concatenated ddldeduction1 unquoted into varchar DeductionName (numeric literal => converted text); kept numeric-only.
    const n = {
      tdswithkyc1: sqlNum(v('tdswithkyc1')), ddldeduction1: sqlNum(v('ddldeduction1')), TDSwithoutkyc1: sqlNum(v('TDSwithoutkyc1')),
      Iswithdrwalincome1: sqlNum(v('Iswithdrwalincome1')), admincharge1: sqlNum(v('admincharge1')),
      adminchargewithoutkyc1: sqlNum(v('adminchargewithoutkyc1')), wallettypename1: sqlNum(v('wallettypename1')),
    };
    await db.exec(DB, `insert into tds_section_history (sectionname, tds_with_kyc, deductionname, tds_without_kyc, iswith_drwal_income, admin_charge,
        admin_charge_without_kyc, creditedin_wallet_id, userid, activityreport, status)
      values (@Sectionname, cast(@tdswithkyc1 as numeric), cast(@ddldeduction1 as numeric)::text, cast(@TDSwithoutkyc1 as numeric),
        cast(cast(@Iswithdrwalincome1 as numeric) as int), cast(@admincharge1 as numeric), cast(@adminchargewithoutkyc1 as numeric),
        cast(cast(@wallettypename1 as numeric) as int), @userid, now(), 1)`,
    { Sectionname: v('Sectionname') === null ? '' : v('Sectionname'), ...n, userid });
    // Usp_Update_Income_Deduction @id,@tdswithkyc,@ddlStatus,@deductiontime,@TDSwithoutkyc,@admincharge,@adminchargewithoutkyc,@ddldeduction,@mode,
    //   @deductiontimename,@wallettypename,@iswithdrwaltype,@Iswithdrwalincome,@intResult out
    const r = await db.procOne(DB, 'Usp_Update_Income_Deduction', {
      id: v('RID'), tdswithkyc: v('tdswithkyc'), ddlStatus: 1, deductiontime: v('deductiontime'), TDSwithoutkyc: v('TDSwithoutkyc'),
      admincharge: v('admincharge'), adminchargewithoutkyc: v('adminchargewithoutkyc'), iswithdrwaltype: v('iswithdrwaltype'),
      wallettypename: v('wallettypename'), ddldeduction: v('ddldeduction'), mode: 1, deductiontimename: v('deductiontimename'),
      Iswithdrwalincome: v('Iswithdrwalincome'),
    });
    // (bound but unused by the legacy body: ddlStatus (1 is passed), mode (1 is passed), ddlStatus1, deductiontime1)
    const stringret = B.str(B.col(r, 'intResult'));
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_Update_Income_Deduction');
    return res.json('Error. Please try later');
  }
}));

module.exports = router;
