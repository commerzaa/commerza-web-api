'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Money_Statement_Summary.cs (class Money_Statement_SummaryController => /Money_Statement_Summary/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, dec2, col, outIntOf, trimS,
} = require('./_shared/batch10_common');
const { outDecRaw } = require('./_shared/batch10C_common');

const router = express.Router();
const C = 'Money_Statement_Summary';

/** class MoneyStatement_Summary */
const PROPS = ['ROWNUMBER', 'DATE', 'credit', 'debit', 'balance'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// PORT-NOTE: legacy also passed unused SqlParameters @Credit/@Debit/@Balance = "0" that are not in the command text (ignored by SQL Server); dropped.

// public void ExportReport(string From, string To, int? page, int? ddlcustpage)
async function ExportReport(req, res, From, To, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'MoneyStatement_Summary' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  if (page === null) page = 1;
  // dbo.usp_money_statement_summary @StartRowInex,@MaxRowIndex,@FromDate,@ToDate,@TotalCount out,@TotalCredit out,@TotalDebit out,@TotalBalance out
  const rows = await db.proc(DB, 'usp_money_statement_summary', {
    StartRowInex: page, MaxRowIndex: ddlcustpage, FromDate: trimS(From), ToDate: trimS(To),
  });
  const MoneySummary = mapRows(rows, PROPS);
  if (MoneySummary.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'MoneyStatement_Summary.xls', Filename,
      headers: ['S.No.', 'Date', 'Credit', 'Debit'],
      rows: MoneySummary, innerProc: 'usp_money_statement_summary', outerProc: 'usp_money_statement_summary',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'DATE')) + ' \t');
        w(tab(dec2(col(item, 'credit'))) + ' \t');
        w(tab(dec2(col(item, 'debit'))) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string From, string To, int? page, int? ddlcustpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Money-Statement-Summary" -> Money_Statement_Summary/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Money-Statement-Summary'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  let From = nStr(req.p.From); if (From === null) From = '';
  let To = nStr(req.p.To); if (To === null) To = '';
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  const MaxRows = dynamicpagging;
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  const Employeeid = req.user.emp_id;
  const ip = await inlinePerms(Employeeid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  let page = nInt(req.p.page); if (page === null) page = 1;
  // (no try/catch in legacy: exceptions => 500)
  const rows = await db.proc(DB, 'usp_money_statement_summary', {
    StartRowInex: page, MaxRowIndex: MaxRows, FromDate: From.trim(), ToDate: To.trim(), orderbydate,
  });
  const MoneySummary = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  ViewBag.TotalCr = outDecRaw(rows, 'totalcredit');
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalDr = outDecRaw(rows, 'totaldebit');
  ViewBag.totalBal = outDecRaw(rows, 'totalbalance');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, From, To, page, ddlcustpage, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Money_Statement_Summary/Index.cshtml', Model: MoneySummary, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string From, string To, int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.From), nStr(req.p.To), nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
