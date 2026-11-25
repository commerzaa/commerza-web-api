'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Registration_Plan_Setting.cs (class Registration_Plan_SettingController => /admin/Registration_Plan_Setting/...)
// Database: affiliate (Db_Affiliate). Proc: USP_JOININGPHASESETTINGS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, reqInt, outStr } = require('./_shared/batch12-common');

const router = express.Router();
const C = 'Registration_Plan_Setting';

/** class PLANSETTING */
const PLANSETTING_PROPS = ['SINGLELEGSTATUS', 'ISSINGLELEGWIDTHFIX', 'SINGLELEGWIDTH', 'AUTOFILLONEBYONEMATRIXSTATUS', 'ISAUTOFILLONEBYONEMATRIXWIDTHFIX',
  'AUTOFILLONEBYONEMATRIXWIDTH', 'AUTOFILLMATRIXWITHOUTCROSSLEGSTATUS', 'ISAUTOFILLMATRIXWITHOUTCROSSLEGWIDTHFIX', 'AUTOFILLMATRIXWITHOUTCROSSLEGWIDTH',
  'AUTOFILLMATRIXWITHCROSSLEGSTATUS', 'ISAUTOFILLMATRIXWITHCROSSLEGWIDTHFIX', 'AUTOFILLMATRIXWITHCROSSLEGWIDTH', 'MULTIBOARDSTATUS', 'ISMULTIBOARDWIDTHFIX',
  'MULTIBOARDWIDTH', 'MATRIXSTATUS', 'ISMATRIXWIDTHFIX', 'MATRIXWIDTH', 'BINARYSTATUS', 'BINARYDEFAULTSIDE', 'LASTUPDATEDDATE', 'LASTUPDATEDBYEMPID',
  'LASTUPDATEDBYEMPNAME', 'ISACTIVE'];

/** [USP_JOININGPHASESETTINGS] @MODE,@SingleLegStatus,...,@LastUpdatedByEmpName,@Stroutput OUT */
const planParams = (MODE, v, LastUpdatedByEmpid, LastUpdatedByEmpName) => ({
  MODE,
  SingleLegStatus: v[0], IsSingleLegWidthFix: v[1], SingleLegWidth: v[2],
  AutoFillOneByOneMatrixStatus: v[3], IsAutoFillOneByOneMatrixWidthFix: v[4], AutoFillOneByOneMatrixWidth: v[5],
  AutoFillMatrixWithoutCrossLegStatus: v[6], IsAutoFillMatrixWithoutCrossLegWidthFix: v[7], AutoFillMatrixWithoutCrossLegWidth: v[8],
  AutoFillMatrixWithCrossLegStatus: v[9], IsAutoFillMatrixWithCrossLegWidthFix: v[10], AutoFillMatrixWithCrossLegWidth: v[11],
  MultiBoardStatus: v[12], IsMultiBoardWidthFix: v[13], MultiBoardWidth: v[14],
  MatrixStatus: v[15], IsMatrixWidthFix: v[16], MatrixWidth: v[17],
  BinaryStatus: v[18], BinaryDefaultSide: v[19],
  LastUpdatedByEmpid, LastUpdatedByEmpName,
});

// ---------------------------------------------------------------- ActionResult Index()
// auth (legacy had no session check; admin settings => adminAuth)
// route-config: "AdminPanel/Registration-Plan-Setting" -> Registration_Plan_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Registration-Plan-Setting'], adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_JOININGPHASESETTINGS', planParams(1, new Array(20).fill(0), 0, ''));
  const PLANSETTING = mapRows(rows, PLANSETTING_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Registration_Plan_Setting/Index.cshtml', Model: PLANSETTING });
}));

const UPDATE_PLAN_ARGS = ['ddlsinglelegplanstatus', 'ddlsinglelegwidthfix', 'txtsinglelegwidth', 'ddlautofillonebyoneplanstatus', 'ddlautofillonebyonewidthfix',
  'txtautofillonebyonewidth', 'ddlautofillmatrixwithoutcrosslegplanstatus', 'ddlautofillmatrixwithoutcrosslegwidthfix', 'txtautofillmatrixwithoutcrossllegwidth',
  'ddlautofillmatrixwithcrosslegplanstatus', 'ddlautofillmatrixwithcrosslegwidthfix', 'txtautofillmatrixwithcrossllegwidth', 'ddlboardplanstatus',
  'ddlboardplanwidthfix', 'txtboardplanwidth', 'ddlmatrixlevelplanstatus', 'ddlmatrixlevelplanwidthfix', 'txtmatrixlevelplanwidth', 'ddlbinaryplanstatus',
  'txtbinaryplanside'];

// ---------------------------------------------------------------- JsonResult UpdatePlan(int ddlsinglelegplanstatus, ... , int txtbinaryplanside)  (20 non-nullable ints)
// auth (reads Session["Admin_User"].Emp_ID / Emp_Name)
router.all(`/admin/${C}/UpdatePlan{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = UPDATE_PLAN_ARGS.map((n) => reqInt(req.p[n], n));
  const Eid = req.user.emp_id;
  let Emp_Name = req.user.emp_name;
  if (Emp_Name === null || Emp_Name === undefined) Emp_Name = '';
  const row = await db.procOne(DB, 'USP_JOININGPHASESETTINGS', planParams(2, v, Eid, Emp_Name));
  const OutputResult = outStr(row, 'Stroutput'); // spOutput.Value.ToString()
  return res.json(OutputResult);
}));

module.exports = router;
