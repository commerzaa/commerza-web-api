'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MyDownline.cs (class MyDownlineController => /MyDownline/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, perms, excelLink, inlinePerms, excelHistory, nowStamp, tab, cellStr, col, outIntOf, firstCol, trimS, errorView,
} = require('./_shared/batch10-common');

const router = express.Router();
const C = 'MyDownline';

/** class MyDownline */
const PROPS = ['rownumber', 'EmpLevel', 'LoginId', 'Name', 'Emailid', 'mobile', 'Regdate', 'DOC', 'Active', 'Status', 'paystatus', 'UserName',
  'ImageName', 'SpLoginId', 'SpEmailid', 'SpMobile', 'SpRegdate', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'ISDcode', 'COUNTRYNAME'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
// `private string regno` is never used.
let url = '';
let url1 = '';

/** [DBO].[USP_DIRECT_TREE_LIST] @LOGINID,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@LEVENUMBER,@TOTALCOUNT OUT,
 *  @USERNAME,@EMAILID,@SPONSERID,@ReferralType,@STATUS,@SIDE,@CHECKADMINSIDE,@MOBILE,@orderbydate */
function directTreeList(LoginId, page, MaxRows, SearchField, SearchValue, fromdate, todate, levelnumber, Username, EmailID, SponserID,
  ReferralType, orderbydate) {
  return db.proc(DB, 'USP_DIRECT_TREE_LIST', {
    LOGINID: LoginId, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: trimS(SearchField), SEARCHVALUE: trimS(SearchValue),
    FROMDATE: trimS(fromdate), TODATE: trimS(todate), LEVENUMBER: levelnumber, USERNAME: Username, EMAILID: trimS(EmailID),
    SPONSERID: trimS(SponserID), ReferralType, STATUS: 0, SIDE: 0, CHECKADMINSIDE: 0, MOBILE: '', orderbydate,
  });
}

/** Nullable<DateTime>.ToString(): null => "" */
const nullableStr = (item, k) => {
  const v = col(item, k);
  if (v === null || v === undefined) return '';
  return cellStr(item, k);
};

// public void ExportReport(int? dynamicpagging, string LoginId, string orderbydate, string SearchField, string SearchValue, string fromdate,
//   string todate, string Username, string EmailID, string SponserID, int? page, string levelnumber, int? ddlcustpage, int? ReferralType)
// (no try/catch in legacy: any exception propagates to the caller)
async function ExportReport(req, res, dynamicpagging, LoginId, orderbydate, SearchField, SearchValue, fromdate, todate, Username, EmailID,
  SponserID, page, levelnumber, ddlcustpage, ReferralType) {
  const userid = req.user.emp_id;
  const Filename = 'MyDownline_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = 10000000;
  if (page === null) page = 1;
  const rows = await directTreeList(LoginId, page, MaxRows, SearchField, SearchValue, fromdate, todate, levelnumber, Username, EmailID,
    SponserID, ReferralType, orderbydate);
  const list = mapRows(rows, PROPS);
  if (list.length > 0) {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'Direct_Referral_List.xls');
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = 'S.No. \tUsername \tName \tJoin Date \tActivation Date \tMobile No. \tEmail ID \tStatus \t';
    for (const item of list) {
      out += '\n';
      out += tab(cellStr(item, 'rownumber')) + ' \t';
      out += tab(cellStr(item, 'UserName')) + ' \t';
      out += tab(cellStr(item, 'Name')) + ' \t';
      out += tab(cellStr(item, 'Regdate')) + ' \t';
      out += tab(nullableStr(item, 'DOC')) + ' \t';
      out += tab(cellStr(item, 'mobile')) + ' \t';
      out += tab(cellStr(item, 'Emailid')) + ' \t';
      const a = col(item, 'Active');
      out += (a === true || a === 1 || a === '1' ? 'Active' : 'In-Active') + ' \t';
    }
    fs.writeFileSync(filepath, out);
    // PORT-NOTE: legacy Response.Redirect(...) aborted the thread before File.Copy to ~/DownloadedExcel/<Filename>.xls; only the delete ran.
    const dl = path.join(config.uploadDir, 'DownloadedExcel');
    fs.mkdirSync(dl, { recursive: true });
    const filepath1 = path.join(dl, `${Filename}.xls`);
    if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', 'attachment; filename=Direct_Referral_List.xls');
    res.send(out);
    return { sent: true };
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   string fromdate, string todate, string Username, string EmailID, string SponserID, string LoginId, int? page, string levelnumber,
//   int? ddlcustpage, int? ReferralType, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/direct-referral-list" -> MyDownline/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/direct-referral-list'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  let SearchField = nStr(req.p.SearchField); if (SearchField === null) SearchField = '';
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  let fromdate = nStr(req.p.fromdate); if (fromdate === null) fromdate = '';
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  let todate = nStr(req.p.todate); if (todate === null) todate = '';
  let levelnumber = nStr(req.p.levelnumber); if (levelnumber === null) levelnumber = '0';
  if (SearchField === '0') ViewBag.lable = '0';
  if (SearchField === '1') ViewBag.lable = '1';
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let EmailID = nStr(req.p.EmailID); if (EmailID === null) EmailID = '';
  let SponserID = nStr(req.p.SponserID); if (SponserID === null) SponserID = '';
  let ReferralType = nInt(req.p.ReferralType); if (ReferralType === null) ReferralType = 0;
  let Username = nStr(req.p.Username);
  let LoginId = nStr(req.p.LoginId);
  let page = nInt(req.p.page);
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions (overwritten below, like legacy)
  ViewBag.excelactive = await excelLink(url);
  const ip = await inlinePerms(Empid, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  if (Username === null || Username === '') {
    Username = '';
  } else {
    // select LOGINID from MEMBER_MASTER with(nolock) where username='<Username>'  (parameterised)
    LoginId = firstCol(await db.query(DB, 'select loginid from member_master where username = @Username limit 1', { Username }));
  }
  try {
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    if (LoginId === null || LoginId === undefined) {
      LoginId = firstCol(await db.query(DB, 'select username from member_master where regno = 1 limit 1', {}));
    }
    ViewBag.LoginId = LoginId;
    const rows = await directTreeList(LoginId, page, MaxRows, SearchField, SearchValue, fromdate, todate, levelnumber, Username, EmailID,
      SponserID, ReferralType, orderbydate);
    const AllFreeEpinList = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, dynamicpagging, orderbydate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, fromDate: fromdate, toDate: todate, Username, EmailID, levelnumber, ddlcustpage,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, dynamicpagging, LoginId, orderbydate, SearchField, SearchValue, fromdate, todate, Username, EmailID,
        SponserID, page, levelnumber, ddlcustpage, ReferralType);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/MyDownline/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_BonusIncomeHistory');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, nInt(req.p.dynamicpagging), v('LoginId'), v('orderbydate'), v('SearchField'), v('SearchValue'),
    v('fromdate'), v('todate'), v('Username'), v('EmailID'), v('SponserID'), nInt(req.p.page), v('levelnumber'), nInt(req.p.ddlcustpage),
    nInt(req.p.ReferralType));
  if (!r.sent) res.send('');
}));

module.exports = router;
