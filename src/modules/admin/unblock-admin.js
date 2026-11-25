'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Unblock_Admin.cs (class Unblock_AdminController => /admin/Unblock_Admin/...)
// Database: affiliate (Db_Affiliate). Proc USP_GETUPDATE_SINGLRECORD; tables tbl_employee_master, tbl_companymaster.
// Pre-login page (unblock a blocked admin id): every action is public; Session/TempData values live in the anonymous
// (per-IP) sessionStore subject, see _shared/SESSION.md section 3 (SessionOTP) / anonReq.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const { anonReq } = require('./_shared/admin-session');
const { DB, nStr, nullRef } = require('./_shared/batch11-common');
const { tdSet, tdGet } = require('./_shared/batch04-a-common');
const { dbFirstCol } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'Unblock_Admin';

// ---------------------------------------------------------------- ActionResult Index()
// public (pre-login page, no session check in legacy)
// route-config: "AdminPanel/UnblockId" -> Unblock_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/UnblockId'], (req, res) => {
  res.json({ view: '~/Views/Unblock_Admin/Index.cshtml' });
});

// ---------------------------------------------------------------- JsonResult sendotpemail(string emialid)
// public (pre-login)
router.all(`/admin/${C}/sendotpemail{/:id}`, asyncHandler(async (req, res) => {
  const emialid = nStr(req.p.emialid);
  const sreq = anonReq(req);
  let empcount = 0;
  let empname = '';
  if (emialid === null) throw nullRef(); // emialid.Trim()
  // USP_GETUPDATE_SINGLRECORD @MODE,@EMAILID  (SqlQuery<string>().FirstOrDefault())
  const emp_emialid = dbFirstCol(await db.proc(DB, 'USP_GETUPDATE_SINGLRECORD', { MODE: 1, EMAILID: emialid.trim() }));
  if (emp_emialid === null || emp_emialid === undefined) {
    empcount = 1;
  } else {
    tdSet(sreq, 'example', emp_emialid); // TempData["example"]
    let genratchar = String(await UtilityClass.GenerateRandomNumber());
    if (genratchar.length < 4) throw new Error('Index and length must refer to a location within the string.\r\nParameter name: length');
    genratchar = genratchar.substring(0, 4);
    let OTP = String(await UtilityClass.RandomNumberStringByLength(4));
    OTP = genratchar + OTP;
    sessionStore.set(sreq, 'SessionOTP', OTP); // Session["SessionOTP"] (never returned)
    const nameRow = await db.queryOne(DB, 'select emp_name from tbl_employee_master where emp_email = @e limit 1', { e: emp_emialid });
    empname = nameRow ? nameRow.emp_name : null;
    const idRow = await db.queryOne(DB, 'select emp_loginid from tbl_employee_master where emp_email = @e limit 1', { e: emp_emialid });
    const userid = idRow ? idRow.emp_loginid : null;
    if (empname === null || empname === undefined || empname === '') {
      const r = await db.queryOne(DB, 'select emp_loginid from tbl_employee_master where emp_email = @e limit 1', { e: emp_emialid });
      empname = r ? r.emp_loginid : null;
    }
    const ip_address = GetIP.GetLocalIP(req);
    const cRow = await db.queryOne(DB, 'select name from tbl_companymaster where comid = 1 limit 1', {});
    const companyname = cRow ? cRow.name : null;
    const s = (v) => (v === null || v === undefined ? '' : String(v)); // C# string concatenation of null => ""
    const Emailmsg = 'Dear ' + s(empname)
      + ', <br/> As per your request from IP-Addrss :- ' + s(ip_address) + ' To unblock your ' + s(userid) + ' account of ' + s(companyname)
      + ' your unblock code is. ' + OTP
      + ' <br/> Thanks & Regards '
      + '<br/> Support Team';
    // new Thread(...).Start() => fire-and-forget
    Promise.resolve()
      .then(() => UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', emialid, 'Unblock Id', Emailmsg, null, '', ''))
      .catch((e) => console.error('[admin/Unblock_Admin] SendEmailByApiSetting failed:', e.message));
    empcount = 2;
  }
  return res.json(empcount);
}));

// ---------------------------------------------------------------- JsonResult compareotp(string otp)
// public (pre-login)
router.all(`/admin/${C}/compareotp{/:id}`, asyncHandler(async (req, res) => {
  const otp = nStr(req.p.otp);
  const sreq = anonReq(req);
  let count = 0;
  const so = sessionStore.get(sreq, 'SessionOTP');
  if (so === null || so === undefined) throw nullRef(); // Session["SessionOTP"].ToString()
  const compareotp = String(so);
  if (otp === compareotp) {
    const ex = tdGet(sreq, 'example');
    if (ex === null) throw nullRef(); // TempData["example"].ToString()
    const email = String(ex);
    // USP_GETUPDATE_SINGLRECORD @MODE,@EMAILID (ExecuteSqlCommand)
    await db.proc(DB, 'USP_GETUPDATE_SINGLRECORD', { MODE: 2, EMAILID: email });
    count = 1;
  } else {
    count = 2;
  }
  return res.json(count);
}));

module.exports = router;
