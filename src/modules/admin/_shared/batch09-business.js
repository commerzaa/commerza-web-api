'use strict';
/**
 * batch09 private helper: Matrix_Business_Report and Member_Business_Report are the same controller body
 * (Index, public void ExportReport, GetAllDownLineMeberByUserName, GetAllLeftSideMemberOrRightSide); differences are cfg flags.
 * Exports: buildBusinessReport(cfg) => express.Router, MEMBER_BUSINESS_REPORT (class MemberBusinessReport props)
 */
const express = require('express');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./admin-session');
const {
  DB, nInt, nStr, nDec, s0, inlinePerms, perms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, dec2, outIntOf, errorView, outOf, cvtIntStrict,
} = require('./batch09-common');

/** class MemberBusinessReport (Controllers/AdminPanel/Member_Business_Report.cs) */
const MEMBER_BUSINESS_REPORT = ['ROWNUMBER', 'LEFTBUSINESS', 'RIGHTBUSINESS', 'USERNAME', 'Name', 'MOBILENUMBER', 'MOBILE', 'TOTALBUSINES', 'PBV'];

/**
 * cfg: { C, routeConfig, view, sheet, withName (Name column in the export), matrix (true: session check after url, USP_EXCEL_LINK result ignored
 *        (excelactive = 0) + inline USP_GETEXCELPERMISIONSTATUS; false: [SessionExpireCheck] + CheckPermissions) }
 */
function buildBusinessReport(cfg) {
  const router = express.Router();
  const { C } = cfg;
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
  let url = '';
  let url1 = '';

  // public void ExportReport(string SearchField, string SearchValue, string FROMDATE, string TODATE, int? page)
  async function ExportReport(req, res, SearchField, SearchValue, FROMDATE, TODATE, page, ViewBag) {
    const userid = req.user.emp_id;
    const Filename = 'MyDownline_' + userid + '_' + nowStamp();
    await excelHistory(userid, url, Filename);
    if (page === null) page = 1;
    // USP_MEMBER_BUSINESSREPORT @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FromDate,@ToDate,@TOTALCOUNT OUT
    const list = mapRows(await db.proc(DB, 'USP_MEMBER_BUSINESSREPORT', {
      STARTROWINDEX: page, MAXROWS: 999999, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE,
    }), MEMBER_BUSINESS_REPORT);
    if (list.length > 0) {
      const headers = cfg.withName
        ? ['S.No.', 'Username', 'Name', 'Mobile', 'Self Business', 'Left Business', 'Right Business', 'Total Downline Business']
        : ['S.No.', 'Username', 'Mobile', 'Self Business', 'Left Business', 'Right Business', 'Total Downline Business'];
      return writeXlsExport({
        req, res, ViewBag, sheet: 'Member_Business_Report.xls', downloadName: cfg.sheet, Filename, headers, rows: list,
        innerProc: 'MyDownline', outerProc: 'USP_DIRECT_TREE_LIST',
        cells: (item, w) => {
          w('\n');
          w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
          w(tab(cellStr(item, 'USERNAME')) + ' \t');
          if (cfg.withName) w(tab(cellStr(item, 'Name')) + ' \t');
          w(tab(cellStr(item, 'MOBILENUMBER')) + ' \t');
          w(tab(dec2(item.PBV)) + ' \t');
          w(tab(dec2(item.LEFTBUSINESS)) + ' \t');
          w(tab(dec2(item.RIGHTBUSINESS)) + ' \t');
          w(tab(dec2(item.TOTALBUSINES)) + ' \t');
        },
      });
      // PORT-NOTE: legacy wrote ~/AllExcelSheets/Member_Business_Report.xls but redirected the browser to ~/AllExcelSheets/<cfg.sheet>
      // (Matrix: a different, stale file); the freshly written content is sent here, named <cfg.sheet>.
    }
    return { sent: false };
  }

  // ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, int? page,
  //   string OrderBy, string FROMDATE, string TODATE, string btnexel)
  // auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin") / [SessionExpireCheck])
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, cfg.routeConfig], (req, res, next) => {
    url1 = legacyUrl(req).slice(1); // (static set before the session check, like legacy)
    url = '~' + url1;
    next();
  }, adminAuth, asyncHandler(async (req, res) => {
    const SearchField = s0(req.p.SearchField);
    const SearchValue = s0(req.p.SearchValue);
    const FROMDATE = s0(req.p.FROMDATE);
    let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
    const orderbydate = s0(req.p.orderbydate);
    const TODATE = s0(req.p.TODATE);
    const btnexel = s0(req.p.btnexel);
    let OrderBy = nStr(req.p.OrderBy);
    let page = nInt(req.p.page);
    const ViewBag = {};
    const Employeeid = req.user.emp_id;
    if (cfg.matrix) {
      await db.procOne(DB, 'USP_EXCEL_LINK', { url }); // result ignored: isactive = 0
      ViewBag.excelactive = 0;
      const p = await inlinePerms(Employeeid, url);
      ViewBag.isactive = p.isactive;
      ViewBag.isedit = p.isedit;
    } else {
      Object.assign(ViewBag, await perms(Employeeid, url));
    }
    try {
      const MaxRows = dynamicpagging;
      if (OrderBy === null) OrderBy = '';
      if (page === null) page = 1;
      const rows = await db.proc(DB, 'USP_MEMBER_BUSINESSREPORT', {
        STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE, TODATE,
      });
      const MemberBusinessReport = mapRows(rows, MEMBER_BUSINESS_REPORT);
      const TotalRecord = cvtIntStrict(outOf(rows, 'totalcount') === '' && rows.length === 0 ? '0' : outOf(rows, 'totalcount'));
      Object.assign(ViewBag, {
        TotalRecord, GridPageSize: MaxRows, CurrentPage: page, dynamicpagging, orderbydate, NoPerPage: await UtilityClass.GridNumbersPerPage(),
        SearchField, SearchValue, FROMDATE, TODATE, OrderBy,
      });
      if (btnexel === 'Export Excel') {
        const r = await ExportReport(req, res, SearchField, SearchValue, FROMDATE, TODATE, page, ViewBag);
        if (r.sent) return undefined;
      }
      return res.json({ view: cfg.view, Model: MemberBusinessReport, ...ViewBag });
    } catch (ExpObj) {
      return errorView(req, res, ExpObj, 'USP_GET_MEMBERBUSINESS');
    }
  }));

  // ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string FROMDATE, string TODATE, int? page)
  // auth (public method => routable in legacy; reads Session["Admin_User"])
  router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const r = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.FROMDATE), nStr(req.p.TODATE), nInt(req.p.page), {});
    if (!r.sent) res.send('');
  }));

  // [USP_GET_MEMBERBUSINESS] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@USERNAME,@TOTALCOUNT out,@TLBV,@TRBV
  async function getMemberBusiness(page, SearchField, UserName, TLBV, TRBV) {
    const MaxRows = await UtilityClass.GridPageSize();
    const rows = await db.proc(DB, 'USP_GET_MEMBERBUSINESS', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: '', FROMDATE: '', TODATE: '', USERNAME: UserName, TLBV, TRBV,
    });
    return { rows, MaxRows };
  }

  // ---------------------------------------------------------------- JsonResult GetAllDownLineMeberByUserName(string UserName, int? page)
  // auth (PORT-NOTE: legacy had no session check on this member-business lookup - protected)
  router.all(`/admin/${C}/GetAllDownLineMeberByUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const SearchField = 'ALLDOWNLINEBYUSERNAME';
    let page = nInt(req.p.page); if (page === null) page = 1;
    const { rows } = await getMemberBusiness(page, SearchField, nStr(req.p.UserName), '0', '0');
    outIntOf(rows, 'totalcount'); await UtilityClass.GridNumbersPerPage(); // (ViewBag values set but never rendered by a JsonResult)
    return res.json(mapRows(rows, MEMBER_BUSINESS_REPORT));
  }));

  // ---------------------------------------------------------------- JsonResult GetAllLeftSideMemberOrRightSide(decimal? Tlbv, decimal? Trbv, int? page, string UserName)
  // auth (PORT-NOTE: legacy had no session check on this member-business lookup - protected)
  router.all(`/admin/${C}/GetAllLeftSideMemberOrRightSide{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    let Tlbv = nDec(req.p.Tlbv); if (Tlbv === null) Tlbv = 0;
    let Trbv = nDec(req.p.Trbv); if (Trbv === null) Trbv = 0;
    const SearchField = '';
    let page = nInt(req.p.page); if (page === null) page = 1;
    const { rows } = await getMemberBusiness(page, SearchField, nStr(req.p.UserName), Tlbv, Trbv);
    // int TotalRecord = Convert.ToInt32(RECORDCOUNT.Value.ToString())  ("" => FormatException => 500)
    const tc = outOf(rows, 'totalcount');
    if (rows.length > 0) cvtIntStrict(tc);
    await UtilityClass.GridNumbersPerPage();
    return res.json(mapRows(rows, MEMBER_BUSINESS_REPORT));
  }));

  return router;
}

module.exports = { buildBusinessReport, MEMBER_BUSINESS_REPORT };
