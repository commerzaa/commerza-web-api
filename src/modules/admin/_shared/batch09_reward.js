'use strict';
/**
 * batch09 private helper: Member_Joining_Reward and Member_Rank_Reward share one controller body (Index + public void ExportReport);
 * differences (proc, model, export columns, sheet, view) are cfg values.
 * Exports: buildRewardReport(cfg) => express.Router
 */
const express = require('express');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./adminSession');
const {
  DB, nInt, nStr, s0, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outOf,
} = require('./batch09_common');

/** cfg: { C, routeConfig, proc, props, view, sheet, headers, cols (export columns after the common ones) } */
function buildRewardReport(cfg) {
  const router = express.Router();
  const { C } = cfg;
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
  let url = '';
  let url1 = '';

  // PORT-NOTE: the legacy command text was "... @SEARCHVALUE,@FROMDATE,TODATE,@TOTALCOUNT OUT" - "TODATE" without '@' is a bare
  // string literal in T-SQL EXEC, so the proc's @TODATE always received the text 'TODATE' (the bound @TODATE SqlParameter was unused).
  const call = (p) => db.proc(DB, cfg.proc, { REGNO: 0, STARTROWINDEX: p.page, MAXROWS: p.MaxRows, SEARCHFIELD: p.SearchField, SEARCHVALUE: p.SearchValue,
    FROMDATE: p.FromDate, TODATE: 'TODATE' });

  // public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
  async function ExportReport(req, res, FromDate, ToDate, SearchField, SearchValue, ViewBag) {
    const userid = req.user.emp_id;
    const Filename = 'Member_Rank_Reward_' + userid + '_' + nowStamp();
    await excelHistory(userid, url, Filename);
    const MaxRows = await UtilityClass.GridPageSize();
    const list = mapRows(await call({ page: 1, MaxRows, SearchField, SearchValue, FromDate }), cfg.props);
    if (list.length > 0) {
      return writeXlsExport({
        req, res, ViewBag, sheet: cfg.sheet, Filename,
        headers: ['S.No.', 'Username', 'Membername', 'Rewardname', 'Achive Date', 'Total Direct', 'Left Direct', 'Right Direct', ...cfg.headers],
        rows: list, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
        cells: (item, w) => {
          w('\n');
          for (const c of ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'ACHIVEDATE', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', ...cfg.cols]) {
            w(tab(cellStr(item, c)) + ' \t');
          }
        },
      });
    }
    return { sent: false };
  }

  // ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string btnexel, string ToDate,
  //   string SearchValue, string SearchField)
  // auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, cfg.routeConfig], (req, res, next) => {
    url1 = legacyUrl(req).slice(1); // (static set before the session check, like legacy)
    url = '~' + url1;
    next();
  }, adminAuth, asyncHandler(async (req, res) => {
    let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
    const orderbydate = s0(req.p.orderbydate);
    const FromDate = s0(req.p.FromDate);
    const btnexel = s0(req.p.btnexel);
    const ToDate = s0(req.p.ToDate);
    const SearchField = s0(req.p.SearchField);
    const SearchValue = s0(req.p.SearchValue);
    let Page = nInt(req.p.Page);
    const ViewBag = {};
    const p = await inlinePerms(req.user.emp_id, url);
    ViewBag.isactive = p.isactive;
    ViewBag.isedit = p.isedit;
    ViewBag.excelactive = await excelLink(url);
    const MaxRows = dynamicpagging;
    if (Page === null) Page = 1;
    const rows = await call({ page: Page, MaxRows, SearchField, SearchValue, FromDate });
    const list = mapRows(rows, cfg.props);
    const tc = outOf(rows, 'totalcount');
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    Object.assign(ViewBag, {
      CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField: '', dynamicpagging,
      orderbydate, SearchValue, fromDate: FromDate, toDate: ToDate,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, FromDate, ToDate, SearchField, SearchValue, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: cfg.view, Model: list, ...ViewBag });
  }));

  // ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
  // auth (public method => routable in legacy; reads Session["Admin_User"])
  router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const r = await ExportReport(req, res, nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField), nStr(req.p.SearchValue), {});
    if (!r.sent) res.send('');
  }));

  return router;
}

module.exports = { buildRewardReport };
