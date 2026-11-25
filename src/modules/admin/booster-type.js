'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Booster_Type.cs (class Booster_TypeController => /admin/Booster_Type/...)
// Database: affiliate (Db_Affiliate). Model class BoosterType (same file) => BT_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { str, sp, outVal, reqNum } = require('./_shared/batch04-b-common');
const { cvInt, cvDec } = require('./_shared/batch04-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Booster_Type';

const BT_PROPS = ['ROWNUMBER', 'RBSID', 'BOOSTERTYPE', 'REQUIREDDAYS', 'REQUIREDMEMBER', 'TOTALMEMBERDOWNLINE', 'LEFTMEMBER', 'RIGHTMEMBER', 'INCRESE',
  'INCRESEPERCENTAGE', 'NOOFDAYS', 'ROITILL', 'EMPID', 'LastUpdate', 'Active', 'Status', 'PACKAGETYPE'];

// T-SQL isnull(LastUpdate,'') on a datetime => 1900-01-01
const COLS = `coalesce(roitype,'0') as boostertype, coalesce(withindays,0) as requireddays, coalesce(requiredmember,0) as requiredmember,
  coalesce(totalmemberdownline,0) as totalmemberdownline, coalesce(leftmember,0) as leftmember, coalesce(rightmember,0) as rightmember,
  coalesce(increse,0) as increse, coalesce(roiper,0.00) as incresepercentage`;
const COLS2 = `coalesce(returnvalue,'') as roitill, coalesce(empid,0) as empid, coalesce(lastupdate,'1900-01-01'::timestamp) as lastupdate, active, status`;

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Booster-Type" -> Booster_Type/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Booster-Type{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const Empid = req.user.emp_code; // ((Employee_Master)Session["Admin_User"]).Emp_Code
  const empid = cvInt(Empid); // Convert.ToInt64(Empid) (concatenated into the SQL in legacy; parameterised here)
  const ViewBag = {};
  const BoosterType = mapRows(await db.query(DB, `select row_number() over (order by rbsid asc) as rownumber, rbsid, ${COLS},
      coalesce(noofdays,0) as noofdays, ${COLS2}, coalesce(packagetype,'') as packagetype
    from tbl_booster_setting where empid = @empid`, { empid }), BT_PROPS);
  const BoosterHistory = mapRows(await db.query(DB, `select row_number() over (order by rbsid desc) as rownumber, ${COLS},
      (coalesce(noofdays,0))::numeric(18,0) as noofdays, ${COLS2}, coalesce(packagetype,'') as packagetype
    from tbl_booster_setting_history where empid = @empid`, { empid }), BT_PROPS);
  if (BoosterHistory !== null) ViewBag.BoosterHistory = BoosterHistory;
  res.json({ view: '~/Views/AdminPanel/Booster_Type/Index.cshtml', Model: BoosterType, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult InsertUpdateBoosterType(string BoosterType, string RequiredDays, string RequiredMember, string TotaldMember, string LeftMember, string RightMember, string Increse, string PercentageIncrese, string NoOfDays, string MaxReturn, int RBSID, string PackageType, string ddlactive)
// auth (reads Session["Admin_User"] before the try)
router.all(`/admin/${C}/InsertUpdateBoosterType{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let BoosterType = sp(req, 'BoosterType');
  let RequiredDays = sp(req, 'RequiredDays');
  let RequiredMember = sp(req, 'RequiredMember');
  let TotaldMember = sp(req, 'TotaldMember');
  let LeftMember = sp(req, 'LeftMember');
  let RightMember = sp(req, 'RightMember');
  let Increse = sp(req, 'Increse');
  let PercentageIncrese = sp(req, 'PercentageIncrese');
  let NoOfDays = sp(req, 'NoOfDays');
  let MaxReturn = sp(req, 'MaxReturn');
  const RBSID = reqNum(req, 'RBSID');
  let PackageType = sp(req, 'PackageType');
  const ddlactive = sp(req, 'ddlactive');
  const Empid = req.user.emp_code;
  try {
    // (MVC binds "" as null, so these "" checks only matter for raw values; Convert.ToInt32(null) == 0 anyway)
    if (BoosterType === '') BoosterType = '0';
    if (RequiredDays === '') RequiredDays = '0';
    if (RequiredMember === '') RequiredMember = '0';
    if (TotaldMember === '') TotaldMember = '0';
    if (LeftMember === '') LeftMember = '0';
    if (RightMember === '') RightMember = '0';
    if (Increse === '') Increse = '0';
    if (PercentageIncrese === '') PercentageIncrese = '0';
    if (NoOfDays === '') NoOfDays = '0';
    if (MaxReturn === '') MaxReturn = '0';
    if (PackageType === '') PackageType = '0';
    // [USP_BOOSTERSETTING] @EMPID,@RBSID,@BOOSTERTYPE,@REQUIREDDAYS,@REQUIREDMEMBER,@TOTALDOWNLINEMEMBER,@LEFTMEMBER,@RIGHTMEMBER,@INCRESE,@PERCENTAGEINCRESE,@NOOFDAYS,@ROITILL,@PACKAGETYPE,@STRRESULT out,@ACTIVE
    // PORT-NOTE: a null PackageType was an unsupplied SqlParameter in legacy (SqlException => caught); NULL is passed here.
    const rows = await db.proc(DB, 'USP_BOOSTERSETTING', {
      EMPID: cvInt(Empid), RBSID: RBSID === 0 ? 0 : RBSID, BOOSTERTYPE: cvInt(BoosterType), REQUIREDDAYS: cvInt(RequiredDays),
      REQUIREDMEMBER: cvInt(RequiredMember), TOTALDOWNLINEMEMBER: cvInt(TotaldMember), LEFTMEMBER: cvInt(LeftMember), RIGHTMEMBER: cvInt(RightMember),
      INCRESE: cvInt(Increse), PERCENTAGEINCRESE: cvDec(PercentageIncrese), NOOFDAYS: cvDec(NoOfDays), ROITILL: cvInt(MaxReturn), PACKAGETYPE: PackageType,
      ACTIVE: cvInt(ddlactive),
    });
    const stringret = str(outVal(rows, 'STRRESULT'));
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_BOOSTERSETTING');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult Editboottertype(string RBSID)
// auth (PORT-NOTE: legacy had no session check; admin booster configuration => adminAuth)
router.all(`/admin/${C}/Editboottertype{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RBSID = sp(req, 'RBSID');
  let Data = '';
  // legacy concatenated Convert.ToInt64(RBSID) into the SQL - parameterised here
  const rows = await db.query(DB, `select row_number() over (order by rbsid asc) as rownumber, rbsid, ${COLS},
      coalesce(noofdays,0) as noofdays, ${COLS2}, packagetype
    from tbl_booster_setting where rbsid = @rbsid`, { rbsid: cvInt(RBSID) });
  const ss = mapRows(rows, BT_PROPS);
  if (ss.length === 0) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
  const s0 = ss[0];
  const t = (v) => (v === null || v === undefined ? '' : String(v)); // string concatenation of null => ""
  Data = `${t(s0.BOOSTERTYPE)},${t(s0.REQUIREDDAYS)},${t(s0.REQUIREDMEMBER)},${t(s0.INCRESE)},${t(s0.ROITILL)},${t(s0.TOTALMEMBERDOWNLINE)},${t(s0.LEFTMEMBER)},`
    + `${t(s0.RIGHTMEMBER)},${t(s0.INCRESEPERCENTAGE)},${t(s0.NOOFDAYS)},${t(s0.PACKAGETYPE)},${t(s0.Active)}`;
  res.json(Data);
}));

module.exports = router;
