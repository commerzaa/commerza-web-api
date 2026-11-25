'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Total_Admin_Charge.cs (class Total_Admin_ChargeController => /admin/Total_Admin_Charge/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, tsvFile, errorViewMsg, body, XLS_DIR } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Total_Admin_Charge';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class Total_Admin_Charge */
const PROPS = ['ROWNUMBER', 'DATE', 'USERNAME', 'NAME', 'PHONE', 'PANNO', 'TOTALADMINCH', 'TOTALTDS', 'TOTALSHOPPINGCH'];

/** [USP_Total_Admin_Charge] @FromDate,@ToDate,@StartRowIndex,@MaxRows,@StrResult OUT,@TotalCount OUT,@SearchValue,@SearchField
 *  PORT-NOTE: legacy passed "" as the value of the OUT parameter @StrResult; OUT params are not passed to the PG function. */
const charges = (FromDate, ToDate, StartRowIndex, MaxRows, SearchValue, SearchField) => db.proc(DB, 'USP_Total_Admin_Charge', supplied({
  FROMDATE: FromDate, TODATE: ToDate, StartRowIndex, MaxRows, SearchValue, SearchField,
}));

/** public void ExportReport(string FromDate, string ToDate, int? page, int? TYPE, string SearchValue, string SearchField) */
async function ExportReport(req, res, ViewBag, FromDate, ToDate, page, TYPE, SearchValue, SearchField) {
  const userid = req.user.emp_id;
  let Filename = '';
  if (TYPE === 1) Filename = 'Total_Admin_Charge_List_' + userid + '_' + B.nowStamp();
  if (TYPE === 2) Filename = 'Total_TDS_Charge_List_' + userid + '_' + B.nowStamp();
  if (TYPE === 3) Filename = 'Total_Shopping_Charge_List_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // computed but unused (call passes 1000000)
  void MaxRows;
  if (page === null) page = 1;
  const Total_Admin_Charge = mapRows(await charges(FromDate, ToDate, 1, 1000000, SearchValue, SearchField), PROPS);
  if (Total_Admin_Charge.length > 0) {
    let header = 'S.No. \tDate \tUserName \tName \tUsername \tPANNO \tPHONE \t';
    if (TYPE === 1) header += 'AdminCharge \t';
    if (TYPE === 2) header += 'TDSCharge \t';
    if (TYPE === 3) header += 'ShoppingCharge \t';
    // PORT-NOTE: legacy wrote ~/AllExcelSheets/All_Member_List.xls but redirected to ~/AllExcelSheets/<Filename>.xls (a file it never
    // wrote); the written content is sent here with the legacy attachment name <Filename>.xls.
    return tsvFile({
      req, res, ViewBag, filepath: path.join(XLS_DIR(), 'All_Member_List.xls'),
      header,
      rows: Total_Admin_Charge,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      copyFilename: Filename,
      download: Filename + '.xls',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        const name = B.cellStr(item, 'NAME');
        const Username = name.replace(/ /g, '');
        w(B.tab(Username) + ' \t');
        w(B.tab(B.cellStr(item, 'PANNO')) + ' \t');
        if (TYPE === 1) w(B.tab(B.dec2(item.TOTALADMINCH)) + ' \t');
        if (TYPE === 2) w(B.tab(B.dec2(item.TOTALTDS)) + ' \t');
        if (TYPE === 3) w(B.tab(B.dec2(item.TOTALSHOPPINGCH)) + ' \t');
      },
    });
  }
  return { sent: false };
}

/**
 * Route value TYPE (route-config defaults). MVC value providers: form > route data > query string.
 * @param {number|null} routeType default TYPE of the friendly route (null for the conventional route)
 */
function typeOf(req, routeType) {
  const f = B.nInt(body(req, 'TYPE'));
  if (f !== null) return f;
  if (routeType !== null) return routeType;
  return B.nInt(req.p.TYPE);
}

function index(routeType) {
  return asyncHandler(async (req, res) => {
    let dynamicpagging1 = B.nInt(req.p.dynamicpagging1);
    let dynamicpagging2 = B.nInt(req.p.dynamicpagging2);
    let dynamicpagging3 = B.nInt(req.p.dynamicpagging3);
    let orderbydate = B.nStr(req.p.orderbydate);
    let Page = B.nInt(req.p.Page);
    let FromDate = B.nStr(req.p.FromDate);
    let ToDate = B.nStr(req.p.ToDate);
    let SearchField = B.nStr(req.p.SearchField);
    let SearchValue = B.nStr(req.p.SearchValue);
    const btnexel = B.nStr(req.p.btnexel);
    let Remark = B.nStr(req.p.Remark);
    const TYPE = typeOf(req, routeType);

    url1 = legacyUrl(req).slice(1);
    url = '~' + url1;
    const ViewBag = {};
    if (TYPE !== null) ViewBag.TYPE = TYPE;
    if (FromDate === null) FromDate = '';
    if (dynamicpagging1 === null) dynamicpagging1 = 100;
    if (dynamicpagging2 === null) dynamicpagging2 = 100;
    if (dynamicpagging3 === null) dynamicpagging3 = 100;
    if (orderbydate === null) orderbydate = '';
    if (ToDate === null) ToDate = '';
    if (Remark === null) Remark = '';
    void Remark;
    if (SearchField === null) SearchField = '';
    if (SearchValue === null) SearchValue = '';
    const Empid = req.user.emp_id;
    Object.assign(ViewBag, await B.perms(Empid, url));
    try {
      let MaxRows = 0;
      if (TYPE === 1) MaxRows = Number(dynamicpagging1);
      if (TYPE === 2) MaxRows = Number(dynamicpagging2);
      if (TYPE === 3) MaxRows = Number(dynamicpagging3);
      if (Page === null) Page = 1;
      const rows = await charges(FromDate, ToDate, Page, MaxRows, SearchValue, SearchField);
      const Total_Admin_Charge = mapRows(rows, PROPS);
      const TotalRecord = B.outIntOf(rows, 'totalcount'); // int.Parse(v == "" ? "0" : v)
      ViewBag.CurrentPage = Page;
      if (TYPE === 1) ViewBag.dynamicpagging = dynamicpagging1;
      if (TYPE === 2) ViewBag.dynamicpagging = dynamicpagging2;
      if (TYPE === 3) ViewBag.dynamicpagging = dynamicpagging3;
      ViewBag.orderbydate = orderbydate;
      ViewBag.GridPageSize = MaxRows;
      ViewBag.TotalRecord = TotalRecord;
      ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
      ViewBag.ToDate = ToDate;
      ViewBag.FromDate = FromDate;
      ViewBag.SearchField = SearchField;
      ViewBag.SearchValue = SearchValue;
      if (btnexel === 'Export Excel') {
        const r = await ExportReport(req, res, ViewBag, FromDate, ToDate, Page, TYPE, SearchValue, SearchField);
        if (r.sent) return undefined;
      }
      return res.json({ view: '~/Views/AdminPanel/Total_Admin_Charge/Index.cshtml', Model: Total_Admin_Charge, ...ViewBag });
    } catch (ExpObj) {
      ViewBag.ErrorMessage = ExpObj.message;
      return errorViewMsg(req, res, ExpObj, 'USP_Fund_History', { ErrorMessage: ExpObj.message });
    }
  });
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging1, int? dynamicpagging2, int? dynamicpagging3, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel, string Remark, int? TYPE)
// auth ([SessionExpireCheck] => adminAuth)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, index(null));
// route-config: "AdminPanel/Total-Admin-Charge" -> Total_Admin_Charge/Index, TYPE = 1
// auth
router.all('/admin/AdminPanel/Total-Admin-Charge', adminAuth, index(1));
// route-config: "AdminPanel/Total-TDS" -> Total_Admin_Charge/Index, TYPE = 2
// auth
router.all('/admin/AdminPanel/Total-TDS', adminAuth, index(2));
// route-config: "AdminPanel/Total-Shopping-Charge" -> Total_Admin_Charge/Index, TYPE = 3
// auth
router.all('/admin/AdminPanel/Total-Shopping-Charge', adminAuth, index(3));

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, int? page, int? TYPE, string SearchValue, string SearchField)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nInt(req.p.page), B.nInt(req.p.TYPE),
    B.nStr(req.p.SearchValue), B.nStr(req.p.SearchField));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
