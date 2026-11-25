'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Domain_Request.cs (class Domain_RequestController, no namespace => /Domain_Request/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETDOMAIN_REQUEST, USP_SUBMITDOMAIN, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK,
// USP_EXCEL_DOWNLOAD_HISTORY; tables member_master, portal_login.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, reqInt, col, intParse, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, trimNull,
} = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Domain_Request';

/** public class DomainRequest */
const DOMAIN_REQUEST_PROPS = ['ROWNUMBER', 'DOMAINNAME', 'ADMINREMARK', 'REQUESTDATE', 'USERNAME', 'ISAPPROVAL', 'PLID', 'APPROVALDATE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate) */
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Domain_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  // [USP_GETDOMAIN_REQUEST] @PLID, @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT
  const list = mapRows(await db.proc(DB, 'USP_GETDOMAIN_REQUEST', {
    PLID: '0', STARTROWINDEX: 1, MAXROWS: 9999999, SEARCHFIELD: trimNull(SearchField), SEARCHVALUE: trimNull(SearchValue),
    FROMDATE: trimNull(fromdate), TODATE: trimNull(todate),
  }), DOMAIN_REQUEST_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Domain_Request.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'UserName', 'Domain Name', 'Request Date', 'Approval Date', 'Action'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'USERNAME', 'DOMAINNAME', 'REQUESTDATE', 'APPROVALDATE', 'ISAPPROVAL']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   string fromdate, string todate, string Username, string EmailID, string SponserID, string LoginId, int? page, string levelnumber,
//   int? ddlcustpage, int? ReferralType, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Domain-Request" -> Domain_Request/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Domain-Request'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let Username = nStr(req.p.Username);
  let EmailID = nStr(req.p.EmailID);
  let SponserID = nStr(req.p.SponserID);
  let LoginId = nStr(req.p.LoginId);
  let page = nInt(req.p.page);
  let levelnumber = nStr(req.p.levelnumber);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let ReferralType = nInt(req.p.ReferralType);
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (todate === null) todate = '';
  if (levelnumber === null) levelnumber = '';
  if (SearchField === '0') ViewBag.lable = '0';
  if (SearchField === '1') ViewBag.lable = '1';
  if (btnexel === null) btnexel = '';
  const Employeeid = req.user.emp_id;
  const perm = await inlinePerms(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  if (Username === null) {
    Username = '';
  } else {
    // select LOGINID from MEMBER_MASTER with(nolock) where username='<Username>'   (parameterised)
    const v = await db.scalar(DB, 'select loginid from member_master where username = @Username limit 1', { Username });
    LoginId = v === undefined ? null : v;
  }
  if (EmailID === null) EmailID = '';
  if (SponserID === null) SponserID = ''; // eslint-disable-line no-unused-vars
  if (ReferralType === null) ReferralType = 0; // eslint-disable-line no-unused-vars
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  levelnumber = '0';
  if (LoginId === null) {
    // db._Portal_Login.Where(a => a.PLID == 1).Select(a => a.USERNAME).FirstOrDefault()
    const u = await db.scalar(DB, 'select username from portal_login where plid = 1 limit 1', {});
    LoginId = u === undefined ? null : u;
  }
  ViewBag.LoginId = LoginId;
  // [USP_GETDOMAIN_REQUEST] @PLID, @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@orderbydate,@Username
  const rows = await db.proc(DB, 'USP_GETDOMAIN_REQUEST', {
    PLID: '0', STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromdate.trim(),
    TODATE: todate.trim(), orderbydate, Username,
  });
  const DomainRequest = mapRows(rows, DOMAIN_REQUEST_PROPS);
  const TotalRecord = intParse(col(rows[0], 'TOTALCOUNT')); // int.Parse(DBNull.ToString()) => FormatException (unhandled)
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.EmailID = EmailID;
  ViewBag.levelnumber = levelnumber;
  ViewBag.ddlcustpage = ddlcustpage;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Domain_Request/Index.cshtml', Model: DomainRequest, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromdate), nStr(req.p.todate), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult ApproveDomainRequest(int plid, int isapproval, string AdminRemark)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/ApproveDomainRequest{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const plid = reqInt(req.p.plid, 'plid');
  const isapproval = reqInt(req.p.isapproval, 'isapproval');
  const AdminRemark = nStr(req.p.AdminRemark);
  let IsAddReject = 0;
  const Empid = req.user.emp_id;
  // USP_SUBMITDOMAIN @PLID,@DOMAINNAME,@ISAPPROVAL,@ADMINREMARK,@REQUESTDATE,@APPROVALDATE,@APPROVEDBY,@MODE,@INTRESULT out
  const row = await db.procOne(DB, 'USP_SUBMITDOMAIN', {
    PLID: plid, DOMAINNAME: '', ISAPPROVAL: isapproval, ADMINREMARK: AdminRemark, REQUESTDATE: '', APPROVALDATE: '', APPROVEDBY: Empid, MODE: 2,
  });
  IsAddReject = intParse(col(row, 'INTRESULT')); // Convert.ToInt32(DBNull.ToString()) => FormatException (unhandled)
  return res.json(IsAddReject);
}));

module.exports = router;
