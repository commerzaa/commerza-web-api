// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SendBulkEmailToSystemUsersWithFiltration.cs (SendBulkEmailToSystemUsersWithFiltrationController)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, NRE, outCol, toInt32, cvtInt32Str, rep, bindInt, view, multerAny } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/SendBulkEmailToSystemUsersWithFiltration';
/** Controllers/CustomerPanel/SentEmailHistory.cs class SENDMAILHISTORYINIDEX */
const SENDMAILHISTORYINIDEX = ['RowNumber', 'TECMID', 'FROMEMAIL', 'TOEMAIL', 'SUBJECT', 'MESSAGE', 'SENDDATE', 'CampaignName', 'CampaignDateAndTime',
  'CreateDate', 'SendingStatus'];
const str = (v) => (v === undefined || v === '' ? null : v); // MVC string binding

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${P}/Index{/:id}`, P], ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'send_bulkmail_history', { PLID: Plid });
  // PORT-NOTE (legacy bug reproduced): SEND_BULKMAIL_HISTORY returns SM_ID, FROMEMAIL, TOEMAIL, SENDDATE only, but
  // SqlQuery<SENDMAILHISTORYINIDEX> needs a column for every member (RowNumber, TECMID, ...), so EF threw
  // "The data reader is incompatible ..." and this page always ended in the error page. The query still runs; the same error is
  // raised unless the result really provides the members.
  const cols = rows.length ? Object.keys(rows[0]).map((k) => k.toLowerCase()) : [];
  const missing = SENDMAILHISTORYINIDEX.find((p) => !cols.includes(p.toLowerCase()));
  if (missing) {
    throw new Error(`The data reader is incompatible with the specified 'SENDMAILHISTORYINIDEX'. A member of the type, '${missing}', does not have a corresponding column in the data reader with the same name.`);
  }
  let BULKMAIL_HISTORY = mapRows(rows, SENDMAILHISTORYINIDEX);
  if (BULKMAIL_HISTORY != null) {
    return view(res, '~/Views/CustomerPanel/SendBulkEmailToSystemUsersWithFiltration/Index.cshtml', BULKMAIL_HISTORY);
  }
  BULKMAIL_HISTORY = [];
  return view(res, '~/Views/CustomerPanel/SendBulkEmailToSystemUsersWithFiltration/Index.cshtml', BULKMAIL_HISTORY);
}));

// ---------------------------------------------------------------- SENDBULKEMAIL(string Email)  [HttpGet]
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.get(`${P}/SENDBULKEMAIL{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let Email = str(req.p.Email);
  if (Email == null) Email = '';
  const Plid = Number(req.user.plid);
  try {
    // db.Database.CommandTimeout = 100 (the extra @TotalCount OUT parameter is not referenced by the command text)
    const GETEMAILLIST = mapRows(await db.proc(DB, 'usp_all_email', { PLID: Plid, Email: Email.trim() }), ['EMAIL']);
    return view(res, '~/Views/CustomerPanel/SendBulkEmailToSystemUsersWithFiltration/SendBulkEmail.cshtml', undefined, {
      PLID: toInt32(Plid), EMAIL: GETEMAILLIST,
    });
  } catch (ex) { /* swallowed as legacy */ }
  return view(res, '~/Views/merchant/Manager_History/Index.cshtml');
}));

// ---------------------------------------------------------------- SAVEMAIL(int FROMEMAIL, string TOEMAIL, string SUBJECT, string BODY, HttpPostedFileBase file)
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`${P}/SAVEMAIL{/:id}`, ps.customerAuth, multerAny(), asyncHandler(async (req, res) => {
  const FROMEMAIL = bindInt(req.p.FROMEMAIL, 'FROMEMAIL');
  let TOEMAIL = str(req.p.TOEMAIL); const SUBJECT = str(req.p.SUBJECT); let BODY = str(req.p.BODY);
  const file = (req.files || []).find((f) => String(f.fieldname).toLowerCase() === 'file') || null;
  let ResValue = 0;
  let success = '';
  if (TOEMAIL != null) {
    if (TOEMAIL.length - 1 < 0) throw new RangeError('Length cannot be less than zero.\r\nParameter name: length');
    TOEMAIL = TOEMAIL.substring(1, 1 + TOEMAIL.length - 1);
  }
  if (BODY === null) throw NRE();
  BODY = rep(BODY, '04030198719871987', '<');
  BODY = rep(BODY, '04030198719871988', '>');
  const Plid = Number(req.user.plid);
  const apiset = await db.queryOne(DB, 'SELECT emailid, password, hostname FROM tbl_emailmembermaster WHERE temid = @FROMEMAIL LIMIT 1', { FROMEMAIL });
  if (apiset != null) {
    success = await UtilityClass.SendEmailByApiSetting(apiset.emailid, apiset.password, apiset.hostname, apiset.emailid, TOEMAIL, '', '', SUBJECT, BODY, file);
    if (success != null) {
      const r = await db.procOne(DB, 'sp_sendmail', {
        PLID: Plid, FROMEMAIL, TOEMAIL, MSGSUBJECT: SUBJECT, MESSAGE: BODY, ATTACHMENT: '', MAILTYPE: 2,
      });
      ResValue = cvtInt32Str(outCol(r, 'intresult'));
    } else {
      ResValue = 0;
    }
  }
  res.json(ResValue);
}));

module.exports = router;
