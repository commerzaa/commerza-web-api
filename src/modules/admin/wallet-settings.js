'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Wallet_Settings.cs (class Wallet_SettingsController => /admin/Wallet_Settings/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Roll_master = require('../../lib/admin/Roll_master');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'Wallet_Settings';

/** class Wallet_Settings */
const WALLET_SETTINGS_PROPS = ['rowNumber', 'WalletTypeName', 'Description', 'DISPLAYNAME', 'STATUS', 'IsVisible', 'Active',
  'BINARYINCOMEDISTRIBUTIONPERCENTAGE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

// PORT-NOTE: the legacy ExportReport passes the same SqlParameter object (spOutput, "@TotalCount") twice to
// SqlQuery("USP_WALLET_SETTINGS ..."), so ADO.NET always threw ArgumentException ("The SqlParameter is already contained by another
// SqlParameterCollection.") when the query ran (after usp_GetBranch / AllAciveRoleList). That exception was not caught, so every
// export (and Index with btnexel = "Export Excel") ended in a 500. Reproduced; the export writer below is kept for completeness.
const LEGACY_EXPORT_QUERY_THROWS = true;

// public void ExportReport(string SearchField, string SearchValue)
async function ExportReport(req, res, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Wallet_Settings' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  // dbo.usp_GetBranch (List<Wallet_Settings>)
  ViewBag.Empbranch = mapRows(await db.proc(DB, 'usp_GetBranch', {}), WALLET_SETTINGS_PROPS);
  const rm = new Roll_master();
  ViewBag.rolMaster = await rm.AllAciveRoleList();
  if (LEGACY_EXPORT_QUERY_THROWS) {
    throw new Error('The SqlParameter is already contained by another SqlParameterCollection.');
  }
  // (unreachable in legacy) USP_WALLET_SETTINGS @TWTID=0,@DisplayName='',@BinayIncomePercent=0,@IsVisible=0,@MODE=2,...,@StartRowIndex=1,
  // @MaxRows=999999,@SearchField (sic: the batch text names @SearchFeild),@SearchValue
  const AllEmplist = mapRows(await db.proc(DB, 'USP_WALLET_SETTINGS', {
    TWTID: 0, DisplayName: '', BinayIncomePercent: 0, IsVisible: 0, MODE: 2, StartRowIndex: 1, MaxRows: 999999,
    SearchFeild: B.trimS(SearchField), SearchValue: B.trimS(SearchValue),
  }), WALLET_SETTINGS_PROPS);
  if (AllEmplist.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'EmployeeList.xls', Filename,
      rawHeaders: 'S.No. \tWallet Type \tDescription\tStatus \t',
      rows: AllEmplist, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'rowNumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'WalletTypeName')) + ' \t');
        w(B.tab(B.cellStr(item, 'Description')) + ' \t');
        w(B.tab(B.cellStr(item, 'STATUS')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? page, int? dynamicpagging, string SearchField, string SearchValue, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Wallet-Settings" -> Wallet_Settings/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Wallet-Settings'], adminAuth, asyncHandler(async (req, res) => {
  let page = B.nInt(req.p.page);
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  const SearchField = B.s0(req.p.SearchField);
  const SearchValue = B.s0(req.p.SearchValue);
  const btnexel = B.s0(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  const Empid = req.user.emp_id;
  const p = await B.perms(Empid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  // (second `if (dynamicpagging == null)` => AppSettings["DynamicPagging"] is dead code: it was set to 100 above)
  const ip = await B.inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;

  const MaxRows = B.cvtInt(dynamicpagging);
  if (page === null) page = 1;
  // db.Database.CommandTimeout = 1000
  const rows = await db.proc(DB, 'USP_WALLET_SETTINGS', {
    TWTID: 0, DisplayName: '', BinayIncomePercent: 0, IsVisible: 0, MODE: 2, StartRowIndex: page, MaxRows,
    SearchFeild: SearchField, SearchValue,
  });
  const AllEPinRequestsList = mapRows(rows, WALLET_SETTINGS_PROPS);
  const TotalRecord = B.intOutStrict(rows, 'TotalCount');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.SearchField = SearchField;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.SearchValue = SearchValue;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, SearchField, SearchValue, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Wallet_Settings/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult InsertUpdate(int TWTID, string WalletType, decimal BinaryIncomeperc, string STATUS)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/InsertUpdate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TWTID = B.reqInt(req.p.TWTID, 'TWTID');
  const WalletType = B.nStr(req.p.WalletType);
  const BinaryIncomeperc = B.reqDec(req.p.BinaryIncomeperc, 'BinaryIncomeperc');
  const STATUS = B.nStr(req.p.STATUS);
  try {
    // [USP_WALLET_SETTINGS] @TWTID,@DisplayName,@BinayIncomePercent,@IsVisible,@MODE,@STRRESULT out
    const row = await db.procOne(DB, 'USP_WALLET_SETTINGS', {
      TWTID, DisplayName: WalletType, BinayIncomePercent: B.cvtIntBanker(BinaryIncomeperc), IsVisible: B.cvtInt(STATUS), MODE: 1,
    });
    const stringret = B.outStr(row, 'strresult');
    return res.json(stringret);
  } catch (ex) {
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
