'use strict';
/**
 * batch09 private helper: Member_RankList and Member_NEXT_RankList share one controller body ([SessionExpireCheck] Index + public void ExportReport);
 * differences (proc, model, NextRank parameter, export columns, view) are cfg values.
 * Exports: buildRankList(cfg) => express.Router
 */
const express = require('express');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./admin-session');
const { DB, nInt, nStr, s0, perms, excelHistory, nowStamp, writeXlsExport, tab, outIntOf } = require('./batch09-common');

/** cfg: { C, routeConfig, proc, props, view, next (bool: @NextRank), headers, cells(item, w) } */
function buildRankList(cfg) {
  const router = express.Router();
  const { C } = cfg;
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
  let url = '';
  let url1 = '';

  const call = (p) => {
    // USP_ALLMEMBER_RANKLIST / USP_NEXTRANKACHIVERLIST @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@RESULT out,@TOTALCOUNT out,
    //   @orderbydate,@Rank[,@NextRank]
    const args = { STARTROWINDEX: p.page, MAXROWS: p.MaxRows, SEARCHFIELD: p.SearchField, SEARCHVALUE: p.SearchValue, FROMDATE: p.fromdate,
      TODATE: p.todate, orderbydate: p.orderbydate, Rank: p.Rank };
    if (cfg.next) args.NextRank = p.NextRank;
    return db.proc(DB, cfg.proc, args);
  };

  // public void ExportReport(string SearchField, string SearchValue, string FromDate, string ToDate, int? Rank[, int? NextRank])
  async function ExportReport(req, res, SearchField, SearchValue, FromDate, ToDate, Rank, NextRank, ViewBag) {
    const userid = req.user.emp_id;
    const Filename = 'Member_RankList_' + userid + '_' + nowStamp();
    await excelHistory(userid, url, Filename);
    const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
    const list = mapRows(await call({ page: 1, MaxRows: 999999, SearchField, SearchValue, fromdate: FromDate, todate: ToDate, orderbydate: '', Rank, NextRank }),
      cfg.props);
    if (list.length > 0) {
      return writeXlsExport({
        req, res, ViewBag, sheet: 'Member_RankList.xls', Filename, headers: cfg.headers, rows: list,
        innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
        cells: (item, w) => { w('\n'); cfg.cells(item, w); },
      });
    }
    return { sent: false };
  }

  // ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
  //   string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string btnexel,
  //   string Userdownlinemember, int? Rank[, int? NextRank])
  // auth ([SessionExpireCheck])
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, cfg.routeConfig], adminAuth, asyncHandler(async (req, res) => {
    url1 = legacyUrl(req).slice(1);
    url = '~' + url1;
    const SearchField = s0(req.p.SearchField);
    const SearchValue = s0(req.p.SearchValue);
    const fromdate = s0(req.p.fromdate);
    const todate = s0(req.p.todate);
    let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
    const orderbydate = s0(req.p.orderbydate);
    const Username = s0(req.p.Username);
    const EmailID = s0(req.p.EmailID); void EmailID;
    const SponserID = s0(req.p.SponserID);
    const Name = s0(req.p.Name);
    let Side = nInt(req.p.Side); if (Side === null) Side = 0;
    const Level = s0(req.p.Level);
    const btnexel = s0(req.p.btnexel);
    let Rank = nInt(req.p.Rank); if (Rank === null) Rank = 0;
    let NextRank = null;
    if (cfg.next) { NextRank = nInt(req.p.NextRank); if (NextRank === null) NextRank = 0; }
    const Userdownlinemember = s0(req.p.Userdownlinemember); void Userdownlinemember;
    let page = nInt(req.p.page);
    const ViewBag = {};
    Object.assign(ViewBag, await perms(req.user.emp_id, url));
    // db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault()?.userName  (loginid - unused by the legacy code)
    await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    const rows = await call({ page, MaxRows, SearchField, SearchValue, fromdate, todate, orderbydate, Rank, NextRank });
    const LRMember = mapRows(rows, cfg.props);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, dynamicpagging, orderbydate, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate: fromdate, toDate: todate, side: Side, Rank, SponserID, Name, Username, Level,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, Rank, NextRank, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: cfg.view, Model: LRMember, ...ViewBag });
  }));

  // ---------------------------------------------------------------- public void ExportReport(...)
  // auth (public method => routable in legacy; reads Session["Admin_User"])
  router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const r = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.FromDate), nStr(req.p.ToDate), nInt(req.p.Rank),
      cfg.next ? nInt(req.p.NextRank) : null, {});
    if (!r.sent) res.send('');
  }));

  return router;
}

module.exports = { buildRankList, tab };
