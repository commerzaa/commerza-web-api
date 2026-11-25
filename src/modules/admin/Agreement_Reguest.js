'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Agreement_Reguest.cs (class Agreement_RequestController => /admin/Agreement_Request/...)
// Database: affiliate (Db_Affiliate). Tables: tbl_agreement_details, tbl_franchiserequest, tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nint, nstr, nre, toInt32, outStr, col, view, inlinePerms, excelLink, fmtDate, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'Agreement_Request';

/** class Agreement_Request */
const AGREEMENT_REQUEST_PROPS = ['rownumber', 'ARID', 'EMAILID', 'USERNAME', 'MOBILE', 'Request_Date', 'Attachement', 'Status'];
/** class FranchiseDetails (Controllers/AdminPanel/Pending_RequestController.cs) */
const FRANCHISEDETAILS_PROPS = ['LOGINID', 'PASSWORD', 'EMAILID', 'MOBILE', 'NAME', 'FRCode'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

const listProc = (p) => db.proc(DB, 'Usp_AgreementList_Request', {
  UserName: p.UserName, Mode: 1, STARTROWINDEX: p.page, MAXROWS: p.MaxRows, mobileno: p.Mobile, EmailID: p.EmailID, FROMDATE: p.From, TODATE: p.To,
});

// public void ExportReport(string UserName, string Mobile, string From, string To, string EmailID)
async function ExportReport(req, res, UserName, Mobile, From, To, EmailID, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Agreement_Request_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  if (Mobile === null || EmailID === null) throw nre();
  const rows = await listProc({ UserName, page: 1, MaxRows: 999999, Mobile: Mobile.trim(), EmailID: EmailID.trim(), From, To });
  const list = mapRows(rows, AGREEMENT_REQUEST_PROPS);
  if (list.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Agreement_Request.xls', Filename,
      headers: ['S.No.', 'UserName', 'Mobile', 'Request Date', 'Agreement', 'Status'],
      rows: list,
      innerProc: 'getblockedMemberList',
      outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w(tab(cs(item.rownumber)) + ' \t');
        w(tab(cs(item.USERNAME)) + ' \t');
        w(tab(cs(item.MOBILE)) + ' \t');
        w(tab(fmtDate(item.Request_Date, 'dd-MM-yyyy')) + ' \t');
        w(tab(cs(item.Attachement)) + ' \t');
        w(tab('Pending') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string UserName, string btnexel, string EmailID, string Mobile, int? page, int? ddlcustpage, string From, string To)
// auth (reads Session["Admin_User"] before its null check)
// route-config: "AdminPanel/Agreement-Reguest" -> Agreement_Request/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Agreement-Reguest'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let UserName = nstr(req.p.UserName);
  let btnexel = nstr(req.p.btnexel);
  let EmailID = nstr(req.p.EmailID);
  let Mobile = nstr(req.p.Mobile);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let From = nstr(req.p.From);
  let To = nstr(req.p.To);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (btnexel === null) btnexel = '';
  if (UserName === null) UserName = '';
  if (Mobile === null) Mobile = '';
  if (EmailID === null) EmailID = '';
  if (From === null) From = '';
  if (To === null) To = '';
  if (page === null) page = 1;
  const MaxRows = toInt32(dynamicpagging);
  const rows = await listProc({ UserName, page, MaxRows, Mobile: Mobile.trim(), EmailID: EmailID.trim(), From, To });
  const AllEPinRequestsList = mapRows(rows, AGREEMENT_REQUEST_PROPS);
  const tc = outStr(col(rows[0], 'totalcount'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, UserName, Mobile, From, To, EmailID, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/Agreement_Request/Index.cshtml', AllEPinRequestsList, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(string UserName, string Mobile, string From, string To, string EmailID)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nstr(req.p[k]);
  const r = await ExportReport(req, res, v('UserName'), v('Mobile'), v('From'), v('To'), v('EmailID'), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Verify_Agreement(string mode, string ARID, string remark)
// auth (reads Session["Admin_User"] first => NullReferenceException without a session)
router.all(`/admin/${C}/Verify_Agreement{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const mode = nstr(req.p.mode);
  const ARID = nstr(req.p.ARID);
  const remark = nstr(req.p.remark);
  let DynamicEmailSms = '';
  let MobileSMS = '';
  let EmailSubject = '';
  const Assignby = req.user.emp_id;
  // Dns.GetHostName()/GetHostByName/GetHostEntry and Request.Url.Host were computed but unused (legacy)
  const IAddress = await GetIP.GetLocalIP(req);
  // "select isnull(frid,0) from tbl_agreement_details join tbl_franchiserequest on ... where AGID=" + ARID  (concatenated => parameterised)
  if (ARID === null || !/^\s*[+-]?\d+\s*$/.test(ARID)) throw new Error("Incorrect syntax near '='."); // non-numeric ARID was an SQL error
  const fr = await db.queryOne(DB, `select coalesce(frid, 0) as frid from tbl_agreement_details
    join tbl_franchiserequest on tbl_franchiserequest.plid = tbl_agreement_details.regno where agid = @ARID limit 1`, { ARID: Number(ARID) });
  const Frid = fr ? Number(col(fr, 'frid')) : 0;
  const FranchiseDetails = mapRows(await db.proc(DB, 'USP_FRANCHISEDETAILSBYFRID', { FRID: Frid }), FRANCHISEDETAILS_PROPS);
  const row = await db.procOne(DB, 'Usp_Agreemnet_Status', { ARID, mode, remark, EmpId: Assignby, IPAddress: IAddress });
  const status = outStr(col(row, 'status'));
  const fd0 = () => { if (!FranchiseDetails.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.'); return FranchiseDetails[0]; };
  const smsAction = async (id) => {
    const r = await db.queryOne(DB, 'select id, sms_content from tbl_smsaction where id = @id limit 1', { id });
    if (!r) throw nre();
    return col(r, 'sms_content');
  };
  const emailAction = async (eid) => {
    const r = await db.queryOne(DB, 'select eid, email_subject, email_content from tbl_emailaction where eid = @eid limit 1', { eid });
    if (!r) throw nre();
    return { Email_Subject: col(r, 'email_subject'), Email_Content: col(r, 'email_content') };
  };
  if (status === '2') {
    MobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(fd0().NAME, await smsAction(31), '', '', 19);
    const em = await emailAction(28);
    EmailSubject = em.Email_Subject;
    DynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(fd0().NAME, em.Email_Content, '', '', 18, '');
  } else if (status === '3') {
    MobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(fd0().NAME, await smsAction(32), '', '', 20);
    const em = await emailAction(27);
    EmailSubject = em.Email_Subject;
    DynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(fd0().NAME, em.Email_Content, '', '', 19, '');
  }
  if (status === '2' || status === '3') {
    const f = fd0();
    // new Thread(...).Start() => fire-and-forget
    Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(f.MOBILE, MobileSMS, '1'))
      .catch((e) => console.error('[Agreement_Request] sms thread:', e.message));
    const fileUploader = null;
    Promise.resolve().then(() => {
      if (f.EMAILID === null || f.EMAILID === undefined) throw nre();
      return UtilityClass.SendEmailByApiSetting(f.NAME, f.PASSWORD, '', '', '', '', String(f.EMAILID).toLowerCase(), EmailSubject, DynamicEmailSms, fileUploader);
    }).catch((e) => console.error('[Agreement_Request] email thread:', e.message));
  }
  return res.json(status);
}));

module.exports = router;
