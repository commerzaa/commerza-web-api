'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Give_Help_Btcauto.cs (class Give_Help_BtcautoController => /admin/Give_Help_Btcauto/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; ExportReport (public void => routable) -> route + _shared/batch07E_giveHelp.exportBody (used by Index) ;
//           GenrateAddress -> route ; CreateBTCLink (public string => routable) -> route + internal function (used by GenrateAddress).
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CoinPaymentAPI = require('../../lib/admin/CoinPaymentAPI');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');
const G = require('./_shared/batch07-e-give-help');

const router = express.Router();
const DB = 'affiliate';
const C = 'Give_Help_Btcauto';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';

const opts = {
  view: '~/Views/AdminPanel/Give_Help_Btcauto/Index.cshtml',
  sheet: 'Primary_BTC_Link.xls',
  url: () => url,
  setUrl: (u) => { url = u; },
  indexMaxRows: (MaxRows) => MaxRows,
  exportMaxRows: 9999999,
  isfirstlinkonly: '1',
  dateCell: () => '01/08/2018 (0 Days)', // hard-coded literal in the legacy export
};

/** JToken["key"].ToString(): missing key => NullReferenceException; JSON null => ""; objects/arrays => JSON text. */
function jstr(obj, key) {
  if (obj === null || obj === undefined || typeof obj !== 'object' || !(key in obj) || obj[key] === undefined) throw B.nullRef();
  const v = obj[key];
  if (v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
/** JObject.Parse / JArray.Parse */
function jparse(s) {
  if (s === null || s === undefined) throw new Error('Value cannot be null.');
  return JSON.parse(typeof s === 'string' ? s : JSON.stringify(s));
}

/** fire-and-forget replacement for `new Thread(delegate { ... }).Start()` */
function thread(fn, what) {
  Promise.resolve().then(fn).catch((e) => console.error(`[admin] ${what} thread failed:`, e.message));
}

const SMS_PROPS = ['ID', 'ModuleId', 'Action_Name', 'Sms_Content', 'Action_Status', 'Sms_Send_Status', 'SMSCategory', 'TemplateID'];
const EMAIL_PROPS = ['EID', 'Action_Name', 'Email_Content', 'Action_Status', 'Email_Or_SMS', 'Api_Status', 'AutoRemainderType', 'Email_Send_To',
  'Email_Send_Status', 'IsEmailActive', 'Email_Subject', 'EmailCategory'];
const need = (o) => { if (o === null || o === undefined) throw B.nullRef(); return o; };

/** public string CreateBTCLink(string investID, string linkAmount, string receiverUserName, string ProviderUsername, string Providermobile, string providerLoginid, string Qrcode_Url, string Txn_Id, string GeneratedBtcAddress, string Amount) */
async function CreateBTCLink(investID, linkAmount, receiverUserName, ProviderUsername, Providermobile, providerLoginid, Qrcode_Url, Txn_Id, GeneratedBtcAddress, Amount) {
  let SenderMobileSMS = '';
  let ReciverMobileSMS = '';
  let SenderEmailSubject = '';
  let ReciverEmailSubject = '';
  let SenderDynamicEmailSms = '';
  let ReciverDynamicEmailSms = '';
  // dbo.usp_giveRequest @investID,@linkAmount,@btcLinkAmount,@receiverUserName,@message out,@QRCODE_URL,@Tranid,@tobtcAddress
  // (result rows = Create_Manual_Links_Response, unused)
  const rows = await db.proc(DB, 'usp_giveRequest', {
    investID, linkAmount, btcLinkAmount: Amount, receiverUserName, QRCODE_URL: Qrcode_Url, Tranid: Txn_Id, tobtcAddress: GeneratedBtcAddress,
  });
  const message = B.outStr(rows[0], 'message');
  // db._Member_Master.Where(a => a.userName == receiverUserName).FirstOrDefault()
  const mmRow = await db.queryOne(DB, 'select username, mobile, emailid from member_master where username = @receiverUserName limit 1', { receiverUserName });
  const mm = mmRow ? mapRow(mmRow, ['userName', 'mobile', 'Emailid']) : null;
  if (mm !== null) {
    const smsRow = async (id) => { const r = await db.queryOne(DB, 'select * from tbl_smsaction where id = @id limit 1', { id }); return r ? mapRow(r, SMS_PROPS) : null; };
    const emailRow = async (eid) => { const r = await db.queryOne(DB, 'select * from tbl_emailaction where eid = @eid limit 1', { eid }); return r ? mapRow(r, EMAIL_PROPS) : null; };
    const SenderSms = await smsRow(36);
    SenderMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(ProviderUsername, need(SenderSms).Sms_Content, '', '', 23);
    const ReciverSms = await smsRow(35);
    ReciverMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(receiverUserName, need(ReciverSms).Sms_Content, '', '', 24);
    const SenderEmailAction = await emailRow(31);
    SenderEmailSubject = need(SenderEmailAction).Email_Subject;
    SenderDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(ProviderUsername, SenderEmailAction.Email_Content, '', '', 22, '');
    const ReciverEamilAction = await emailRow(32);
    ReciverEmailSubject = need(ReciverEamilAction).Email_Subject;
    ReciverDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(mm.userName, ReciverEamilAction.Email_Content, '', '', 23, '');
    const fileUploader = null;
    if (message === 'success') {
      thread(() => UtilityClass.SendSMSWithAPI(mm.mobile, ReciverMobileSMS, '1'), 'SendSMSWithAPI');
      thread(() => UtilityClass.SendSMSWithAPI(Providermobile, SenderMobileSMS, '1'), 'SendSMSWithAPI');
      thread(() => UtilityClass.SendEmailByApiSetting(mm.userName, '', '', '', '', '', String(need(mm.Emailid)).toLowerCase(), ReciverEmailSubject,
        ReciverDynamicEmailSms, fileUploader), 'SendEmailByApiSetting');
      thread(() => UtilityClass.SendEmailByApiSetting(ProviderUsername, '', '', '', '', '', String(need(providerLoginid)).toLowerCase(), SenderEmailSubject,
        SenderDynamicEmailSms, fileUploader), 'SendEmailByApiSetting');
    }
  }
  return message;
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Create-New-Link" -> Give_Help_Btcauto/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Create-New-Link'], adminAuth, asyncHandler(async (req, res) => G.indexBody(req, res, opts)));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await G.exportBody(req, res, {}, opts, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate), B.nStr(req.p.toDate));
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult GenrateAddress(string investID, string linkAmount, string receiverUserName, string ProviderUsername, string Providermobile, string providerLoginid)
// auth (creates BTC payment links + sends SMS/mail; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/GenrateAddress{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const investID = B.nStr(req.p.investID);
  const linkAmount = B.nStr(req.p.linkAmount);
  const receiverUserName = B.nStr(req.p.receiverUserName);
  const ProviderUsername = B.nStr(req.p.ProviderUsername);
  const Providermobile = B.nStr(req.p.Providermobile);
  const providerLoginid = B.nStr(req.p.providerLoginid);
  let PLID = 0;
  const CoinCode = 'BTC';
  const CoinName = 'bitcoin';
  const TotalPayableAmount = linkAmount;
  let resultforadd = '';
  const FromCurrency = config.app.Currency || ''; // AppSettings["Currency"].ToString()
  // SELECT REGNO FROM GIVE_HELP WHERE INVESTID = '<investID>'  (was string-concatenated; parameterised) .FirstOrDefault()
  const reg = await db.queryOne(DB, 'select regno from give_help where investid = @investID limit 1', { investID });
  if (reg) {
    if (reg.regno === null || reg.regno === undefined) throw new Error('The cast to value type \'System.Int64\' failed because the materialized value is null.');
    PLID = Number(reg.regno);
  }
  if (PLID === 0) return res.json('error^Invalid Username!');
  try {
    let GeneratedBtcAddress = ''; let UserId = ''; let Level = ''; let Amount = ''; let Txn_Id = ''; let Confirms_Needed = ''; let Timeout = '';
    let Status_Url = ''; let Qrcode_Url = '';
    const UrlForHitforrate = 'https://api.coinmarketcap.com/v1/ticker/' + CoinName + '/?convert=' + (config.app.Currency || '');
    // new WebClient().DownloadString(url)
    // PORT-NOTE: the coinmarketcap v1 ticker API has been retired; a failure lands in the outer catch like the legacy WebException.
    const Resultforrate = (await axios.get(UrlForHitforrate, { responseType: 'text', transformResponse: (x) => x })).data;
    const ObjRateManagement = jparse(Resultforrate);
    if (!Array.isArray(ObjRateManagement)) throw new Error('Error reading JArray from JsonReader.');
    if (ObjRateManagement.length === 0) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
    const pu = jstr(ObjRateManagement[0], 'price_usd');
    if (pu === null || pu === 'null' || pu === '') return res.json('error');
    const btcrate = pu;

    // #region Member Has No Address Then Call Otherwise Leave It
    try {
      const LevelNameForGenerate = (receiverUserName + '-' + PLID) + '-' + String(Math.floor(Math.random() * 1000000)).padStart(10, '0');
      void LevelNameForGenerate; // computed, unused (legacy)
      const Response = await CoinPaymentAPI.CreateTranstion(CoinCode, FromCurrency, CoinCode, TotalPayableAmount);
      const ObjWalletManagement = jparse(Response);
      if (jstr(ObjWalletManagement, 'Flag') !== 'success') return res.json('error');
      const ObjWalletManagementNew = jparse(jstr(ObjWalletManagement, 'Message'));
      const ObjWalletManagementResult = jparse(jstr(ObjWalletManagementNew, 'result'));
      GeneratedBtcAddress = jstr(ObjWalletManagementResult, 'address');
      UserId = jstr(ObjWalletManagementResult, 'address');
      Level = jstr(ObjWalletManagementResult, 'address');
      Amount = jstr(ObjWalletManagementResult, 'amount');
      Txn_Id = jstr(ObjWalletManagementResult, 'txn_id');
      Confirms_Needed = jstr(ObjWalletManagementResult, 'confirms_needed');
      Timeout = jstr(ObjWalletManagementResult, 'timeout');
      Status_Url = jstr(ObjWalletManagementResult, 'status_url');
      Qrcode_Url = jstr(ObjWalletManagementResult, 'qrcode_url');
      resultforadd = await CreateBTCLink(investID, linkAmount, receiverUserName, ProviderUsername, Providermobile, providerLoginid, Qrcode_Url, Txn_Id,
        GeneratedBtcAddress, Amount);
    } catch (ExpObj) {
      GeneratedBtcAddress = ''; UserId = ''; Level = ''; Amount = ''; Txn_Id = ''; Confirms_Needed = '';
      Timeout = ''; Status_Url = ''; Qrcode_Url = '';
      return res.json('error');
    }
    if (resultforadd.toLowerCase() === 'success') {
      const BTCRATE = B.cvtDec(btcrate); // Convert.ToDecimal(btcrate)
      // [DBO].[USP_ADMINBTCADDRESSMANAGEMENTS] @Mode=1 (save)
      await db.procOne(DB, 'USP_ADMINBTCADDRESSMANAGEMENTS', {
        BtcAddress: GeneratedBtcAddress, UserId, Level, Mode: '1', PLID, AMOUNT: TotalPayableAmount, BTCRATE, COINCODE: CoinCode, BTCAMOUNT: Amount,
        TXN_ID: Txn_Id, CONFIRMS_NEEDED: Confirms_Needed, TIMEOUT: Timeout, STATUS_URL: Status_Url, QRCODE_URL: Qrcode_Url,
      });
      // #endregion
      // ObjGetBTCDetails = SqlQuery<GetBTCDetails>(... @Mode=2 ...).FirstOrDefault()  (result unused)
      const ObjGetBTCDetails = await db.procOne(DB, 'USP_ADMINBTCADDRESSMANAGEMENTS', {
        BtcAddress: '', UserId: '', Level: '', Mode: '2', PLID, AMOUNT: TotalPayableAmount, BTCRATE: B.cvtDec(btcrate), COINCODE: CoinCode,
        BTCAMOUNT: Amount, TXN_ID: Txn_Id, CONFIRMS_NEEDED: Confirms_Needed, TIMEOUT: Timeout, STATUS_URL: Status_Url, QRCODE_URL: Qrcode_Url,
      });
      void ObjGetBTCDetails;
    }
    return res.json(resultforadd.toLowerCase());
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'GenrateAddress');
    return res.json(ExpObj.message);
  }
}));

// ---------------------------------------------------------------- public string CreateBTCLink(...)
// auth (creates a help link + sends SMS/mail; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/CreateBTCLink{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const message = await CreateBTCLink(v('investID'), v('linkAmount'), v('receiverUserName'), v('ProviderUsername'), v('Providermobile'),
    v('providerLoginid'), v('Qrcode_Url'), v('Txn_Id'), v('GeneratedBtcAddress'), v('Amount'));
  res.type('text/html').send(message); // `public string` action => ContentResult
}));

module.exports = router;
