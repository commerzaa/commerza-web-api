'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\FranchiseStatementController.cs (class FranchiseStatementController => /admin/FranchiseStatement/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FranchiseStatement';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class FranchiseLedger_Report */
const LEDGER_PROPS = ['RowNumber', 'type', 'Amount', 'Date', 'Remark', 'Username', 'CURRENTBALANCE', 'DRAMOUNT', 'MRP'];

/** new SqlParameter("@x", null) is not sent => proc default */
const dropNull = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) r[k] = v; return r; };

/** public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'FranchiseStatement_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null || Page === undefined) Page = 1;
  // [USP_Franchise_Statement] @FromDate,@ToDate,@StartRowIndex,@MaxRows,@STRRESULT OUT,@TOTALCOUNT OUT,@CRDRTYPE,@TRTYPE,@UserName
  const Li = mapRows(await db.proc(DB, 'USP_Franchise_Statement', dropNull({
    FROMDATE: FromDate, TODATE: ToDate, STARTROWINDEX: Page, MAXROWS: MaxRows, STRRESULT: '', CRDRTYPE: SearchField, TRTYPE: '0', UserName: SearchValue,
  })), LEDGER_PROPS);
  if (Li.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'FranchiseStatement.xls', Filename,
      headers: ['S.No.', 'Username', 'Date', 'Type', 'Amount', 'Balance', 'Particulars'],
      rows: Li, innerProc: 'LiUserWiseIWalletStatementsController_Report', outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'Username')) + ' \t');
        w(B.tab(B.netFormat(item.Date, 'ddMMMyyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'type')) + ' \t');
        if (B.cellStr(item, 'type') === 'Dr') w(B.tab(B.dec2(item.DRAMOUNT)) + ' \t');
        else w(B.tab(B.dec2(item.Amount)) + ' \t');
        w(B.tab(B.dec2(item.CURRENTBALANCE)) + ' \t');
        w(B.tab(B.cellStr(item, 'Remark')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Franchise-Statement" -> FranchiseStatement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Franchise-Statement'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let Page = B.nInt(req.p.Page);
  let FromDate = B.nStr(req.p.FromDate);
  let ToDate = B.nStr(req.p.ToDate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromDate === null) FromDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (btnexel === null) btnexel = '';
  const ViewBag = {};
  ViewBag.excelactive = await B.excelLink(url);
  const out = {};
  try {
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const Empid = req.user.emp_id;
    sessionStore.set(req, 'Admin_User_Menu', await UtilityClass.UpdateAdminMenu(Empid));
    const EM = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!EM) throw B.nullRef();
    out.token = issueAdminToken(EM); // refreshed Session["Admin_User"]
    const Employeeid = EM.Emp_ID;
    Object.assign(ViewBag, await B.inlinePerms(Employeeid, url));
    const rows = await db.proc(DB, 'USP_Franchise_Statement', {
      FROMDATE: FromDate, TODATE: ToDate, STARTROWINDEX: Page, MAXROWS: MaxRows, STRRESULT: '', CRDRTYPE: SearchField, TRTYPE: '0',
      UserName: SearchValue, CRAMOUNT: '0', DRAMOUNT: '0', AVALIBALEFUND: '0', orderbydate,
    });
    const Li = mapRows(rows, LEDGER_PROPS);
    const TotalRecord = B.outIntOf(rows, 'TOTALCOUNT');
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ToDate = ToDate;
    ViewBag.FromDate = FromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, Page, FromDate, ToDate, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/FranchiseStatement/Index.cshtml', Model: Li, ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nInt(req.p.Page), B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue));
  if (!r.sent) res.send('');
}));

module.exports = router;
