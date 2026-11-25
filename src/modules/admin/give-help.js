'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Give_Help.cs (class Give_HelpController, no namespace => /Give_Help/...)
// Database: affiliate (Db_Affiliate). The file also declares the models GiveHelpList, Create_Manual_Links_Response, Give_Help (=> *_PROPS).
// Procs: USP_GETEXCELPERMISIONSTATUS (via CheckPermissions), USP_EXCEL_LINK, Usp_Give_Help_List, USP_EXCEL_DOWNLOAD_HISTORY,
//        USP_GetGiveHelpDetails, usp_giveRequest. Tables: member_master, tbl_smsaction, tbl_emailaction.
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, col, cellStr, tab, nowStamp, dec2, cvtInt, nullRef, excelHistory, writeXlsExport,
} = require('./_shared/batch08-common');
const { outVal, pagePerm, excelLinkRaw } = require('./_shared/batch08-d2-common');

const router = express.Router();
const C = 'Give_Help';

/** class GiveHelpList */
const GIVE_HELP_LIST_PROPS = ['rowNumber', 'GiveID', 'InvestID', 'Help_Date', 'LoginId', 'Name', 'Emailid', 'Mobile', 'UserName', 'SpLoginId',
  'SpName', 'SpEmailid', 'SpMobile', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'Remain_Amount', 'Process_Amount', 'LinkCount', 'CountDown',
  'Regno'];
/** class Give_Help */
const GIVE_HELP_PROPS = ['EmailId', 'GiveID', 'InvestID', 'Kid', 'Regno', 'Help_Date', 'Help_Amount', 'Trans_Amount', 'Remain_Amount', 'Status',
  'LinkAmount', 'HelpNo', 'Remark'];
// class Create_Manual_Links_Response (FName, FEmail, FMobile, TName, TEmail, TMobile, Amount, BTC): result of usp_giveRequest, never used.

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

const trimNR = (v) => { if (v === null || v === undefined) throw nullRef(); return String(v).trim(); }; // string.Trim() on null => NRE
/** fire-and-forget like `new Thread(delegate { ... }).Start()` */
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[Give_Help] background send failed:', e.message)); };
const lower = (v) => { if (v === null || v === undefined) throw nullRef(); return String(v).toLowerCase(); };

/** dbo.Usp_Give_Help_List @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@message out */
async function giveHelpList(StartRowIndex, MaxRows, SearchField, SearchValue, fromDate, ToDate) {
  return db.proc(DB, 'Usp_Give_Help_List', {
    StartRowIndex, MaxRows, SearchField, SearchValue: trimNR(SearchValue), fromDate, ToDate,
  });
}

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string orderBy)
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, orderBy) { // eslint-disable-line no-unused-vars
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'Text_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const rows = await giveHelpList(1, 9999999, SearchField, SearchValue, fromDate, toDate);
  const GiveHelpList = mapRows(rows, GIVE_HELP_LIST_PROPS);
  if (GiveHelpList.length > 0) {
    let RowNumber = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Manual.xls', Filename,
      headers: ['S.No.', 'Name', 'Mobile No', 'Email id', 'Sponser By', 'Invest Id', 'Amount', 'Confirm Amount', 'Process Amount', 'Remain Amount', 'Date'],
      rows: GiveHelpList,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(cellStr(item, 'Emailid')) + ' \t');
        w(tab(cellStr(item, 'SpEmailid')) + ' \t');
        w(tab(cellStr(item, 'InvestID')) + ' \t');
        w(tab(dec2(col(item, 'Help_Amount'))) + ' \t');
        w(tab(dec2(col(item, 'Confirm_Amount'))) + ' \t');
        w(tab(dec2(col(item, 'Process_Amount'))) + ' \t');
        w(tab(dec2(col(item, 'Remain_Amount'))) + ' \t');
        w(tab(cellStr(item, 'Help_Date')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, string orderBy, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Give-Help" -> Give_Help/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Give-Help'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let btnexel = nStr(req.p.btnexel);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let orderBy = nStr(req.p.orderBy);
  let page = nInt(req.p.page);
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging; // ConfigurationManager.AppSettings["DynamicPagging"]
    dynamicpagging = cvtInt(value === undefined ? null : value); // Convert.ToInt16(value)
  }
  // inline "USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out"
  const pp = await pagePerm(Employeeid, url);
  ViewBag.isactive = pp.isactive;
  ViewBag.isedit = pp.isedit;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  // inline "USP_EXCEL_LINK @url,@ISACTIVE out": Convert.ToInt32(Value == "0" ? "0" : Value) (DBNull "" => FormatException)
  const ia = await excelLinkRaw(url);
  ViewBag.excelactive = cvtInt(ia === '' ? 'x' : ia);
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  orderBy = '';
  // (no try/catch in the legacy action: exceptions => 500)
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // PORT-NOTE: legacy passes @MaxRows = 50 (not MaxRows/dynamicpagging); kept.
  const rows = await giveHelpList(page, 50, SearchField, SearchValue, fromDate, toDate);
  const GiveHelpList = mapRows(rows, GIVE_HELP_LIST_PROPS);
  const str = outVal(rows, 'message');
  const strArray = str.split('^');
  const TotalRecord = cvtInt(strArray[0] === '' ? 'x' : strArray[0]); // Convert.ToInt32(strArray[0])
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, orderBy);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Give_Help/Index.cshtml', Model: GiveHelpList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('SearchField'), v('SearchValue'), v('fromDate'), v('toDate'), v('orderBy'));
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult FetchProviderDetail(string investID)
// auth (legacy had NO session check; admin-only data (giver e-mail / amounts) => protected, see report)
router.all(`/admin/${C}/FetchProviderDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const investID = nStr(req.p.investID);
  const rows = await db.proc(DB, 'USP_GetGiveHelpDetails', { investID });
  const GiveHelpObj = mapRows(rows, GIVE_HELP_PROPS);
  return res.json(GiveHelpObj);
}));

// ---------------------------------------------------------------- JsonResult CreateManualLinks(string investID, string linkAmount, string receiverUserName, string ProviderUsername, string Providermobile, string providerLoginid)
// auth (legacy had NO session check; it creates help links and sends SMS / mails => protected, see report)
router.all(`/admin/${C}/CreateManualLinks{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const investID = nStr(req.p.investID);
  const linkAmount = nStr(req.p.linkAmount);
  const receiverUserName = nStr(req.p.receiverUserName);
  const ProviderUsername = nStr(req.p.ProviderUsername);
  const Providermobile = nStr(req.p.Providermobile);
  const providerLoginid = nStr(req.p.providerLoginid);
  let SenderMobileSMS = '';
  let ReciverMobileSMS = '';
  let SenderEmailSubject = '';
  let ReciverEmailSubject = '';
  let SenderDynamicEmailSms = '';
  let ReciverDynamicEmailSms = '';
  let message = '';
  // decimal BTCRate = CommonController.dollarToBitcoinConvertor(1)  (commented out in legacy)
  const BTCRate = 1;
  const rows = await db.proc(DB, 'usp_giveRequest', {
    investID, linkAmount, btcLinkAmount: BTCRate, receiverUserName,
  });
  // PORT-NOTE: @message OUT is read from the first result row; an empty result set gives "" (legacy got the OUT value).
  message = rows && rows.length ? (col(rows[0], 'message') === null || col(rows[0], 'message') === undefined ? '' : String(col(rows[0], 'message'))) : '';
  // db._Member_Master.Where(a => a.userName == receiverUserName).FirstOrDefault()
  const r = await db.queryOne(DB, 'select * from member_master where username = @receiverUserName limit 1', { receiverUserName });
  const mm = r ? { userName: col(r, 'username'), mobile: col(r, 'mobile'), Emailid: col(r, 'emailid') } : null;
  if (mm !== null) {
    const sms = async (id) => { // db._TBL_SMSACTION.Where(b => b.ID == id).FirstOrDefault().Sms_Content (null => NRE)
      const x = await db.queryOne(DB, 'select sms_content from tbl_smsaction where id = @id limit 1', { id });
      if (!x) throw nullRef();
      return col(x, 'sms_content');
    };
    const mail = async (id) => { // db._tbl_emailaction.Where(b => b.EID == id).FirstOrDefault()
      const x = await db.queryOne(DB, 'select email_subject, email_content from tbl_emailaction where eid = @id limit 1', { id });
      if (!x) throw nullRef();
      return { Email_Subject: col(x, 'email_subject'), Email_Content: col(x, 'email_content') };
    };
    SenderMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(ProviderUsername, await sms(36), '', '', 23);
    ReciverMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(receiverUserName, await sms(35), '', '', 24);
    const SenderEmailAction = await mail(31);
    SenderEmailSubject = SenderEmailAction.Email_Subject;
    SenderDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(ProviderUsername, SenderEmailAction.Email_Content, '', '', 22, '');
    const ReciverEamilAction = await mail(32);
    ReciverEmailSubject = ReciverEamilAction.Email_Subject;
    ReciverDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(mm.userName, ReciverEamilAction.Email_Content, '', '', 23, '');
    const fileUploader = null;
    if (message === 'success') {
      bg(() => UtilityClass.SendSMSWithAPI(mm.mobile, ReciverMobileSMS, '1'));
      bg(() => UtilityClass.SendSMSWithAPI(Providermobile, SenderMobileSMS, '1'));
      bg(() => UtilityClass.SendEmailByApiSetting(mm.userName, '', '', '', '', '', lower(mm.Emailid), ReciverEmailSubject, ReciverDynamicEmailSms, fileUploader));
      bg(() => UtilityClass.SendEmailByApiSetting(ProviderUsername, '', '', '', '', '', lower(providerLoginid), SenderEmailSubject, SenderDynamicEmailSms, fileUploader));
    }
  }
  return res.json(message);
}));

module.exports = router;
