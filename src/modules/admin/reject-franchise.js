'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Reject_FranchiseController.cs (class Reject_FranchiseController => /admin/Reject_Franchise/...)
// Database: affiliate (Db_Affiliate). Procs: USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS, USP_Reject_Frnachaise, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, cellStr, tab, netFormat, col, str, nullRef, trimS,
} = require('./_shared/batch12-common');
const { omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'Reject_Franchise';

/** class RejectFranchise */
const REJECT_FRANCHISE_PROPS = ['RowNumber', 'USERNAME', 'Package', 'MOBILE', 'AppliedDateOn', 'ApprovalDate', 'Remark', 'Taluk', 'District', 'Circle', 'Region'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string UserName, string Package, string Mobile, string SearchField, string From, string To, int? page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, UserName, Package, Mobile, SearchField, From, To, page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = 'Reject_Franchise_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // (unused: @MAXROWS = ddlcustpage)
  void MaxRows;
  if (page === null) page = 1;
  // dbo.USP_Reject_Frnachaise @STARTROWINDEX,@MAXROWS,@UserName,@Package,@SearchField,@Mobile,@From,@To,@TOTALCOUNT out  (CommandTimeout 1000)
  const AllEPinRequestsList = mapRows(await db.proc(DB, 'USP_Reject_Frnachaise', omitNull({
    STARTROWINDEX: page, MAXROWS: ddlcustpage, UserName: trimS(UserName), SearchField: trimS(SearchField), Mobile: trimS(Mobile),
    Package: trimS(Package), From: trimS(From), To: trimS(To),
  })), REJECT_FRANCHISE_PROPS);
  if (AllEPinRequestsList.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Reject_Franchise.xls', downloadName: 'Reject_Franchise.xls', Filename,
      headers: ['S.No.', 'Username', 'Applied For', 'Mobile', 'Applied Date', 'Approval Date', 'Taluk', 'District', 'Circle', 'Region', 'Remark'],
      rows: AllEPinRequestsList,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'AllEPinRequestsList',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'Package')) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(netFormat(item.AppliedDateOn, 'ddMMMyyyy')) + ' \t');
        w(tab(netFormat(item.ApprovalDate, 'ddMMMyyyy')) + ' \t');
        w(tab(cellStr(item, 'Taluk')) + ' \t');
        w(tab(cellStr(item, 'District')) + ' \t');
        w(tab(cellStr(item, 'Circle')) + ' \t');
        w(tab(cellStr(item, 'Region')) + ' \t');
        w(tab(cellStr(item, 'Remark')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string UserName, string Package, string Mobile,
//   string SearchField, string From, string To, int? page, int? ddlcustpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Reject-Frnachise" -> Reject_Franchise/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Reject-Frnachise{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let UserName = nStr(req.p.UserName);
  let Package = nStr(req.p.Package);
  let Mobile = nStr(req.p.Mobile);
  let SearchField = nStr(req.p.SearchField);
  let From = nStr(req.p.From);
  let To = nStr(req.p.To);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let btnexel = nStr(req.p.btnexel);
  const ViewBag = {};
  const out = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (UserName === null) UserName = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (Mobile === null) Mobile = '';
  if (From === null) From = '';
  if (To === null) To = '';
  if (Package === null) Package = '';
  if (btnexel === null) btnexel = '';
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK (CommandTimeout 1000)
  if (SearchField === null) {
    SearchField = '';
  } else if (SearchField === 'Applied Date') {
    SearchField = 'Applied Date';
  } else if (SearchField === 'Rejected Date') {
    SearchField = 'Rejected Date';
  }
  if (page === null) page = 1;
  const Empid = req.user.emp_id;
  // Session["Admin_User_Menu"] = UtilityClass.UpdateAdminMenu(Empid); Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
  sessionStore.set(req, 'Admin_User_Menu', await UtilityClass.UpdateAdminMenu(Empid));
  const EM = await new UtilityClass().UpdateAdminUserSession(Empid);
  if (!EM) throw nullRef(); // EM.Emp_ID on a null session object
  out.token = issueAdminToken(EM); // refreshed session => refreshed token
  const Employeeid = EM.Emp_ID;
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  const MaxRows = Number(dynamicpagging);
  const rows = await db.proc(DB, 'USP_Reject_Frnachaise', {
    STARTROWINDEX: page, MAXROWS: MaxRows, UserName: UserName.trim(), SearchField: SearchField.trim(), Mobile: Mobile.trim(), Package: Package.trim(),
    From: From.trim(), To: To.trim(),
  });
  const AllEPinRequestsList = mapRows(rows, REJECT_FRANCHISE_PROPS);
  const tc = str(col(rows[0], 'TOTALCOUNT'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10); // int.Parse(v == "" ? "0" : v)
  if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.UserName = UserName;
  ViewBag.Package = Package;
  ViewBag.Mobile = Mobile;
  ViewBag.SearchField = SearchField;
  ViewBag.From = From;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.To = To;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, UserName, Package, Mobile, SearchField, From, To, page, ddlcustpage);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Reject_Franchise/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag, ...out });
}));

// ---------------------------------------------------------------- public void ExportReport(string UserName, string Package, string Mobile, string SearchField,
//   string From, string To, int? page, int? ddlcustpage)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.UserName), nStr(req.p.Package), nStr(req.p.Mobile), nStr(req.p.SearchField), nStr(req.p.From),
    nStr(req.p.To), nInt(req.p.page), nInt(req.p.ddlcustpage));
  if (!r.sent) res.send('');
}));

module.exports = router;
