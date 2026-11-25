'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Product_Purchase.cs (class Product_PurchaseController => /admin/Product_Purchase/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nre, nint, nstr, reqInt, toInt32, outStr, col, view, inlinePerms, excelLink, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Product_Purchase';

/** class Product_Purchase */
const PRODUCT_PURCHASE_PROPS = ['ROWNUMBER', 'KitItem', 'PackageName', 'USERNAME', 'Kitprice', 'PPID', 'Emailid', 'Mobile', 'NAME', 'ADDRESS', 'FRCode'];
/** class FranchiseDetails (Pending_RequestController.cs) */
const FRANCHISEDETAILS_PROPS = ['LOGINID', 'PASSWORD', 'EMAILID', 'MOBILE', 'NAME', 'FRCode'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

/** public void ExportReport(string Username, string packageName, string kitprice) */
async function ExportReport(req, res, Username, packageName, kitprice, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Product_Purchase_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const Obj = mapRows(await db.proc(DB, 'USP_Product_PAckage', {
    STARTROWINDEX: 1, MAXROWS: 999999, USERNAME: Username, PackageName: packageName, KitPrice: kitprice, MODE: '1',
  }), PRODUCT_PURCHASE_PROPS);
  if (Obj.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Product_Purchase.xls', Filename,
      headers: ['S.No.', 'Package Name', 'Kit Price', 'Total Item'],
      rows: Obj,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.PackageName)) + ' \t');
        w(tab(n2(item.Kitprice)) + ' \t');
        w(tab(cs(item.KitItem)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, int? page, string btnexel, string packageName, string kitprice, int? ddlmaxrow, string Username)
// auth (reads Session["Admin_User"] before its null check => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Product-Purchase" -> Product_Purchase/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Product-Purchase'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let page = nint(req.p.page);
  let btnexel = nstr(req.p.btnexel);
  let packageName = nstr(req.p.packageName);
  let kitprice = nstr(req.p.kitprice);
  let ddlmaxrow = nint(req.p.ddlmaxrow);
  let Username = nstr(req.p.Username);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (dynamicpagging === null) dynamicpagging = 100;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK (v == "0" ? "0" : v)
  if (kitprice === null) kitprice = '';
  if (btnexel === null) btnexel = '';
  if (packageName === null) packageName = '';
  if (ddlmaxrow === null) ddlmaxrow = 100;
  if (Username === null) Username = '';
  const MaxRows = toInt32(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_Product_PAckage', {
    STARTROWINDEX: page, MAXROWS: MaxRows, USERNAME: Username, PackageName: packageName, KitPrice: kitprice, MODE: '1',
  });
  const Obj = mapRows(rows, PRODUCT_PURCHASE_PROPS);
  const tc = outStr(col(rows[0], 'totalcount'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.GridPageSize = ddlmaxrow;
  ViewBag.packageName = packageName;
  ViewBag.Username = Username;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, Username, packageName, kitprice, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/Product_Purchase/Index.cshtml', Obj, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(string Username, string packageName, string kitprice)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.Username), nstr(req.p.packageName), nstr(req.p.kitprice), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Transfer(string UserName, int PPID)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/Transfer{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const UserName = nstr(req.p.UserName);
  const PPID = reqInt(req.p.PPID, 'PPID');
  let Ret = '0';
  const loginid = req.user.emp_id;
  const FromUsername = req.user.emp_name;
  // [USP_TRANSFERPRODUCTKIT] @PPID,@USERNAME,@STRRESULT out,@EID  (TransactionalBehavior.DoNotEnsureTransaction)
  const row = await db.procOne(DB, 'USP_TRANSFERPRODUCTKIT', { PPID: toInt32(PPID), USERNAME: UserName, EID: loginid });
  Ret = outStr(col(row, 'strresult'));
  // select ISNULL(FRID,0) as FRID from TBL_FRANCHISEREQUEST where FRCode='<UserName>'  (parameterised)
  const fr = await db.queryOne(DB, 'select coalesce(frid, 0) as frid from tbl_franchiserequest where frcode = @UserName limit 1', { UserName });
  const Frid = fr ? toInt32(col(fr, 'frid')) : 0;
  const FranchiseDetails = mapRows(await db.proc(DB, 'USP_FRANCHISEDETAILSBYFRID', { FRID: Frid }), FRANCHISEDETAILS_PROPS);
  const SMSVerification = await db.queryOne(DB, 'select id, sms_content from tbl_smsaction where id = 34 limit 1', {});
  if (!SMSVerification) throw nre();
  const MobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(FromUsername, col(SMSVerification, 'sms_content'), UserName, '', 22);
  const emailVerificationmsg = await db.queryOne(DB, 'select eid, email_subject, email_content from tbl_emailaction where eid = 30 limit 1', {});
  if (!emailVerificationmsg) throw nre();
  const EmailSubject = col(emailVerificationmsg, 'email_subject');
  const DynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(FromUsername, col(emailVerificationmsg, 'email_content'), '', UserName, 21, '');
  if (Ret === 'SUCCESS') {
    // new Thread(...).Start() x2 => fire-and-forget (FranchiseDetails[0] / EMAILID.ToLower() failures only logged)
    setImmediate(() => {
      Promise.resolve().then(() => {
        if (!FranchiseDetails.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
        return UtilityClass.SendSMSWithAPI(FranchiseDetails[0].MOBILE, MobileSMS, '1');
      }).catch((e) => console.error('[admin/Product_Purchase] sms thread failed:', e.message));
    });
    const fileUploader = null;
    setImmediate(() => {
      Promise.resolve().then(() => {
        if (!FranchiseDetails.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
        const f = FranchiseDetails[0];
        if (f.EMAILID === null || f.EMAILID === undefined) throw nre();
        return UtilityClass.SendEmailByApiSetting(f.NAME, f.PASSWORD, '', '', '', '', String(f.EMAILID).toLowerCase(), EmailSubject, DynamicEmailSms, fileUploader);
      }).catch((e) => console.error('[admin/Product_Purchase] mail thread failed:', e.message));
    });
  }
  return res.json(Ret);
}));

// ---------------------------------------------------------------- JsonResult GetDetails(string FRCODE)
// auth (PORT-NOTE: legacy had no session check; franchise contact data => adminAuth)
router.all(`/admin/${C}/GetDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FRCODE = nstr(req.p.FRCODE);
  const Obj = mapRows(await db.proc(DB, 'USP_FranchiseDetails', { FRCODE }), PRODUCT_PURCHASE_PROPS);
  return res.json(Obj);
}));

module.exports = router;
