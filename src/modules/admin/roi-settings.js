'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ROI_SETTINGS.cs
// (class ROI_SETTINGSController => /admin/ROI_SETTINGS/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { optionalAuth } = require('../../middleware/auth');
const { adminAuth, isAdmin, getAdminMenu, errorInsert } = require('./_shared/admin-session');
const {
  DB, nstr, view, mapRows, mapRow, toInt32, toDec, reqInt, reqDouble, outStr, outRaw,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'ROI_SETTINGS';

/** class WalletTypeSet */
const WALLET_TYPE_SET_PROPS = ['ISVISIBLE', 'TWTID', 'WALLETTYPENAME', 'DISPLAYNAME', 'ROIINCOMEDISTRIBUTIONPERCENTAGE'];
/** class DeductionSetting */
const DEDUCTION_SETTING_PROPS = ['INT_ID', 'SECTION', 'SECTION_NAME', 'TDS_WITHKYC', 'INT_STATUS', 'DTM_DATE', 'DTM_UPDATE_DATE', 'TDS_WITHOUTKYC',
  'ADMINCHARGE_WITHKYC', 'ADMINCHARGE_WITHOUTKYC', 'DEDUCTION_TIME_ID', 'DEDUCTION_TIME_NAME', 'IS_VISIBLE', 'CreditedInWalletTypeName',
  'CreditedInWalletTypeid', 'IsWithdrawalIncome', 'TITLE', 'PLATFORM_CHARGE'];
/** class PackageRoiSettings */
const PACKAGE_ROI_PROPS = ['SNO', 'TSMID', 'SUBSCRIPTIONHEADING', 'Amount', 'ROIDISTRIBUTEDTYPETYPE', 'ROI_PERCENTAGEPERDAY', 'ROI_PERCENTAGEPERWEEK',
  'ROI_PERCENTAGEPERMONTH', 'WEEKSTARTDATE', 'ROINOTDISTRIBUTED', 'NOOFDAYWEEKMONTHROI', 'ROIMAXCAPPING', 'HOLD'];
/** class PackDetails */
const PACK_DETAILS_PROPS = ['KID', 'PCODE', 'TITLE', 'MININVESTMENT', 'MAXINVESTMENT', 'NOOFDAYSFORACTIVATION', 'SUBSCRIPTIONDETAILS', 'PackageColor',
  'AmountColor', 'ISACTIVE', 'MRP', 'SERVICE_TAX_PER', 'ISTRAILSUBSCRIPTION', 'PURCHASEPRICETYPE', 'IMAGE', 'PRICE', 'NETPAYABLE',
  'ROIDISTRIBUTEDTYPETYPE', 'ROI_PERCENTAGEPERDAY', 'ROI_PERCENTAGEPERWEEK', 'ROI_PERCENTAGEPERMONTH', 'ROINOTDISTRIBUTED', 'WEEKSTARTDATE',
  'NOOFDAYWEEKMONTHROI', 'ROIMAXCAPPING', 'HOLD', 'BVPERCENTAGE', 'CAPPING'];
// (class PackageDDL is an unused model)

// ---------------------------------------------------------------- Index(string sortOrder, string currentFilter, string searchString, string ddlOption, int? page, string btnexel)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/ROI-SETTINGS" -> ROI_SETTINGS/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ROI-SETTINGS'], adminAuth, asyncHandler(async (req, res) => {
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  // (sortOrder, currentFilter, searchString, ddlOption, page, btnexel are unused)
  const ViewBag = {};
  // (no try/catch in legacy: errors are unhandled => 500)
  const WalletTypeSet = mapRows(await db.query(DB,
    `select coalesce(isvisible, 0) as isvisible, twtid, coalesce(wallettypename, '') as wallettypename, coalesce(displayname, '') as displayname,
            coalesce(roiincomedistributionpercentage, 0.00) as roiincomedistributionpercentage
       from tbl_wallettype`, {}), WALLET_TYPE_SET_PROPS);
  if (WalletTypeSet !== null) ViewBag.WalletTypeSet = WalletTypeSet;
  const sm = await db.queryOne(DB,
    `select tsm.title, tds.*
       from tbl_submenu_memberpanel tsm
       inner join tds_section tds on tsm.sid = tds.menuid
      where tds.is_visible = 1 and tsm.status = 1 and section_name = 'Growth Bonus/ROI Section'
      limit 1`, {});
  ViewBag.SubMenuTitle = sm ? mapRow(sm, DEDUCTION_SETTING_PROPS) : null;
  const LiPackageRoiSettings = mapRows(await db.proc(DB, 'USP_PACKAGEROISETTINGS', { MODE: '1' }), PACKAGE_ROI_PROPS);
  return view(res, '~/Views/AdminPanel/ROI_SETTINGS/Index.cshtml', LiPackageRoiSettings, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult UPDATEROISETTINGS(int Packageid, string roitype, string roiperday, string roiperweek, string roipermonth, string ddlweetstartdate, string NOOFDAYSROI, string ROICAPPING, string HOLD, string ROINotDistributed)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UPDATEROISETTINGS{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Packageid = reqInt(req.p.Packageid, 'Packageid'); // model binding (before the try)
  const roitype = nstr(req.p.roitype);
  let roiperday = nstr(req.p.roiperday);
  let roiperweek = nstr(req.p.roiperweek);
  let roipermonth = nstr(req.p.roipermonth);
  let ddlweetstartdate = nstr(req.p.ddlweetstartdate);
  const NOOFDAYSROI = nstr(req.p.NOOFDAYSROI);
  const ROICAPPING = nstr(req.p.ROICAPPING);
  const HOLD = nstr(req.p.HOLD);
  const ROINotDistributed = nstr(req.p.ROINotDistributed);
  try {
    if (roiperday === '') roiperday = '0';
    if (roiperweek === '') roiperweek = '0';
    if (roipermonth === '') roipermonth = '0';
    if (ddlweetstartdate === '') ddlweetstartdate = '0';
    const rows = await db.proc(DB, 'USP_ROISETTINGS', {
      PACKAGEID: toInt32(Packageid), ROITYPE: roitype, ROIPERDAY: toDec(roiperday), ROIPERWEEK: toDec(roiperweek), ROIPERMONTH: toDec(roipermonth),
      DDLWEETSTARTDATE: ddlweetstartdate, NOOFDAYSROI: toInt32(NOOFDAYSROI), ROICAPPING: toInt32(ROICAPPING), HOLD: toInt32(HOLD),
      ROINOTDISTRIBUTED: ROINotDistributed, MODE: toInt32(1),
    });
    const stringret = outStr(outRaw(rows, 'STRRESULT'));
    return res.json(stringret);
  } catch (ex) {
    return res.json('Error occurred. Please try later' + ex.message);
  }
}));

// ---------------------------------------------------------------- JsonResult Getkitdetils(double Kid)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Getkitdetils{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Kid = reqDouble(req.p.Kid, 'Kid');
  // (no try/catch in legacy: errors are unhandled => 500)
  const rows = await db.proc(DB, 'USP_PACKAGEDETAILS', { KID: Kid });
  const kitdetilscla = rows.length ? mapRow(rows[0], PACK_DETAILS_PROPS) : null;
  if (kitdetilscla === null) return res.type('application/json').send(''); // Json(null) => empty body
  return res.json(kitdetilscla);
}));

// ---------------------------------------------------------------- JsonResult WALLETSETTINGS(int Walletid, decimal Credit)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/WALLETSETTINGS{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Walletid = reqInt(req.p.Walletid, 'Walletid');
  const Credit = reqDouble(req.p.Credit, 'Credit', 'System.Decimal');
  try {
    const rows = await db.proc(DB, 'USP_WALLETSETTINGS', { WALLETID: toInt32(Walletid), CREDIT: Credit, MODE: toInt32(1) });
    const stringret = outStr(outRaw(rows, 'STRRESULT'));
    return res.json(stringret);
  } catch (ex) {
    return res.json('Error occurred. Please try later');
  }
}));

/**
 * Legacy concatenated these values unquoted into the INSERT (numeric literals). The port binds them as parameters; a missing value
 * produced a T-SQL syntax error and a non-numeric one an invalid-column error => both throw here (=> catch, like legacy).
 */
function sqlLiteral(v) {
  if (v === null || v === undefined || String(v).trim() === '') throw new Error("Incorrect syntax near ','.");
  const s = String(v).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error(`Invalid column name '${s}'.`);
  return s;
}

// ---------------------------------------------------------------- JsonResult Updateincometype(string RID, ... , string Sectionname, string platformcharge)
// auth (Session["Admin_User"] == null => Json("Session Expired. Please login again"))
router.all(`/admin/${C}/Updateincometype{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  const P = (k) => nstr(req.p[k]);
  const RID = P('RID');
  const tdswithkyc = P('tdswithkyc');
  const deductiontime = P('deductiontime'); void deductiontime; // (legacy passed "" instead)
  const ddlStatus = P('ddlStatus'); void ddlStatus; // (legacy passed 1 instead)
  const TDSwithoutkyc = P('TDSwithoutkyc');
  const admincharge = P('admincharge');
  const adminchargewithoutkyc = P('adminchargewithoutkyc');
  const ddldeduction = P('ddldeduction');
  const mode = P('mode'); void mode; // (legacy passed 1 instead)
  const deductiontimename = P('deductiontimename');
  const iswithdrwaltype = P('iswithdrwaltype');
  const wallettypename = P('wallettypename');
  const Iswithdrwalincome = P('Iswithdrwalincome');
  const tdswithkyc1 = P('tdswithkyc1');
  const TDSwithoutkyc1 = P('TDSwithoutkyc1');
  const Iswithdrwalincome1 = P('Iswithdrwalincome1');
  const admincharge1 = P('admincharge1');
  const adminchargewithoutkyc1 = P('adminchargewithoutkyc1');
  const ddldeduction1 = P('ddldeduction1');
  const Sectionname = P('Sectionname');
  const platformcharge = P('platformcharge');
  // (ddlStatus1, deductiontime1, wallettypename1 are unused)
  try {
    const userid = req.user.emp_id;
    await db.exec(DB,
      `insert into tds_section_history (sectionname, tds_with_kyc, deductionname, tds_without_kyc, iswith_drwal_income, admin_charge,
                                        admin_charge_without_kyc, creditedin_wallet_id, userid, activityreport, status)
       values (@Sectionname, @tdswithkyc1::numeric, @ddldeduction1::varchar, @TDSwithoutkyc1::numeric, @Iswithdrwalincome1::numeric::int,
               @admincharge1::numeric, @adminchargewithoutkyc1::numeric, @iswithdrwaltype::numeric::int, @userid, now(), 1)`,
      {
        Sectionname: Sectionname === null ? '' : Sectionname, // legacy: '" + null + "' => ''
        tdswithkyc1: sqlLiteral(tdswithkyc1), ddldeduction1: sqlLiteral(ddldeduction1), TDSwithoutkyc1: sqlLiteral(TDSwithoutkyc1),
        Iswithdrwalincome1: sqlLiteral(Iswithdrwalincome1), admincharge1: sqlLiteral(admincharge1),
        adminchargewithoutkyc1: sqlLiteral(adminchargewithoutkyc1), iswithdrwaltype: sqlLiteral(iswithdrwaltype), userid,
      });
    const rows = await db.proc(DB, 'Usp_Update_Income_Deduction', {
      id: RID, tdswithkyc, ddlStatus: 1, deductiontime: '', TDSwithoutkyc, admincharge, adminchargewithoutkyc, iswithdrwaltype, wallettypename,
      ddldeduction, mode: 1, deductiontimename, Iswithdrwalincome, platformcharge,
    });
    const stringret = outStr(outRaw(rows, 'intResult'));
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_Update_Income_Deduction');
    return res.json('Error. Please try later');
  }
}));

module.exports = router;
