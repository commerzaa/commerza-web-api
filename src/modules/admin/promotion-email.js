'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Promotion_Email.cs (class Promotion_EmailController => /admin/Promotion_Email/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nre, nstr, reqInt, toInt32, col, view, mapRows, mapRow } = require('./_shared/batch02-common');
const { firstCol } = require('./_shared/batch11-common');
const {
  KIT_MASTER_PROPS, TBL_EMAILTEMPLATE_PROPS, TBL_EMAILACCOUNT_PUBLIC_PROPS, jsonDenyGet, jsonNull,
} = require('./_shared/batch13-02-common');

const router = express.Router();
const C = 'Promotion_Email';

// ---------------------------------------------------------------- Index(string datetype, string fromDate, string ddlpackage, string toDate, string SEARCHFIELD, string Status, string SearchValue, int? totalcount)
// auth (PORT-NOTE: legacy had NO session check; it lists every member e-mail id => adminAuth)
// route-config: "AdminPanel/Promotional-Email" -> Promotion_Email/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Promotional-Email'], adminAuth, asyncHandler(async (req, res) => {
  let datetype = nstr(req.p.datetype);
  let fromDate = nstr(req.p.fromDate);
  let ddlpackage = nstr(req.p.ddlpackage);
  let toDate = nstr(req.p.toDate);
  let SEARCHFIELD = nstr(req.p.SEARCHFIELD);
  let Status = nstr(req.p.Status);
  let SearchValue = nstr(req.p.SearchValue);
  const ViewBag = {};
  if (datetype === null) datetype = '';
  if (SEARCHFIELD === null) SEARCHFIELD = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Status === null) Status = '';
  if (ddlpackage === '-select Package-') ddlpackage = '0';
  let TotalNumbers = 0;
  // [USP_Promotional_EMAILID] @SEARCHFIELD,@SEARCHVALUE,@fromDate,@Todate,@USERTYPE,@customertype,@kid
  // PORT-NOTE: legacy also added SqlParameter @datetype, but it is not in the EXEC text => never passed (proc default '' applies). Kept.
  const kid = toInt32(ddlpackage);
  const totallist = firstCol(await db.proc(DB, 'USP_Promotional_EMAILID', {
    SEARCHFIELD, SEARCHVALUE: SearchValue, fromDate, Todate: toDate, USERTYPE: Status, customertype: '', kid,
  }));
  ViewBag.ddlpackage = ddlpackage;
  if (totallist !== '') {
    if (totallist === null || totallist === undefined) throw nre(); // totallist.Split(',') on null
    const Allnumber = String(totallist).split(',');
    TotalNumbers = Allnumber.length;
    ViewBag.Totalmobile = TotalNumbers;
  } else {
    ViewBag.Totalmobile = TotalNumbers;
  }
  ViewBag.TotalEmail = totallist;
  ViewBag.TempleateName = mapRows(await db.query(DB, 'select etid, title, subject, emailcontent from tbl_emailtemplate', {}), TBL_EMAILTEMPLATE_PROPS);
  // PORT-NOTE: TBL_EMAILACCOUNT.PASSWORD (SMTP password) is not returned to the client.
  ViewBag.EmailName = mapRows(await db.query(DB, `select eaid, emailid, hostname, smtpport, sendername, senderemail, status
    from tbl_emailaccount where status = 1`, {}), TBL_EMAILACCOUNT_PUBLIC_PROPS);
  ViewBag.kitms = mapRows(await db.query(DB, 'select * from kit_master where status = 1', {}), KIT_MASTER_PROPS);
  return view(res, '~/Views/AdminPanel/Promotion_Email/Index.cshtml', undefined, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult GetMessageSubjectByEtid(int ETID)
// auth (PORT-NOTE: legacy had no session check)
router.all(`/admin/${C}/GetMessageSubjectByEtid{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ETID = reqInt(req.p.ETID, 'ETID');
  const r = await db.queryOne(DB, 'select etid, title, subject, emailcontent from tbl_emailtemplate where etid = @ETID limit 1', { ETID });
  if (!r) return jsonNull(res);
  return res.json(mapRow(r, TBL_EMAILTEMPLATE_PROPS));
}));

// ---------------------------------------------------------------- JsonResult SendMsgOnEmailid(string from, string Password, string HostName, string ToEmailId, string Subject, string BodyMessage)
// auth (PORT-NOTE: legacy had no session check; sends mail through the configured company accounts => adminAuth)
router.all(`/admin/${C}/SendMsgOnEmailid{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const from = nstr(req.p.from);
  let Password = nstr(req.p.Password);
  let HostName = nstr(req.p.HostName);
  const ToEmailId = nstr(req.p.ToEmailId);
  const Subject = nstr(req.p.Subject);
  let BodyMessage = nstr(req.p.BodyMessage);
  if (BodyMessage === null) throw nre();
  BodyMessage = BodyMessage.split('lessthan').join('<');
  BodyMessage = BodyMessage.split('greatthan').join('>');
  // db._TBL_EMAILACCOUNT.Where(a => a.EMAILID == from).FirstOrDefault()
  const tbldata = await db.queryOne(DB, 'select emailid, hostname, password from tbl_emailaccount where emailid is not distinct from @from limit 1', { from });
  if (tbldata) {
    HostName = col(tbldata, 'hostname');
    Password = col(tbldata, 'password');
    // ViewBag.from = tbldata.EMAILID (unused by a JsonResult)
  }
  // new Thread(() => UtilityClass.SendBulkOrSingleEmailDynamic(...)).Start() => fire-and-forget
  setImmediate(() => {
    Promise.resolve()
      .then(() => UtilityClass.SendBulkOrSingleEmailDynamic(from, Password, HostName, ToEmailId, '', '', Subject, BodyMessage))
      .catch((e) => console.error('[admin/Promotion_Email] mail thread failed:', e.message));
  });
  return jsonDenyGet(req, res); // return Json(JsonRequestBehavior.AllowGet)
}));

module.exports = router;
