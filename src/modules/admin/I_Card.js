'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\I_Card.cs (class I_CardController => /admin/I_Card/...)
// Database: affiliate (Db_Affiliate). The file also declares `public class member_details` (model => MEMBER_DETAILS_PROPS).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'I_Card';

/** class member_details */
const MEMBER_DETAILS_PROPS = ['regNo', 'LoginId', 'FName', 'LName', 'userName', 'Emailid', 'RegDate', 'address', 'mobile', 'city', 'imagename', 'Dob'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/I-Card" -> I_Card/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/I-Card'], adminAuth, asyncHandler(async (req, res) => {
  return res.json({ view: '~/Views/AdminPanel/I_Card/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult check_icard(string memberID)
// auth (legacy had no session check; returns member PII => protected)
router.all(`/admin/${C}/check_icard{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberID = B.nStr(req.p.memberID);
  try {
    if (memberID === null) throw B.nullRef(); // memberID.Trim()
    // db._Member_Master.Where(m => m.userName.Trim().ToLower() == memberID.Trim().ToLower()).FirstOrDefault()
    const mm = await db.queryOne(DB, 'select regno from member_master where lower(trim(username)) = lower(trim(@memberID)) limit 1', { memberID });
    if (!mm) return res.json('string^Invalid Username !');
    const regNo = B.col(mm, 'regno');
    const row = await db.queryOne(DB, `select regno, loginid, fname, lname, username, emailid, address, regdate, dob, mobile, c.cityname as city, imagename
      from member_master mm left join city c on c.ctid = mm.ctid where regno = @regNo limit 1`, { regNo });
    const memberdetails = row ? mapRow(row, MEMBER_DETAILS_PROPS) : null;
    return res.json(memberdetails);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'check_icard');
    return res.json('string^Something went wrong. Please try later');
  }
}));

module.exports = router;
