'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BtcWithdrawal.cs (class BtcWithdrawalController => /admin/BtcWithdrawal/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  s, ni, reqInt, col, str, toInt32, netStr, nowStamp, tab, DYNAMIC_PAGING, permissions, excelHistory, sendTsv, jTokStr, parseJObject,
} = require('./_shared/batch04-a-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BtcWithdrawal';

/** class BtcWithdrawal */
const PROPS = ['Rownumber', 'WDID', 'Name', 'MOBILE', 'AMOUNT', 'TRANSAMOUNT', 'REMAINAMOUNT', 'WITHDRAWAMOUNT', 'Address', 'DATE', 'STATUS',
  'ActivityByUserId', 'Username'];

// PORT-NOTE: `private static string url, url1` are process-wide (shared by all admins), like the legacy static fields.
let url = '';
let url1 = '';

/** WebClient.DownloadString(url) */
async function downloadString(u) {
  const r = await axios.get(u, { responseType: 'text', transformResponse: (x) => x });
  return typeof r.data === 'string' ? r.data : String(r.data);
}

/** [USP_BTC_WITHDRAWAL] @FromDate,@ToDate,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@StrResult OUT,@TotalCount OUT,@STATUS,@USERDOWNLINEMEMBER,@SIDE */
const btcList = (FromDate, ToDate, Page, MaxRows, SearchField, SearchValue, Status, Userdownlinemember, Side) => db.proc(DB, 'USP_BTC_WITHDRAWAL', {
  FromDate, ToDate, StartRowIndex: Page, MaxRows, SearchField, SearchValue, StrResult: '', STATUS: Status, USERDOWNLINEMEMBER: Userdownlinemember, SIDE: Side,
});

// ---------------------------------------------------------------- public void ExportReport(SearchField, SearchValue, Status, FromDate, ToDate, Userdownlinemember, int? Side, int? page)
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, Status, FromDate, ToDate, Userdownlinemember, Side, page) {
  const userid = req.user.emp_id;
  const Filename = `Btc_Withdrawal_${userid}_${nowStamp()}`;
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused, legacy passes 10000)
  if (page === null) page = 1;
  const rows = mapRows(await btcList(FromDate, ToDate, page, 10000, SearchField, SearchValue, Status, Userdownlinemember, Side), PROPS);
  if (rows.length > 0) {
    return sendTsv({
      req, res, ViewBag, sheet: 'Btc_Withdrawal.xls', Filename, rows, rowErrProc: 'BtcWithdrawal', outerErrProc: 'USP_BTC_WITHDRAWAL',
      headers: ['S.No.', 'Name', 'Username', 'Mobile', 'Date', 'BTC', 'BTC Address', 'Status', 'Action By'],
      cells: (item, w) => {
        w(tab(netStr(item.Rownumber)) + ' \t');
        w(tab(netStr(item.Name)) + ' \t');
        w(tab(netStr(item.Username)) + ' \t');
        w(tab(netStr(item.MOBILE)) + ' \t');
        w(tab(netStr(item.DATE)) + ' \t');
        w(tab(netStr(item.AMOUNT)) + ' \t');
        w(tab(netStr(item.Address)) + ' \t');
        w(tab(netStr(item.STATUS)) + ' \t');
        w(tab(netStr(item.ActivityByUserId)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, int? Page, string FromDate, string ToDate, string SearchField, string Status, string SearchValue, string Userdownlinemember, int? Side, string btnexel, int? page)
// auth ([SessionExpireCheck] => redirect ~/secure-admin-login-.../logout without a session)
// route-config: "AdminPanel/BTC-Withdrawal" -> BtcWithdrawal/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/BTC-Withdrawal{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ni(req.p.dynamicpagging);
  // PORT-NOTE: C# had both `Page` and `page` parameters; MVC binding is case-insensitive so both receive the same value.
  let Page = ni(req.p.Page);
  const page = ni(req.p.page);
  let FromDate = s(req.p.FromDate); let ToDate = s(req.p.ToDate); let SearchField = s(req.p.SearchField);
  let Status = s(req.p.Status); let SearchValue = s(req.p.SearchValue); let Userdownlinemember = s(req.p.Userdownlinemember);
  let Side = ni(req.p.Side); const btnexel = s(req.p.btnexel);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = DYNAMIC_PAGING();
  if (Status === null) Status = '';
  if (Side === null) Side = 0;
  if (Userdownlinemember === null) Userdownlinemember = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const perm = await permissions(url, Empid);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;

  // Plid = Select REGNO From MEMBER_MASTER Where UserName='<SearchValue>' (value unused; parameterised)
  await db.scalar(DB, 'select regno from member_master where username = @SearchValue limit 1', { SearchValue });
  const MaxRows = Number(dynamicpagging);
  if (Page === null) Page = 1;
  const raw = await btcList(FromDate, ToDate, Page, MaxRows, SearchField, SearchValue, Status, Userdownlinemember, Side);
  const BtcWithdrawal = mapRows(raw, PROPS);
  const TotalRecord = toInt32(str(col(raw[0], 'totalcount')));
  ViewBag.CurrentPage = Page; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.ToDate = ToDate;
  ViewBag.FromDate = FromDate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, Status, FromDate, ToDate, Userdownlinemember, Side, page);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/BtcWithdrawal/Index.cshtml', Model: BtcWithdrawal, ...ViewBag });
}));

// auth (public void action; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, s(req.p.SearchField), s(req.p.SearchValue), s(req.p.Status), s(req.p.FromDate), s(req.p.ToDate),
    s(req.p.Userdownlinemember), ni(req.p.Side), ni(req.p.page));
  if (!r.sent) res.send('');
}));

/** UpdateStatusForWithdrawal / UpdateStatusForWithdrawalAuto: [USP_PROCESSBULFWITHDRAW] @MODE,@REMARK,@WDID,@TRASNCTIONID,@RESULT OUT */
async function updateStatus(req, res, MODE) {
  try {
    let ret = '';
    const row = await db.procOne(DB, 'USP_PROCESSBULFWITHDRAW', { MODE, REMARK: s(req.p.Remark), WDID: s(req.p.WDID), TRASNCTIONID: '' });
    ret = str(col(row, 'result')); // SpOutPut.Value.ToString() (DBNull => "")
    ret = ret === '1' ? 'SUCCESS' : 'Error';
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_PROCESSBULFWITHDRAW');
    return res.json(ExpObj.stack || String(ExpObj)); // Json(ExpObj.ToString())
  }
}

// ---------------------------------------------------------------- JsonResult UpdateStatusForWithdrawal(string BTC, string Status, string WDID, string Remark)
// auth (no session check in legacy; admin approval operation => protected)
router.all(`/admin/${C}/UpdateStatusForWithdrawal{/:id}`, adminAuth, asyncHandler((req, res) => updateStatus(req, res, '2')));

// ---------------------------------------------------------------- JsonResult UpdateStatusForWithdrawalAuto(string BTC, string Status, string WDID, string Remark)
// auth (no session check in legacy; admin approval operation => protected)
router.all(`/admin/${C}/UpdateStatusForWithdrawalAuto{/:id}`, adminAuth, asyncHandler((req, res) => updateStatus(req, res, '1')));

// ---------------------------------------------------------------- JsonResult GetWithdrawalDetailsByWdid(int WDID)
// auth (no session check in legacy; admin data => protected)
router.all(`/admin/${C}/GetWithdrawalDetailsByWdid{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const WDID = reqInt(req.p.WDID, 'WDID');
  // [USP_UPDATEWITHDRAWALSTATUS] @MODE,@WDID,@BTC,@STATUS,@REMARK,@RESULT OUT
  const rows = await db.proc(DB, 'USP_UPDATEWITHDRAWALSTATUS', { MODE: 2, WDID, BTC: '', STATUS: '', REMARK: '' });
  res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetWalletBalance(string APIKEY)
// auth (no session check in legacy; exposes wallet balance => protected)
router.all(`/admin/${C}/GetWalletBalance{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const APIKEY = s(req.p.APIKEY);
  let ret = '';
  try {
    const APIForCall = 'https://block.io/api/v2/get_balance/?api_key=' + str(APIKEY) + '';
    const o = parseJObject(await downloadString(APIForCall));
    const TransactionStatus = netStr(o.status === undefined ? null : jTokStr(o.status));
    if (TransactionStatus === 'success') {
      const balance = jTokStr(o.data.available_balance);
      ret = TransactionStatus + '^' + balance;
    } else {
      ret = 'Approval Failed';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetWalletBalance');
    return res.json('Invalid API Key');
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult FinalProceedBTC(string ALLBTCADDRESS, string ALLBTCAMOUNT, string SCERETPIN, string APIKEY, string WDID)
// auth (no session check in legacy; sends BTC => protected)
router.all(`/admin/${C}/FinalProceedBTC{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ALLBTCADDRESS = s(req.p.ALLBTCADDRESS); const ALLBTCAMOUNT = s(req.p.ALLBTCAMOUNT); const SCERETPIN = s(req.p.SCERETPIN);
  const APIKEY = s(req.p.APIKEY); const WDID = s(req.p.WDID);
  let SenderAddress = '';
  let APIForCall = '';
  let ret = '';
  try {
    let Walletaddress = '';
    const APIForCallForAddress = 'https://block.io/api/v2/get_my_addresses/?api_key=' + str(APIKEY) + '';
    const w = parseJObject(await downloadString(APIForCallForAddress));
    const WalletStatus = netStr(w.status === undefined ? null : jTokStr(w.status));
    if (WalletStatus === 'success') {
      const addresses = w.data.addresses;
      Walletaddress = netStr(jTokStr(addresses[0].address));
      // JavaScriptSerializer.Deserialize<GetAddress[]>(SenderAllAddress)
      for (const Item of addresses) {
        SenderAddress = SenderAddress + ',' + netStr(Item.address === undefined ? null : Item.address);
      }
    }
    SenderAddress = SenderAddress.replace(/^,+/, '');
    if (Walletaddress !== '') {
      // PORT-NOTE: query string built by plain concatenation (no URL encoding), like the legacy WebClient call.
      APIForCall = 'https://block.io/api/v2/withdraw_from_addresses/?api_key=' + str(APIKEY) + '&from_addresses=' + SenderAddress
        + '&to_addresses=' + str(ALLBTCADDRESS) + '&amounts=' + str(ALLBTCAMOUNT) + '&pin=' + str(SCERETPIN) + '';
      const o = parseJObject(await downloadString(APIForCall));
      const TransactionStatus = netStr(o.status === undefined ? null : jTokStr(o.status));
      if (TransactionStatus === 'success') {
        const txid = jTokStr(o.data.txid);
        ret = TransactionStatus + '^' + txid;
        await db.procOne(DB, 'USP_PROCESSBULFWITHDRAW', { MODE: '1', REMARK: '', WDID: WDID === null ? null : String(WDID), TRASNCTIONID: txid });
      } else {
        ret = 'Approval Failed';
      }
    }
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_PROCESSBULFWITHDRAW');
    // PORT-NOTE: legacy returned the API URL (contains api_key and pin) to the client on error; kept (security concern).
    return res.json(APIForCall);
  }
}));

module.exports = router;
