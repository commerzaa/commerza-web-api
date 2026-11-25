'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BtcWithdrawalNew.cs (class BtcWithdrawalNewController => /admin/BtcWithdrawalNew/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CoinPaymentAPI = require('../../lib/admin/CoinPaymentAPI');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const {
  s, ni, reqInt, col, str, toInt32, netStr, nowStamp, tab, inlinePermissions, excelHistory, sendTsv, jTokStr, parseJObject,
} = require('./_shared/batch04A_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BtcWithdrawalNew';

/** class BtcWithdrawals */
const PROPS = ['Rownumber', 'WDID', 'Name', 'MOBILE', 'AMOUNT', 'Address', 'DATE', 'STATUS', 'ActivityByUserId', 'Username'];

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

// ---------------------------------------------------------------- ActionResult Index(int? Page, string FromDate, string ToDate, string SearchField, string Status, string SearchValue, string Userdownlinemember, int? Side, string btnexel, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/BTC-Withdrawals" -> BtcWithdrawalNew/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/BTC-Withdrawals{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  // PORT-NOTE: C# had both `Page` and `page` parameters; MVC binding is case-insensitive so both receive the same value.
  let Page = ni(req.p.Page);
  const page = ni(req.p.page);
  let FromDate = s(req.p.FromDate); let ToDate = s(req.p.ToDate); let SearchField = s(req.p.SearchField);
  let Status = s(req.p.Status); let SearchValue = s(req.p.SearchValue); let Userdownlinemember = s(req.p.Userdownlinemember);
  let Side = ni(req.p.Side); const btnexel = s(req.p.btnexel);

  url1 = legacyUrl(req).slice(1);
  url = '~/AdminPanel/BTC-Withdrawal'; // hard-coded in legacy
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (Status === null) Status = '';
  if (Side === null) Side = 0;
  if (Userdownlinemember === null) Userdownlinemember = '';
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // inline USP_GETEXCELPERMISIONSTATUS + USP_EXCEL_LINK
  const perm = await inlinePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;

  // Plid = Select REGNO From MEMBER_MASTER Where UserName='<SearchValue>' (value unused; parameterised)
  await db.scalar(DB, 'select regno from member_master where username = @SearchValue limit 1', { SearchValue });
  const MaxRows = Number(await UtilityClass.GridPageSize());
  if (Page === null) Page = 1;
  const raw = await btcList(FromDate, ToDate, Page, MaxRows, SearchField, SearchValue, Status, Userdownlinemember, Side);
  const BtcWithdrawal = mapRows(raw, PROPS);
  const TotalRecord = toInt32(str(col(raw[0], 'totalcount')));
  ViewBag.CurrentPage = Page;
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
  return res.json({ view: '~/Views/AdminPanel/BtcWithdrawalNew/Index.cshtml', Model: BtcWithdrawal, ...ViewBag });
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
  const WDID = s(req.p.WDID); // ALLBTCADDRESS, ALLBTCAMOUNT, SCERETPIN, APIKEY are bound but unused
  const APIForCall = '';
  let ret = '';
  try {
    if (WDID === '' || WDID === null) {
      return res.json('BTC Amount Can not be null.');
    }
    // [USP_PROCESSBULFWITHDRAW] @MODE='3' => list of BtcWithdrawals
    const BtcWithdrawal = mapRows(await db.proc(DB, 'USP_PROCESSBULFWITHDRAW', { MODE: '3', REMARK: '', WDID: String(WDID), TRASNCTIONID: '' }), PROPS);
    for (const Items of BtcWithdrawal) {
      const Address = Items.Address;
      const Amount = Items.AMOUNT;
      if (Amount === null || Amount === undefined) throw new Error('Specified cast is not valid.'); // non-nullable decimal from DBNull
      const SenTBTC = await CoinPaymentAPI.Withdrawal('BTC', Address, String(Amount));
      const Obj = parseJObject(SenTBTC);
      let Message = '';
      let Error_ = '';
      for (const name of Object.keys(Obj)) {
        if (name === 'Flag') Message = jTokStr(Obj[name]);
        if (name === 'Message') {
          Error_ = jTokStr(Obj[name]);
          // PORT-NOTE: legacy condition `Error != null || Error != ""` is always true => JObject.Parse(Error) always runs (throws => catch)
          const Obj1 = parseJObject(Error_);
          for (const n2 of Object.keys(Obj1)) {
            if (n2 === 'error') Error_ = jTokStr(Obj1[n2]);
          }
        }
      }
      if (Error_ === null || Error_ === '') {
        if (Message === 'success') {
          await db.procOne(DB, 'USP_PROCESSBULFWITHDRAW', { MODE: '1', REMARK: '', WDID: String(WDID), TRASNCTIONID: '' });
        } else {
          ret = 'Approval Failed';
        }
      } else {
        return res.json(Error_);
      }
    }
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_PROCESSBULFWITHDRAW');
    return res.json(APIForCall); // always "" in this controller
  }
}));

module.exports = router;
