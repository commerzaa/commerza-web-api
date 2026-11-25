'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Gst_Group.cs (class Gst_GroupController, no namespace => /admin/Gst_Group/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const GetIP = require('../../lib/admin/GetIP');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, col, str, tab, cellStr, nowStamp, cvtInt, cvtDec, excelHistory, writeXlsExport,
} = require('./_shared/batch08-common');
const { outVal, pagePerm, excelLinkRaw } = require('./_shared/batch08-d2-common');
const {
  GST_GROUP_DETAIL_PROPS, GST_DDETAIL_PROPS, netParseInt, netToBoolean, netDecimalString,
} = require('./_shared/batch08-a2-common');

const router = express.Router();
const C = 'Gst_Group';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** Convert.ToInt16(string) of AppSettings["DynamicPagging"] (null => 0, invalid => FormatException) */
const toInt16 = (v) => cvtInt(v === undefined ? null : v);

// ---------------------------------------------------------------- public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'Manage_GST' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const rows = await db.proc(DB, 'usp_GetAllGstGroupDetail', { StartRowIndex: 1, MaxRows: 9999999 });
  const GSTdetails = mapRows(rows, GST_GROUP_DETAIL_PROPS);
  if (GSTdetails.length > 0) {
    let srno = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Manage_GST.xls', Filename, downloadName: ' Manage_GST.xls', // "attachment; filename= Manage_GST.xls"
      headers: ['S.No.', 'Group Name', 'GST %', 'Active'],
      rows: GSTdetails,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT', // (sic) legacy PROCEDURENAME
      cells: (item, w) => {
        w('\n');
        w(tab(String(srno)) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(netDecimalString(item.Value)) + ' \t');
        w(tab(netDecimalString(item.Active)) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/manage-gst" -> Gst_Group/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/manage-gst'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let page = nInt(req.p.page);
  let btnexel = nStr(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = toInt16(value);
  }
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const p = await pagePerm(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out ; Convert.ToInt32(v == "0" ? "0" : v) (DBNull "" => FormatException)
  const ex = await excelLinkRaw(url);
  const isactive = netParseInt(ex === '0' ? '0' : ex);
  ViewBag.excelactive = isactive;
  if (btnexel === null) btnexel = '';
  if (page === null) page = 1;

  const MaxRows = Number(dynamicpagging);
  const rows = await db.proc(DB, 'usp_GetAllGstGroupDetail', { StartRowIndex: page, MaxRows });
  const GSTdetails = mapRows(rows, GST_GROUP_DETAIL_PROPS);
  const TotalRecord = netParseInt(outVal(rows, 'TotalCount')); // int.Parse(spOutput.Value.ToString())
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  const TaxType = mapRows(await db.query(DB, 'select tttid, taxtype from tbl_taxtype where active = 1', {}), GST_DDETAIL_PROPS);
  ViewBag.TaxType = TaxType;
  ViewBag.dynamicpagging = dynamicpagging;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Gst_Group/Index.cshtml', Model: GSTdetails, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- public JsonResult SubmitGstGroupdetail(string GSTID, string mode, string Name, string GSTValue, string Active, int TAXTYPE)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/SubmitGstGroupdetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const GSTID = nStr(req.p.GSTID);
  const mode = nStr(req.p.mode);
  const Name = nStr(req.p.Name);
  const GSTValue = nStr(req.p.GSTValue);
  const Active = nStr(req.p.Active);
  const TAXTYPE = reqInt(req.p.TAXTYPE, 'TAXTYPE');
  const empId = req.user.emp_id;
  const IpAddress = await GetIP.GetLocalIP(req);
  let OutputResult = '';
  const Value = cvtDec(GSTValue);
  const GStActive = netToBoolean(Active);
  const gstId = cvtInt(GSTID);
  // a SqlParameter with a null Value is not sent => "The parameterized query ... expects the parameter '@Mode', which was not supplied."
  if (mode === null) throw new Error("The parameterized query expects the parameter '@Mode', which was not supplied.");
  if (Name === null) throw new Error("The parameterized query expects the parameter '@Name', which was not supplied.");
  const params = { GSTID: gstId, Mode: mode, Name, GSTValue: Value, Active: GStActive, IpAddress, empId, TAXTYPE };
  const row = await db.procOne(DB, 'usp_CreateGSTGroup', params);
  OutputResult = str(col(row, 'result'));
  return res.json(OutputResult);
}));

// private static bool ThumbnailCallback() { throw new NotImplementedException(); }  -- never called; not routed (private).

// ---------------------------------------------------------------- public JsonResult EditGSTDetail(string GSTID)
// public (legacy had no session check; returns GST master data only)
router.all(`/admin/${C}/EditGSTDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const GSTID = nStr(req.p.GSTID);
  const rDetail = [];
  const objutil = new DataUtility();
  const param = [DataUtility.SqlParameter('@GSTID', cvtInt(GSTID))];
  const ds = await objutil.GetDataSetSP(param, 'usp_GetAllGstGroupDetailById');
  for (const dtrow of ds.Tables[0]) {
    const Rd = { TAXTYPE: null, TTTID: 0, GSTID: null, Name: null, Value: null, Active: null };
    const v = (k) => { const x = col(dtrow, k); if (x === undefined) throw new Error(`Column '${k}' does not belong to table Table.`); return x; };
    const s = (x) => (x === null ? '' : (typeof x === 'boolean' ? (x ? 'True' : 'False') : str(x))); // DataRow[x].ToString() (DBNull => "")
    Rd.GSTID = s(v('GSTID'));
    Rd.Name = s(v('Name'));
    const val = v('Value');
    if (val === null) throw new Error('Object cannot be cast from DBNull to other types.');
    Rd.Value = Number(val).toFixed(2); // Convert.ToDecimal(...).ToString("0.00")
    Rd.Active = s(v('Active'));
    const tt = v('TTTID');
    if (tt === null) throw new Error('Object cannot be cast from DBNull to other types.');
    Rd.TTTID = cvtInt(typeof tt === 'string' ? tt : Number(tt));
    rDetail.push(Rd);
  }
  return res.json(rDetail);
}));

module.exports = router;
