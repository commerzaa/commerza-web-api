'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Email_Account.cs (class Email_AccountController, no namespace => /Email_Account/...)
// Database: affiliate (Db_Affiliate). Procs USP_MANAGEEMAILACCOUNTS, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nStr, reqInt, col, str, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab,
} = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Email_Account';

/** public class EmailAccount */
const EMAIL_ACCOUNT_PROPS = ['EAID', 'EMAILID', 'HOSTNAME', 'PASSWORD', 'SMTPPORT', 'SENDERNAME', 'SENDEREMAIL', 'ADDEDBY', 'UPDATEDON', 'status'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [USP_MANAGEEMAILACCOUNTS] @MODE,@EMAILID,@HOSTNAME,@PASSWORD,@SMTP,@SENDERNAME,@SENDEREMAIL,@UPDATEDBY,@STRINRESULT|@STRRESULT out,@EAID */
const manage = (p) => db.proc(DB, 'USP_MANAGEEMAILACCOUNTS', p);
/** PORT-NOTE: the legacy batches named the OUT parameter @STRINRESULT (list) or @STRRESULT (add/update) positionally; one PG function
 *  has one OUT column name, so either name is accepted. */
const outResult = (row) => {
  const v = col(row, 'STRRESULT');
  return str(v === undefined ? col(row, 'STRINRESULT') : v);
};
const LIST_PARAMS = {
  MODE: '1', EMAILID: '', HOSTNAME: '', PASSWORD: '0', SMTP: '0', SENDERNAME: '', SENDEREMAIL: '', UPDATEDBY: '', EAID: '0',
};

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Email_Accounts' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const list = mapRows(await manage(LIST_PARAMS), EMAIL_ACCOUNT_PROPS);
  if (list.length > 0) {
    let srno = 1;
    return writeXlsExport({
      req, res, sheet: 'Email_Accounts.xls', Filename, ViewBag, rows: list, downloadName: ' Email_Accounts.xls',
      headers: ['S.No.', 'E-Mail ID', 'Host Name', 'SMTP Port', 'Status'],
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(String(srno)) + ' \t');
        w(tab(cellStr(item, 'EMAILID')) + ' \t');
        w(tab(cellStr(item, 'HOSTNAME')) + ' \t');
        w(tab(cellStr(item, 'SMTPPORT')) + ' \t');
        w(tab(Number(item.status) === 1 ? 'Yes' : 'No') + ' \t');
        srno = srno + 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/Email-Account" -> Email_Account/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Email-Account'], adminAuth, asyncHandler(async (req, res) => {
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
  const rows = await manage(LIST_PARAMS);
  const list = mapRows(rows, EMAIL_ACCOUNT_PROPS);
  ViewBag.message = outResult(rows[0]);
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, ViewBag);
    if (x.sent) return undefined;
  }
  // PORT-NOTE / security: the legacy model (and so this JSON) includes the SMTP account PASSWORD column.
  return res.json({ view: '~/Views/AdminPanel/Email_Account/Index.cshtml', Model: list, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult emailaccountadd(string EmailId, string HostName, string Password, string SMTPPORT,
//   string SenderName, string SenderEmail)
// auth (PORT-NOTE: legacy had no session check; admin-only write of SMTP credentials => adminAuth)
router.all(`/admin/${C}/emailaccountadd{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const row = (await manage({
    MODE: '2', EMAILID: nStr(req.p.EmailId), HOSTNAME: nStr(req.p.HostName), PASSWORD: nStr(req.p.Password), SMTP: nStr(req.p.SMTPPORT),
    SENDERNAME: nStr(req.p.SenderName), SENDEREMAIL: nStr(req.p.SenderEmail), UPDATEDBY: '0', EAID: '0',
  }))[0];
  const result = outResult(row);
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult updateEmail(string EmailId, string HostName, string Password, string SMTPPORT,
//   string SenderName, string SenderEmail, int Tid)
// auth (PORT-NOTE: legacy had no session check; admin-only write of SMTP credentials => adminAuth)
router.all(`/admin/${C}/updateEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Tid = reqInt(req.p.Tid, 'Tid');
  const row = (await manage({
    MODE: '3', EMAILID: nStr(req.p.EmailId), HOSTNAME: nStr(req.p.HostName), PASSWORD: nStr(req.p.Password), SMTP: nStr(req.p.SMTPPORT),
    SENDERNAME: nStr(req.p.SenderName), SENDEREMAIL: nStr(req.p.SenderEmail), UPDATEDBY: '0', EAID: Tid,
  }))[0];
  const result = outResult(row);
  return res.json(result);
}));

module.exports = router;
