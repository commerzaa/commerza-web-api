'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TokenAchiver.cs (class TokenAchiverController => /admin/TokenAchiver/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, tsvFile, XLS_DIR } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'TokenAchiver';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class TokenAchiver */
const TOKEN_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'EMAILID', 'MOBILE', 'DOC', 'ACTIVE', 'TOKEN_NO', 'LEFTIDS', 'RIGHTIDS', 'Date', 'REGNO', 'BBZMID'];
/** class TOKENLISTMEMBERACHIVE */
const TOKENLIST_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'MOBILE', 'DOC', 'SIDE', 'DATE'];

/** public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue, int? Bonzaname) */
async function ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue, Bonzaname) {
  const userid = req.user.emp_id;
  const Filename = 'TokenAchiver_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  // [USP_ALLBONAZA_ACHIVER] without @orderbydate (legacy passed 10 parameters here)
  const TokenAchiver = mapRows(await db.proc(DB, 'USP_ALLBONAZA_ACHIVER', supplied({
    STARTROWINDEX: 1, MAXROWS: 9999999, PLID: '0', FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: B.trimS(SearchField),
    SEARCHVALUE: B.trimS(SearchValue), TOKENNO: '0', BONZANAME: Bonzaname,
  })), TOKEN_PROPS);
  if (TokenAchiver.length > 0) {
    return tsvFile({
      req, res, ViewBag, filepath: path.join(XLS_DIR(), 'TokenAchiver.xls'),
      header: 'S.No. \tUsername \tName \tMobile \tEmail \tRegistration Date  \tActive Date \tToken No \tBonaza Name  \t',
      rows: TokenAchiver,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      copyFilename: Filename,
      download: 'TokenAchiver.xls',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'NAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILE')) + ' \t');
        w(B.tab(B.cellStr(item, 'EMAILID')) + ' \t');
        w(B.tab(B.netFormat(item.DOC, 'dd-MMM-yyyy')) + ' \t');
        w(B.tab(B.netFormat(item.Date, 'dd-MMM-yyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'REGNO')) + ' \t');
        w(B.tab(B.cellStr(item, 'BBZMID')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage, int? Bonzaname)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Tokens-Achiver" -> TokenAchiver/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Tokens-Achiver'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromdate = B.nStr(req.p.fromdate);
  let todate = B.nStr(req.p.todate);
  let page = B.nInt(req.p.page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let Bonzaname = B.nInt(req.p.Bonzaname);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (ddlcustpage === null) ddlcustpage = 100;
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Bonzaname === null) Bonzaname = 0;
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await B.perms(Empid, url));
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_ALLBONAZA_ACHIVER', {
      STARTROWINDEX: page, MAXROWS: MaxRows, PLID: '0', FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(),
      SEARCHVALUE: SearchValue.trim(), TOKENNO: '0', BONZANAME: Bonzaname, orderbydate,
    });
    const TokenAchiver = mapRows(rows, TOKEN_PROPS);
    const TotalRecord = B.outIntOf(rows, 'totalcount'); // int.Parse(v == "" ? "0" : v)
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, fromdate, todate, SearchField, SearchValue, Bonzaname);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/TokenAchiver/Index.cshtml', Model: TokenAchiver, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_ALLBONAZA_ACHIVER');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue, int? Bonzaname)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.fromdate), B.nStr(req.p.todate), B.nStr(req.p.SearchField),
    B.nStr(req.p.SearchValue), B.nInt(req.p.Bonzaname));
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult TOKENLISTMEMBERACHIVE(string TOKENNO, string PLID)
// auth (no session check in legacy; member token data => protected)
router.all(`/admin/${C}/TOKENLISTMEMBERACHIVE{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TOKENNO = B.nStr(req.p.TOKENNO);
  const PLID = B.nStr(req.p.PLID);
  // PORT-NOTE: legacy passed "" for the INT parameters @STARTROWINDEX/@MAXROWS (SQL Server converts '' to 0); 0 is passed here.
  const TokenAchiver = mapRows(await db.proc(DB, 'USP_ALLBONAZA_ACHIVER', {
    STARTROWINDEX: 0, MAXROWS: 0, PLID: B.cvtInt(PLID), FROMDATE: '', TODATE: '', SEARCHFIEL: '', SEARCHVALUE: '', TOKENNO: B.cvtInt(TOKENNO),
  }), TOKENLIST_PROPS);
  return res.json(TokenAchiver);
}));

module.exports = router;
