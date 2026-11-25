'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\GrowthBonus.cs (class GrowthBonusController, no namespace => /admin/GrowthBonus/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, reqInt, nullRef, tab, cellStr, netFormat, dec2, nowStamp, perms, excelHistory, writeXlsExport,
} = require('./_shared/batch08_common');
const { outVal } = require('./_shared/batch08D2_common');
const { GROWTH_BONUS_LIST_PROPS, GET_DETAILS_PROPS, sqlStyle0, netParseInt, netParseDec } = require('./_shared/batch08A2_common');

const router = express.Router();
const C = 'GrowthBonus';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';
// (`private string GrowthlevelUrl` is an instance field => a local variable per request)

/** Convert.ToDateTime(s) (FormatException on invalid input) */
function toDateTime(s) {
  const d = new Date(s);
  if (s === null || s === undefined || String(s).trim() === '' || Number.isNaN(d.getTime())) {
    throw new Error('String was not recognized as a valid DateTime.');
  }
  return d;
}

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string username, string orderby, int? page, int? ddlcustpage)
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, username, orderby, page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'Growth_Bonus_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);

  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(ddlcustpage) (unused, like legacy)
  void MaxRows;
  if (page === null) page = 1;
  if (SearchField === null || SearchValue === null || fromdate === null || todate === null) throw nullRef(); // .Trim() on null
  if (username === null || orderby === null) throw new Error('The parameterized query expects a parameter which was not supplied.');
  // PORT-NOTE (legacy quirk kept): the EXEC text was "... @TotalCount out,@Mode,@USERNAME,@ASCDESC" (positional), so the proc's
  // 10th param @SumEarndPoind (money) received the username and its @USERNAME received the orderby value; @ASCDESC kept its
  // default 'DESC'. A non-numeric username made SQL Server fail converting it to money (exception => 500), reproduced here.
  if (username.trim() !== '' && !/^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(username)) {
    throw new Error('Cannot convert a char value to money. The char value has incorrect syntax.');
  }
  const rows = await db.proc(DB, 'USP_MEMBER_GROUP_BONUS', {
    PLID: '0', StartRowIndex: page, MaxRows: '1000000', SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    fromDate: fromdate.trim(), ToDate: todate.trim(), Mode: '2', USERNAME: orderby,
  });
  const Obj = mapRows(rows, GROWTH_BONUS_LIST_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Growth_Bonus.xls', Filename,
      headers: ['S.No.', 'Name', 'Username', 'Mobile', 'InvesmentDate', 'LastCredited', 'MaxReturn', 'InvesmentAmount', 'CurrentReturn'],
      rows: Obj,
      innerProc: 'GrowthBonusList',
      outerProc: 'USP_MEMBER_GROUP_BONUS',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(netFormat(item.INVEST_DATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(netFormat(item.LAST_UPDATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(dec2(item.MAXRETURN)) + ' \t');
        w(tab(dec2(item.INVEST_AMOUNT)) + ' \t');
        w(tab(dec2(item.CURRENTRETURN)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string myquery, string SearchField, string SearchValue, string fromdate, string todate, string username, string orderby, int? page, int? ddlcustpage, string btnexel, string Date)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/growth-bonus-report" -> GrowthBonus/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/growth-bonus-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  const myquery = nStr(req.p.myquery);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let username = nStr(req.p.username);
  let orderby = nStr(req.p.orderby);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  const DateP = nStr(req.p.Date);
  const ViewBag = {};

  if (myquery !== null) {
    ViewBag.date = netFormat(toDateTime(await UtilityClass.Decryptword(myquery)), 'yyyy-MM-dd');
    fromdate = ViewBag.date;
    todate = ViewBag.date;
  }
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // GrowthlevelUrl = Request.Url.ToString(); Growthrequesturl = GrowthlevelUrl.Split('?')
  // PORT-NOTE: Uri.ToString() is unescaped; the raw query part is URI-decoded here (kept raw if decoding fails).
  const GrowthlevelUrl = req.originalUrl || req.url || '';
  const Growthrequesturl = GrowthlevelUrl.split('?');
  let usernameurl = '';
  if (Growthrequesturl.length >= 2) {
    let q = Growthrequesturl[1];
    try { q = decodeURIComponent(q); } catch (_) { /* keep raw */ }
    usernameurl = await UtilityClass.Decryptword(q);
    if (usernameurl !== '') {
      username = usernameurl;
    }
  }
  if (DateP !== null) { fromdate = await UtilityClass.Decryptword(DateP); }
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (username === null) username = '';
  if (orderby === null) orderby = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await perms(Empid, url)); // isactive, isedit, excelactive

  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_MEMBER_GROUP_BONUS', {
    PLID: '0', StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromdate.trim(),
    ToDate: todate.trim(), Mode: '2', USERNAME: username, ASCDESC: orderby,
  });
  const Obj = mapRows(rows, GROWTH_BONUS_LIST_PROPS);
  const tc = outVal(rows, 'TotalCount');
  const TotalRecord = netParseInt(tc === '' ? '0' : tc);
  const TOTALAMOUNTS = netParseDec(outVal(rows, 'TOTALAMOUNT')); // decimal.Parse(TOTALAMOUNT.Value.ToString()) (DBNull => FormatException)
  ViewBag.CurrentPage = page; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TOTALAMOUNTS = TOTALAMOUNTS;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.username = username;
  ViewBag.toDate = todate;
  ViewBag.orderby = orderby;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, username, orderby, page, ddlcustpage, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/GrowthBonus/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate),
    nStr(req.p.username), nStr(req.p.orderby), nInt(req.p.page), nInt(req.p.ddlcustpage), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- public JsonResult GetDetails(Int64 regno)
// auth (PORT-NOTE: legacy had no session check; returns a member's growth chart => adminAuth)
router.all(`/admin/${C}/GetDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = reqInt(req.p.regno, 'regno');
  let success = '';
  // legacy: "... FROM TBL_GROWTHCHART WHERE REGNO='" + regno + "'" (concatenated; parameterised here)
  const rows = await db.query(DB, `select row_number() over (order by regno) as regno, growthamount, growthdate, kid,
      coalesce(principalamount, 0) as principalamount, coalesce(interestamount, 0) as interestamount, coalesce(adminch, 0) as adminch,
      coalesce(tds, 0) as tds, coalesce((growthamount + adminch + tds), 0) as totalincome
    from tbl_growthchart where regno = @regno`, { regno });
  const Obj = mapRows(rows, GET_DETAILS_PROPS).map((o) => ({ ...o, GROWTHDATE: sqlStyle0(o.GROWTHDATE) })); // CONVERT(VARCHAR(100), GROWTHDATE)
  if (Obj !== null) {
    success = 'ok';
    void success; // ViewBag.dataobj = Obj (unused by a JsonResult)
    return res.json(Obj);
  }
  return res.json(success);
}));

module.exports = router;
