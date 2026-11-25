'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_Setting.cs (class Binary_SettingController => /Binary_Setting/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const { adminAuth, getAdminMenu } = require('./_shared/adminSession');
const { DB, col, str, sv, reqInt, toInt32, toDecimal } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Binary_Setting';

/** class PackageBinarySettings */
const PROPS = ['SNO', 'TSMID', 'SUBSCRIPTIONHEADING', 'Amount', 'BVTYPE', 'BV', 'CAPPINGTYPE', 'CAPPINGS', 'BINARYINCOMETYPE', 'BINARY'];
/** class WalletTypeSet (ROI_SETTINGS.cs) */
const WALLETTYPESET_PROPS = ['ISVISIBLE', 'TWTID', 'WALLETTYPENAME', 'DISPLAYNAME', 'ROIINCOMEDISTRIBUTIONPERCENTAGE'];
/** class DeductionSetting (ROI_SETTINGS.cs) */
const DEDUCTIONSETTING_PROPS = ['INT_ID', 'SECTION', 'SECTION_NAME', 'TDS_WITHKYC', 'INT_STATUS', 'DTM_DATE', 'DTM_UPDATE_DATE', 'TDS_WITHOUTKYC',
  'ADMINCHARGE_WITHKYC', 'ADMINCHARGE_WITHOUTKYC', 'DEDUCTION_TIME_ID', 'DEDUCTION_TIME_NAME', 'IS_VISIBLE', 'CreditedInWalletTypeName',
  'CreditedInWalletTypeid', 'IsWithdrawalIncome', 'TITLE', 'PLATFORM_CHARGE'];

// ---------------------------------------------------------------- Index(string sortOrder, string currentFilter, string searchString, string ddlOption, int? page, string btnexel)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Binary-Setting" -> Binary_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Binary-Setting'], adminAuth, asyncHandler(async (req, res) => {
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  const ViewBag = {};
  const WalletTypeSet = mapRows(await db.query(DB, `select twtid, coalesce(wallettypename, '') as wallettypename, coalesce(displayname, '') as displayname,
    coalesce(roiincomedistributionpercentage, 0.00) as roiincomedistributionpercentage from tbl_wallettype where isvisible = 1`, {}), WALLETTYPESET_PROPS);
  if (WalletTypeSet !== null) ViewBag.WalletTypeSet = WalletTypeSet;
  const st = await db.queryOne(DB, `select tsm.title, tds.* from tbl_submenu_memberpanel tsm inner join tds_section tds on tsm.sid = tds.menuid
    where tds.is_visible = 1 and tsm.status = 1 and section_name = 'Growth Bonus/ROI Section' limit 1`, {});
  ViewBag.SubMenuTitle = st ? mapRow(st, DEDUCTIONSETTING_PROPS) : null;
  const LiPackageBinarySettings = mapRows(await db.proc(DB, 'USP_PACKAGEBINARYSETTINGS', { MODE: '1', TSMID: '0' }), PROPS);
  return res.json({ view: '~/Views/AdminPanel/Binary_Setting/Index.cshtml', Model: LiPackageBinarySettings, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UPDATEBINARYSETTINGS(int Packageid, string BvType, string Bv, string TaxIncludeStatus, string CappingType, string Cappings, string BinaryIncomeType, string Binary)
// auth (reads Session["Admin_User"]; legacy NullReference was caught => "Error occurred. Please try later ...")
router.all(`/admin/${C}/UPDATEBINARYSETTINGS{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Packageid = reqInt(req.p.Packageid, 'Packageid');
  const BvType = sv(req.p.BvType);
  const Bv = sv(req.p.Bv);
  const TaxIncludeStatus = sv(req.p.TaxIncludeStatus);
  const CappingType = sv(req.p.CappingType);
  const Cappings = sv(req.p.Cappings);
  const BinaryIncomeType = sv(req.p.BinaryIncomeType);
  const Binary = sv(req.p.Binary);
  try {
    if (BvType === '0') return res.json('Select Binary Volume Type ! ');
    if (Bv === '') return res.json('Enter Business Volume (BV) ! ');
    if (CappingType === '0') return res.json('Select Capping Type ! ');
    if (Cappings === '') return res.json('Enter Capping  ! ');
    if (BinaryIncomeType === '0') return res.json('Select Binary Income Type ! ');
    if (Binary === '') return res.json('Enter Binary  ! ');
    const row = await db.procOne(DB, 'USP_BINARYSETTINGS', {
      PACKAGEID: Packageid, BvType: toInt32(BvType), Bv: toDecimal(Bv), TaxIncludeStatus: toInt32(TaxIncludeStatus), CappingType: toInt32(CappingType),
      Cappings: toDecimal(Cappings), BinaryIncomeType: toInt32(BinaryIncomeType), Binary: toDecimal(Binary), UPDATEDBY: req.user.emp_id, MODE: 1,
    });
    const stringret = str(col(row, 'strresult'));
    return res.json(stringret);
  } catch (ex) {
    return res.json('Error occurred. Please try later ' + ex.message);
  }
}));

// ---------------------------------------------------------------- JsonResult PackageEdit(string TSMID)
// public (legacy had no session check; read-only package binary setting)
router.all(`/admin/${C}/PackageEdit{/:id}`, asyncHandler(async (req, res) => {
  let Message = '';
  try {
    const ConvTSMID = toInt32(sv(req.p.TSMID));
    const r = await db.procOne(DB, 'USP_PACKAGEBINARYSETTINGS', { MODE: '2', TSMID: ConvTSMID });
    if (r) return res.json(mapRow(r, PROPS));
    Message = 'Some Error Occured !';
    return res.json(Message);
  } catch (Ex) {
    Message = Ex.message;
    return res.json(Message);
  }
}));

module.exports = router;
