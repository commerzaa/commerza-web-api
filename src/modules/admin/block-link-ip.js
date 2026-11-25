'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BlockLinkIP.cs (class BlockLinIPController => /admin/BlockLinIP/...)
// Database: affiliate (Db_Affiliate). Model class BlockLinkIP (same file) => BLOCK_PROPS. No RouteConfig entry targets this controller.
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { str, sp, ip, outVal, ts, tab, nowStamp, exportXls } = require('./_shared/batch04-b-common');
const { excelHistory, viewPerms } = require('./_shared/batch04-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BlockLinIP';

const BLOCK_PROPS = ['RowNumber', 'Status', 'Block_Date', 'Emp_Name', 'IP_Address', 'BLID'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

const toInt16 = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10)); // Convert.ToInt16(string) (null => 0)

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string btnexel, string FromDate, string ToDate, string IPAddress, string EmpName, int? ddlcustpage)
// auth (reads Session["Admin_User"] first => NullReferenceException without a session)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ip(req, 'dynamicpagging');
  let orderbydate = sp(req, 'orderbydate');
  let Page = ip(req, 'Page');
  let btnexel = sp(req, 'btnexel');
  let FromDate = sp(req, 'FromDate');
  let ToDate = sp(req, 'ToDate');
  let IPAddress = sp(req, 'IPAddress');
  let EmpName = sp(req, 'EmpName');
  let ddlcustpage = ip(req, 'ddlcustpage');

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (orderbydate === null) orderbydate = '';
  await viewPerms(req, url, ['perm'], ViewBag);
  if (dynamicpagging === null) dynamicpagging = toInt16(config.app.DynamicPagging);
  await viewPerms(req, url, ['link'], ViewBag);
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (btnexel === null) btnexel = '';
  if (IPAddress === null) IPAddress = '';
  if (EmpName === null) EmpName = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  try {
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const loginid = req.user.emp_id; // eslint-disable-line no-unused-vars
    // DBO.usp_BlocklinkIP @BLID,@IP_Address,@StartIndexRow,@MaxRow,@Emp_ID,@Emp_Name,@Mode,@From,@To,@Result out,@TOTALCOUNT out,@orderbydate
    const rows = await db.proc(DB, 'usp_BlocklinkIP', {
      BLID: '0', IP_Address: IPAddress, StartIndexRow: Page, MaxRow: MaxRows, Emp_ID: '0', Emp_Name: EmpName, Mode: '3', From: FromDate, To: ToDate, orderbydate,
    });
    const LstBlock = mapRows(rows, BLOCK_PROPS);
    const tc = str(outVal(rows, 'TOTALCOUNT'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.CurrentPage = Page;
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.GridPageSize = ddlcustpage;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.IPAddress = IPAddress;
    ViewBag.EmpName = EmpName;
    ViewBag.FromDate = FromDate;
    ViewBag.ToDate = ToDate;
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, FromDate, ToDate, EmpName, IPAddress)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/BlockLinkIP/Index.cshtml', Model: LstBlock, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    return res.json({ view: '~/Views/AdminPanel/BlockLinkIP/Index.cshtml', ...ViewBag });
  }
}));

/** public void ExportReport(string FromDate, string ToDate, string EmpName, string IPAddress) - returns true when the download was sent */
async function ExportReport(req, res, ViewBag, FromDate, ToDate, EmpName, IPAddress) {
  const userid = req.user.emp_id;
  const Filename = `BlackListIP_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  // same proc without @orderbydate, all rows
  const rows = await db.proc(DB, 'usp_BlocklinkIP', {
    BLID: '0', IP_Address: IPAddress, StartIndexRow: 1, MaxRow: 999999, Emp_ID: '0', Emp_Name: EmpName, Mode: '3', From: FromDate, To: ToDate,
  });
  const LstBlock = mapRows(rows, BLOCK_PROPS);
  return exportXls({
    req, res, rows: LstBlock, sheet: 'BlackListIP', procName: 'usp_Blocked_memberList', itemProcName: 'getblockedMemberList', ViewBag,
    headers: ['S.No. \t', 'IP Address \t', 'Block Date\t', 'Emp Name \t'],
    row: (item, w) => {
      w(tab(ts(item.RowNumber)) + ' \t');
      w(tab(ts(item.IP_Address)) + ' \t');
      w(tab(ts(item.Block_Date)) + ' \t');
      w(tab(ts(item.Emp_Name)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sp(req, 'FromDate'), sp(req, 'ToDate'), sp(req, 'EmpName'), sp(req, 'IPAddress'));
  if (!sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult BlockAddress(string IP_Addrress, string Mode, string BLID)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/BlockAddress{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const IP_Addrress = sp(req, 'IP_Addrress');
  const Mode = sp(req, 'Mode');
  const BLID = sp(req, 'BLID');
  const loginid = req.user.emp_id;
  // PORT-NOTE: legacy passed '' for @MaxRow/@StartIndexRow (SQL Server converts '' to int 0); 0 is passed here.
  const rows = await db.proc(DB, 'usp_BlocklinkIP', {
    BLID, IP_Address: IP_Addrress, StartIndexRow: 0, MaxRow: 0, Emp_ID: loginid, Emp_Name: '', Mode, From: '', To: '',
  });
  const Result = str(outVal(rows, 'Result'));
  res.json(Result);
}));

module.exports = router;
