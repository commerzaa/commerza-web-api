'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\PayoutReportController.cs (class PayoutReportController => /admin/PayoutReport/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  nInt, nStr, reqInt, col, str, cellStr, tab, nowStamp, excelHistory, writeXlsExport, inlinePerms, excelLink, trimS, firstCol, cvtInt,
} = require('./_shared/batch11-common');
const {
  PAYOUT_REPORT_PROPS, SHOW_CHART_PROPS, strictOutInt, atcBlock, Approve_WithdrawalInBulk, activityBy, tabN,
} = require('./_shared/batch11-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'PayoutReport';

// PORT-NOTE: `private static string url, url1` are shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** search-field mapping shared by Index and ExportReport */
function searchParams(SearchField, SearchValue) {
  const o = { loginid: '', phone: '', accountno: '', ifsccode: '', accountholdername: '', bankname: '', branchname: '', username: '' };
  if (SearchField === null || SearchValue === null) return { ...o, SearchField: '', SearchValue: '' };
  const v = SearchValue.trim();
  if (SearchField === 'emailid') o.loginid = v;
  else if (SearchField === 'mobile') o.phone = v;
  else if (SearchField === 'accnum') o.accountno = v;
  else if (SearchField === 'ifsc') o.ifsccode = v;
  else if (SearchField === 'accholname') o.accountholdername = v;
  else if (SearchField === 'bankname') o.bankname = v;
  else if (SearchField === 'branchname') o.branchname = v;
  else if (SearchField === 'username') o.username = v;
  return { ...o, SearchField, SearchValue };
}

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, ByStatus, page, OrderBy) {
  const userid = req.user.emp_id;
  const Filename = `PayoutReport_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  const s = searchParams(SearchField, SearchValue);
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  const Obj = mapRows(await db.proc(DB, 'USP_WITHDRAWLREQUESTREPORT', {
    WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: s.loginid, Phone: s.phone, AccountNo: s.accountno, IFSCCODE: s.ifsccode,
    AccountHolderName: s.accountholdername, BANKNAME: s.bankname, BRANCHNAME: s.branchname, STARTROWINDEX: page, MAXROWS: '100000', Mode: '1',
    Username: s.username, STATUS: ByStatus.trim(),
  }), PAYOUT_REPORT_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'PayoutReport.xls', downloadName: ' PayoutReport.xls', Filename, ViewBag,
      headers: ['S.No.', 'Date', 'Username', 'Name', 'Contact No.', 'Withdrawal', 'Wallet Address', 'Status', 'Activity By'],
      rows: Obj, innerProc: 'PayoutReport', outerProc: 'USP_WITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'Date')) + ' \t');
        w(tab(cellStr(item, 'UserName')) + ' \t');
        w(tab(cellStr(item, 'FullName')) + ' \t');
        w(tab(cellStr(item, 'PHONE')) + ' \t');
        w(tab(cellStr(item, 'PayableAmount')) + ' \t');
        w(tab(cellStr(item, 'ATC_WalletAddress')) + ' \t');
        w(tab(cellStr(item, 'Status')) + ' \t');
        w(tabN(cellStr(item, 'ActivityByUserId'), 3) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin")); releasepayout moves money
// route-config: "AdminPanel/payout-report" -> PayoutReport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/payout-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let ByStatus = nStr(req.p.ByStatus);
  let page = nInt(req.p.page);
  let OrderBy = nStr(req.p.OrderBy);
  const releasepayout = nStr(req.p.releasepayout);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  if (dynamicpagging === null) dynamicpagging = cvtInt(config.app.DynamicPagging === undefined ? null : config.app.DynamicPagging);
  if (orderbydate === null) orderbydate = '';
  const Employeeid = req.user.emp_id;
  const perm = await inlinePerms(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url); // Convert.ToInt32(v == "0" ? "0" : v)
  const MaxRows = Number(dynamicpagging);
  const s = searchParams(SearchField, SearchValue);
  SearchField = s.SearchField; SearchValue = s.SearchValue;
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_WITHDRAWLREQUESTREPORT', {
    WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: s.loginid, Phone: s.phone, AccountNo: s.accountno, IFSCCODE: s.ifsccode,
    AccountHolderName: s.accountholdername, BANKNAME: s.bankname, BRANCHNAME: s.branchname, STARTROWINDEX: page, MAXROWS: MaxRows, Mode: '1',
    Username: s.username, STATUS: ByStatus.trim(), orderbydate,
  });
  const Obj = mapRows(rows, PAYOUT_REPORT_PROPS);
  const TotalRecord = strictOutInt(rows, 'recordcount');
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  // releasepayout: "Release Current Page All Payout"
  if (releasepayout !== null) {
    if (releasepayout === 'Release Current Page All Payout') {
      for (const ItemForPayoutRelease of Obj) {
        if (trimS(ItemForPayoutRelease.Status).toLowerCase() === 'pending') {
          if (ItemForPayoutRelease.ATC_WalletAddress !== '' && ItemForPayoutRelease.ATCUserId !== '') {
            await Approve_WithdrawalInBulk(req, cvtInt(ItemForPayoutRelease.WDID), 1, 'Your Payout Released');
          }
        }
      }
    }
  }
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.SearchValue = SearchValue;
  ViewBag.ByStatus = ByStatus;
  ViewBag.OrderBy = OrderBy;
  await atcBlock(req, ViewBag, 'Index', 'USP_WITHDRAWLREQUESTREPORT');
  if (btnexel === 'Export Excel') {
    // ExportReport(SearchField, SearchValue, ...) gets the already-defaulted values
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, ByStatus, page, OrderBy);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/PayoutReport/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromDate), nStr(req.p.toDate),
    nStr(req.p.ByStatus), nInt(req.p.page), nStr(req.p.OrderBy));
  if (!r.sent) res.send(''); // void action
}));

// ---------------------------------------------------------------- JsonResult Approve_Withdrawal(int wdid, int status, string remarks)
// auth (approves withdrawals / moves money; reads Session["Admin_User"])
router.all(`/admin/${C}/Approve_Withdrawal{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const wdid = reqInt(req.p.wdid, 'wdid');
  const status = reqInt(req.p.status, 'status');
  const remarks = nStr(req.p.remarks);
  let ret = '';
  const TransactionId = '';
  let walletaddress = '';
  try {
    if (status === 1) {
      const BFXWALLETAPI = firstCol(await db.query(DB,
        "select coalesce(caption, '') as bfxwalletapi from settings where caption = 'ISBFXPAYOUT' and active = 1 limit 1"));
      if (BFXWALLETAPI === 'ISBFXPAYOUT') {
        const Wallet_Address = firstCol(await db.query(DB,
          "select coalesce(wallet_address, '') as wallet_address from tbl_withdrawals where wdid = @wdid limit 1", { wdid }));
        const withdrawalRow = firstCol(await db.query(DB,
          'select coalesce(paybleamount, 0) as paybleamount from tbl_withdrawals where wdid = @wdid limit 1', { wdid }));
        const withdrawal = withdrawalRow === null || withdrawalRow === undefined ? 0 : Number(withdrawalRow);
        // PORT-NOTE: the BFX wallet API key and URL were hard-coded in the C#; read from config.app.BFXWalletAPIKey / BFXWalletTransferURL.
        const OBjSendReceive = { APIKey: config.app.BFXWalletAPIKey || '', BFXWalletAddress: Wallet_Address, Coin: withdrawal };
        let StrPostData = JSON.stringify(OBjSendReceive);
        try {
          const resp = await axios.post(config.app.BFXWalletTransferURL || '', StrPostData, {
            headers: { 'Content-Type': 'application/json' }, transformResponse: [(d) => d], responseType: 'text',
          });
          StrPostData = String(resp.data);
          let Return = StrPostData;
          const WordObj = Return.split(':');
          if (WordObj.length < 2) throw new Error('Index was outside the bounds of the array.');
          if (WordObj[1] === '"error","Message"') {
            return res.json(StrPostData);
          } else if (WordObj[1] === '"success","Message"') {
            if (WordObj.length < 3) throw new Error('Index was outside the bounds of the array.');
            Return = WordObj[2];
            const wordobj1 = Return.split('"');
            if (wordobj1.length < 2) throw new Error('Index was outside the bounds of the array.');
            walletaddress = wordobj1[1];
          }
        } catch (ExpObj) {
          await errorInsert(req, ExpObj, 'Approve_Withdrawal');
        }
      }
    }
    const ActivityByUserId = activityBy(req);
    const row = await db.procOne(DB, 'USP_WITHDRAWAL_APPROVEORREJECT', {
      WDID: wdid, MODE: status, STRRESULT: remarks, ActivityByUserId, TransactionId,
    });
    ret = str(col(row, 'strresult'));
    await db.exec(DB, 'update tbl_withdrawals set transactionid = @walletaddress where wdid::text = @wdid', { walletaddress, wdid: String(wdid) });
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_WITHDRAWAL_APPROVEORREJECT');
    ret = String(ExpObj.message);
    return res.json(ret);
  }
}));

// ---------------------------------------------------------------- public string Approve_WithdrawalInBulk(int wdid, int status, string remarks)
// auth (approves withdrawals / ATC transfer; reads Session["Admin_User"]). Public string method => routable, Content(string) reply.
router.all(`/admin/${C}/Approve_WithdrawalInBulk{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const wdid = reqInt(req.p.wdid, 'wdid');
  const status = reqInt(req.p.status, 'status');
  const r = await Approve_WithdrawalInBulk(req, wdid, status, nStr(req.p.remarks));
  res.type('text/html').send(r);
}));

// ---------------------------------------------------------------- JsonResult showdata(int wdid)
// auth. PORT-NOTE: legacy had no session check; adminAuth added (returns member bank/withdrawal data).
router.all(`/admin/${C}/showdata{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const wdid = reqInt(req.p.wdid, 'wdid');
  const GrowthList = mapRows(await db.proc(DB, 'usp_get10lastrecord', { wdid }), SHOW_CHART_PROPS);
  return res.json(GrowthList);
}));

module.exports = router;
