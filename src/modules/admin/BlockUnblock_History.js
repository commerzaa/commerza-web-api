'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BlockUnblock_History.cs (class BlockUnblock_HistoryController => /admin/BlockUnblock_History/...)
// Database: affiliate (Db_Affiliate). Model class BlockUnblockHistory (same file) => HIST_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { str, sp, ip, outVal, ts, tab, nowStamp, exportXls } = require('./_shared/batch04B_common');
const { excelHistory, strTrim, viewPerms } = require('./_shared/batch04_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BlockUnblock_History';

const HIST_PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILE', 'EMAILID', 'SPONSERID', 'REGDATE', 'Blocked_date', 'REMARK', 'DOC'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string UserName, string EMAILID, string fromDate, string toDate, string orderbydate, string SearchField, int? LeftRight, string SearchValue, int? page, string btnexel, string ddlsearchDownline)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/BlockUnblock-History" -> BlockUnblock_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/BlockUnblock-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ip(req, 'dynamicpagging');
  let UserName = sp(req, 'UserName');
  let EMAILID = sp(req, 'EMAILID');
  let fromDate = sp(req, 'fromDate');
  let toDate = sp(req, 'toDate');
  let orderbydate = sp(req, 'orderbydate');
  let SearchField = sp(req, 'SearchField');
  let LeftRight = ip(req, 'LeftRight');
  let SearchValue = sp(req, 'SearchValue');
  let page = ip(req, 'page');
  let btnexel = sp(req, 'btnexel');
  let ddlsearchDownline = sp(req, 'ddlsearchDownline');

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (UserName === null) UserName = '';
  if (EMAILID === null) EMAILID = '';
  if (SearchField === null) SearchField = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ddlsearchDownline === null) ddlsearchDownline = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  const ViewBag = await viewPerms(req, url, ['bal']);
  if (btnexel === null) btnexel = '';
  if (LeftRight === null) LeftRight = 0;
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // USP_BLOCKUNBLOCKHISTORY @STARTROWINDEX,@MAXROWS,@USERNAME,@EMAILID,@TOTALCOUNT out,@SearchField,@SearchValue,@orderbydate,@fromdate,@todate
  const rows = await db.proc(DB, 'USP_BLOCKUNBLOCKHISTORY', {
    STARTROWINDEX: page, MAXROWS: MaxRows, USERNAME: strTrim(UserName), EMAILID: strTrim(EMAILID), SearchField, SearchValue, orderbydate,
    fromdate: strTrim(fromDate), todate: strTrim(toDate),
  });
  const BlockUnblockHistory = mapRows(rows, HIST_PROPS);
  const tc = str(outVal(rows, 'TOTALCOUNT'));
  const TotalRecord = tc === '' ? 0 : parseInt(tc, 10);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.fromdate = fromDate;
  ViewBag.todate = toDate;
  ViewBag.UserName = UserName;
  ViewBag.EMAILID = EMAILID;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, UserName, EMAILID, SearchValue, SearchField)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/BlockUnblock_History/Index.cshtml', Model: BlockUnblockHistory, ...ViewBag });
}));

/** public void ExportReport(string UserName, string EMAILID, string SearchValue, string SearchField) - true when the download was sent */
async function ExportReport(req, res, ViewBag, UserName, EMAILID, SearchValue, SearchField) { // eslint-disable-line no-unused-vars
  const userid = req.user.emp_id;
  const Filename = `Member_ManageList_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  // USP_BLOCKUNBLOCKHISTORY (7 parameters; SearchField/SearchValue passed as "")
  const rows = await db.proc(DB, 'USP_BLOCKUNBLOCKHISTORY', {
    STARTROWINDEX: 1, MAXROWS: 999999, USERNAME: UserName, EMAILID, SearchField: '', SearchValue: '',
  });
  const list = mapRows(rows, HIST_PROPS);
  return exportXls({
    req, res, rows: list, sheet: 'BlockUnblockHistory', procName: 'usp_Blocked_memberList', itemProcName: 'getblockedMemberList', ViewBag,
    headers: ['S.No. \t', 'Username \t', 'Mobile \t', 'Email \t', 'Blocked Date \t', 'Registration Date \t', 'Activation Date \t', 'Remark \t'],
    row: (item, w) => {
      w(tab(ts(item.ROWNUMBER)) + ' \t');
      w(tab(ts(item.USERNAME)) + ' \t');
      w(tab(ts(item.MOBILE)) + ' \t');
      w(tab(ts(item.EMAILID)) + ' \t');
      w(tab(ts(item.Blocked_date)) + ' \t');
      w(tab(ts(item.REGDATE)) + ' \t');
      w(tab(ts(item.DOC)) + ' \t');
      w(tab(ts(item.REMARK)) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sp(req, 'UserName'), sp(req, 'EMAILID'), sp(req, 'SearchValue'), sp(req, 'SearchField'));
  if (!sent) res.send(''); // void action => empty response
}));

module.exports = router;
