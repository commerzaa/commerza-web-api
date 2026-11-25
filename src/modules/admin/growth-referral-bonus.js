'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\GrowthReferralBonus.cs (class GrowthReferralBonusController, no namespace => /admin/GrowthReferralBonus/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, nStr, tab, cellStr, netFormat, dec2, errorView } = require('./_shared/batch08-common');
const { outVal } = require('./_shared/batch08-d2-common');
const {
  GET_REFERAL_INCOME_PROPS, GET_EARNING_WALLET_HISTORY_PROPS, writeXlsFileOnly, netParseInt,
} = require('./_shared/batch08-a2-common');

const router = express.Router();
const C = 'GrowthReferralBonus';

// ---------------------------------------------------------------- ActionResult Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/growth-referral-bonus-report" -> GrowthReferralBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/growth-referral-bonus-report'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  try {
    const MaxRows = Number(ddlcustpage);
    if (page === null) page = 1;
    // db.Database.CommandTimeout = 1000 (PORT-NOTE: pool statement timeout applies)
    const rows = await db.proc(DB, 'USP_DIRECTINCOME_REPORT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      INCOMETYPE: 2,
    });
    const AllFreeEpinList = mapRows(rows, GET_REFERAL_INCOME_PROPS);
    const tc = outVal(rows, 'TOTALCOUNT');
    const TotalRecord = netParseInt(tc === '' ? '0' : tc);
    const ViewBag = {};
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    return res.json({ view: '~/Views/AdminPanel/GrowthReferralBonus/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (PORT-NOTE: legacy had no session check; it dumps admin earning history to a file => adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 15;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const MaxRows = Number(ddlcustpage); // unused, like legacy
  void MaxRows;
  if (page === null) page = 1;
  // PORT-NOTE (legacy quirk kept): the EXEC text "[USP_ADMIN_EARNING_HISTORY] @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,
  // @ToDate,@TotalCount out,@Mode,@IncomeType" omits the proc's first param @PLID, so every value is shifted one position:
  // PLID=page, STARTROWINDEX=100000, MAXROWS=SearchField (nvarchar->int: '' => 0, non-numeric => conversion error), SEARCHFIELD=SearchValue,
  // SEARCHVALUE=fromdate, FROMDATE=todate, TODATE=NULL (the uninitialised @TotalCount), TOTALCOUNT='1' (Mode), Mode=2 (IncomeType),
  // IncomeType=default 1. Reproduced with named arguments (TOTALCOUNT is an OUT column in PostgreSQL and cannot receive '1').
  const sf = SearchField.trim();
  if (sf !== '' && !/^\s*[-+]?\d+\s*$/.test(sf)) {
    throw new Error(`Conversion failed when converting the nvarchar value '${sf}' to data type int.`);
  }
  const rows = await db.proc(DB, 'USP_ADMIN_EARNING_HISTORY', {
    PLID: page, STARTROWINDEX: 100000, MAXROWS: sf === '' ? 0 : parseInt(sf, 10), SEARCHFIELD: SearchValue.trim(), SEARCHVALUE: fromdate.trim(),
    FROMDATE: todate.trim(), TODATE: null, Mode: 2,
  });
  const AllFreeEpinList = mapRows(rows, GET_EARNING_WALLET_HISTORY_PROPS);
  // file written to ~/AllExcelSheets/Growth_Referral_Bonus.xls; legacy never sent it (Response.Redirect commented out)
  await writeXlsFileOnly({
    req, sheet: 'Growth_Referral_Bonus.xls',
    headers: ['S.No.', 'Date', 'Growth Referral Bonus', 'Status'],
    rows: AllFreeEpinList,
    innerProc: 'GetEarningWalletHistory',
    outerProc: 'USP_ADMIN_EARNING_HISTORY',
    cells: (item, w) => {
      w('\n');
      w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
      w(tab(netFormat(item.EarnedDate, 'dd-MM-yyyy')) + ' \t');
      w(tab(dec2(item.EarnedMatchingPoints)) + ' \t');
      w(tab(cellStr(item, 'Status')) + ' \t');
    },
  });
  return res.send(''); // void action => empty response
}));

module.exports = router;
