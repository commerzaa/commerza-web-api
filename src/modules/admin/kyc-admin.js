'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\KYCAdminController.cs
// (namespace New_NGC.Controllers.AdminPanel, class KYCAdminController => /admin/KYCAdmin/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const SendMail = require('../../lib/admin/SendMail');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');
const { GetHtmlBodyForKyc, GetHtmlBodyRejectForKyc } = require('./_shared/batch08-d1-kyc-mail');

const router = express.Router();
const DB = 'affiliate';
const C = 'KYCAdmin';

/** class KYCListadmin */
const KYC_LIST_PROPS = ['INT_ROW_NUMMBER', 'ID', 'REGNO', 'TYPE', 'IMAGE', 'ISAPROVE', 'INT_STATUS', 'DTM_DATE', 'DTM_APROVE', 'COMMENTORREMARK',
  'ISDELETED', 'GETMAINTYPE', 'STATUS_CLASS'];
/** class getdetailsadmin */
const DETAILS_PROPS = ['id', 'Regno', 'Type', 'Image', 'KYC_No'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** System.DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") (en-US) */
function longStamp(d = new Date()) {
  const p2 = (n) => String(n).padStart(2, '0');
  const H = d.getHours();
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${p2(d.getDate())} ${d.getFullYear()} ${p2(H % 12 === 0 ? 12 : H % 12)}:${p2(d.getMinutes())} ${H < 12 ? 'AM' : 'PM'}`;
}

/** DataRow["col"].ToString() (case-insensitive column lookup; DBNull => "") */
const dr = (row, name) => B.str(B.col(row, name));

/** private void SendEmailToMember(int status, long RegNo) */
async function SendEmailToMember(req, status, RegNo) {
  if (status === 1 || status === 2) {
    try {
      // ObjDut.GetDataTable("Select ISNULL(Fname,'') as Name, Isnull(Phone,'') As Phone,EMAILID,Username from Portal_Login where Regno = " + RegNo)
      const DT = await db.query(DB,
        "select coalesce(fname,'') as name, coalesce(phone,'') as phone, emailid, username from portal_login where regno = @RegNo",
        { RegNo });
      const datetime = longStamp();
      const Message = status === 1
        ? "Your KYC has been <span style='color:green'>Approved</span> by our Administrative Team."
        : "Your KYC has been <span style='color:Red'>Rejected</span> by our Administrative Team.";
      const MemName = dr(B.at(DT, 0), 'USERNAME'); // DT.Rows[0] (IndexOutOfRange when no row => catch)
      const SmsMessage = status === 1
        ? 'Dear ' + MemName + ',\r\nYour KYC is approved and verified. Thank you. For further details, visit https: http://cryptoinbox.com \r\n The CryptoInbox Team'
        : 'Dear ' + MemName + ',\r\nWe would like to inform you, that your KYC documents have been rejected. For further details, visit https: http://cryptoinbox.com \r\nThe CryptoInbox Team';
      const Phone = dr(DT[0], 'Phone');
      const email = dr(DT[0], 'EMAILID');
      const Username = dr(DT[0], 'Username');
      await UtilityClass.SendMsgOnMobile(Phone, SmsMessage);
      let body = status === 1 ? GetHtmlBodyForKyc() : GetHtmlBodyRejectForKyc();
      body = body.split('$$lblName$$').join(Username);
      body = body.split('$$message$$').join(Message);
      body = body.split('$$datetime$$').join(datetime);
      // background thread: SendMail.Send("", email, "", "", "CryptoInbox Support Center", body)
      setImmediate(() => {
        Promise.resolve().then(() => SendMail.Send('', email, '', '', 'CryptoInbox Support Center', body))
          .catch((e) => console.error('[KYCAdmin] SendMail failed:', e.message));
      });
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'SendEmailToMember');
    }
  }
}

// ---------------------------------------------------------------- ActionResult Index(string Regno)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","Home"))
// route-config: "AdminPanel/Admin-Kyc" -> KYCAdmin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Admin-Kyc'], adminAuth, asyncHandler(async (req, res) => {
  const Regno = B.nStr(req.p.Regno);
  let newregno = 0; // private int newregno = 0 (instance field, per request)
  try {
    newregno = B.cvtInt(await UtilityClass.Decryptword(Regno));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
  }
  const ViewBag = {};
  // _KYC_STATUS @REGNO,@INT_STATUS OUT,@APPROVALSTATUS OUT
  const rows = await db.proc(DB, '_KYC_STATUS', { REGNO: newregno });
  const kyclist = mapRows(rows, KYC_LIST_PROPS);
  ViewBag.KYCStatus = B.str(B.col(rows[0], 'int_status'));
  ViewBag.kycverify = B.str(B.col(rows[0], 'approvalstatus'));
  res.json({ view: '~/Views/AdminPanel/KYCAdmin/Index.cshtml', Model: kyclist, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult updateApprove(long Regno, int id, string Remarks)
// auth (optionalAuth + legacy reply "Session Expired. Please login again")
router.all(`/admin/${C}/updateApprove{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Regno = B.reqInt(req.p.Regno, 'Regno');
  const id = B.reqInt(req.p.id, 'id');
  const Remarks = B.nStr(req.p.Remarks);
  let result = 'notok';
  let stats = 0;
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    // db._KYC.Where(a => a.Regno == Regno && a.id == id).FirstOrDefault(); Row.dtm_Aprove = UtcNow; isAprove = 1; CommentOrRemark = Remarks; SaveChanges()
    const Row = await db.queryOne(DB, 'select id from kyc where regno = @Regno and id = @id limit 1', { Regno, id });
    if (Row !== null && Row !== undefined) {
      stats = await db.exec(DB,
        "update kyc set dtm_aprove = (now() at time zone 'utc'), isaprove = 1, commentorremark = @Remarks where id = @rid",
        { Remarks, rid: B.col(Row, 'id') });
      if (stats > 0) {
        result = 'ok';
        await SendEmailToMember(req, 1, Regno);
      }
    } else {
      result = 'notok';
    }
    return res.json(result);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'updateApprove');
    return res.json('Something went wrong. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult getdetails(int newid)
// auth (legacy had NO session check; returns a member's KYC document images => protected, see report)
router.all(`/admin/${C}/getdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const newid = B.reqInt(req.p.newid, 'newid');
  // PORT-NOTE: column KYC_No does not exist in the Db_Affiliate KYC table dump, so legacy threw (500); the query is kept as written.
  const rows = await db.query(DB, 'select id, regno, type, image, kyc_no from kyc where id = @newid', { newid });
  res.json(mapRows(rows, DETAILS_PROPS));
}));

// ---------------------------------------------------------------- JsonResult SaveComment(long Regno, int id, string Remarks)
// auth (optionalAuth + legacy reply "Session Expired. Please login again")
router.all(`/admin/${C}/SaveComment{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Regno = B.reqInt(req.p.Regno, 'Regno');
  const id = B.reqInt(req.p.id, 'id');
  const Remarks = B.nStr(req.p.Remarks);
  let returnval = '';
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    const Row = await db.queryOne(DB, 'select id from kyc where regno = @Regno and id = @id limit 1', { Regno, id });
    if (Row !== null && Row !== undefined) {
      // EF SaveChanges() only writes (and counts) the row when a value really changed
      const result = await db.exec(DB,
        `update kyc set commentorremark = @Remarks, isaprove = 2
          where id = @rid and (commentorremark is distinct from @Remarks or isaprove is distinct from 2)`,
        { Remarks, rid: B.col(Row, 'id') });
      if (result > 0) {
        returnval = 'ok';
        await SendEmailToMember(req, 2, Regno);
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'SaveComment');
    return res.json('Something Went Wrong. Please Try later');
  }
  return res.json(returnval);
}));

// public static string GetHtmlBodyForKyc() / GetHtmlBodyRejectForKyc(): static => not MVC actions (see _shared/batch08D1_kycMail.js)

module.exports = router;
