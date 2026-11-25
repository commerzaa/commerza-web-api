'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Email_Templates.cs (class Email_TemplatesController, no namespace => /Email_Templates/...)
// Database: affiliate (Db_Affiliate). Procs USP_EMAILTEMPLATEMASTER, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  nStr, reqInt, col, str, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, nullRef,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Email_Templates';

/** public class Emailtemplate */
const EMAILTEMPLATE_PROPS = ['ETID', 'TITLE', 'SUBJECT', 'EMAILCONTENT', 'UPDATEDON', 'UPDATEDBY', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [USP_EMAILTEMPLATEMASTER] @MODE,@TEMPLATETITLE,@EMAIL,@UPDATEDBY,@ETID,@STATUS,@SUBJECT,@STRRESULT OUT */
const master = (p) => db.proc(DB, 'USP_EMAILTEMPLATEMASTER', p);
const LIST_PARAMS = { MODE: '1', TEMPLATETITLE: '', EMAIL: '', UPDATEDBY: '0', ETID: '0', STATUS: '1', SUBJECT: '0' };

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Email_Templates' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const list = mapRows(await master(LIST_PARAMS), EMAILTEMPLATE_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Email_Templates.xls', Filename, ViewBag, rows: list, downloadName: ' Email_Templates.xls',
      headers: ['S.No.', 'Template', 'Subject', 'Display Status', 'Date'],
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ETID')) + ' \t');
        w(tab(cellStr(item, 'TITLE')) + ' \t');
        w(tab(cellStr(item, 'SUBJECT')) + ' \t');
        const statuss = Number(item.STATUS);
        if (statuss === 1) w(tab('Yes') + ' \t');
        else w(tab('No') + ' \t');
        w(tab(cellStr(item, 'UPDATEDON')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/email-Templates" -> Email_Templates/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/email-Templates'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const perm = await inlinePerms(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  if (btnexel === null) btnexel = '';
  ViewBag.excelactive = perm.excelactive;
  const rows = await master(LIST_PARAMS);
  const list = mapRows(rows, EMAILTEMPLATE_PROPS);
  ViewBag.message = str(col(rows[0], 'STRRESULT'));
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Email_Templates/Index.cshtml', Model: list, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult emailtemplatesadd(string TemplateTitle, string Subject, int Active, string descriptions)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/emailtemplatesadd{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TemplateTitle = nStr(req.p.TemplateTitle);
  const Subject = nStr(req.p.Subject);
  const Active = reqInt(req.p.Active, 'Active');
  let descriptions = nStr(req.p.descriptions);
  if (descriptions === null) throw nullRef();
  descriptions = descriptions.split('lessthan').join('<');
  descriptions = descriptions.split('greatthan').join('>');
  const row = (await master({
    MODE: '3', TEMPLATETITLE: TemplateTitle, EMAIL: descriptions, UPDATEDBY: '0', ETID: '0', STATUS: Active, SUBJECT: Subject,
  }))[0];
  const result = str(col(row, 'STRRESULT'));
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult UpdateEmailtemp(string template, string Subject, int ETID, string Content)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateEmailtemp{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const template = nStr(req.p.template);
  const Subject = nStr(req.p.Subject);
  const ETID = reqInt(req.p.ETID, 'ETID');
  let Content = nStr(req.p.Content);
  if (Content === null) throw nullRef();
  Content = Content.split('lessthan').join('<');
  Content = Content.split('greatthan').join('>');
  const row = (await master({
    MODE: '2', TEMPLATETITLE: template, EMAIL: Content, UPDATEDBY: '0', ETID, STATUS: '1', SUBJECT: Subject,
  }))[0];
  const result = str(col(row, 'STRRESULT'));
  return res.json(result);
}));

module.exports = router;
