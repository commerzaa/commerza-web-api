'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ChallanMemberController.cs (class ChallanMemberController => /admin/ChallanMember/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { s, reqInt, col, str, cvtInt } = require('./_shared/batch04-a-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ChallanMember';

/** class ChallanDetails */
const PROPS = ['PCode', 'userName', 'Title', 'Amount', 'LoginId', 'Fname', 'Mname', 'Lname', 'ChallanImage', 'IsChallanVerified', 'ChallanSubmittedDate',
  'ChallanVerifyDate', 'ChallanVerifyById', 'PaymentMode', 'CommentOrRemark', 'CommentOrRemarkAdmin', 'PaymentModeName'];

// ---------------------------------------------------------------- ActionResult Index(string Regno)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","Home"))
// route-config: "AdminPanel/Challan-Member" -> ChallanMember/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Challan-Member'], adminAuth, asyncHandler(async (req, res) => {
  const Regno = s(req.p.Regno);
  let newregno = 0; // private int newregno = 0 (instance field)
  const ViewBag = {};
  try {
    if (Regno === null) throw new Error('Value cannot be null.'); // Decryptword(null)
    newregno = cvtInt(await UtilityClass.Decryptword(Regno)); // Convert.ToInt32(...)
    ViewBag.Regno = newregno;
  } catch (ExpObj) {
    newregno = 0;
    await errorInsert(req, ExpObj, 'Index');
  }
  const rows = await db.query(DB, `select pcode, km.title, cast(price as numeric(10,2)) as amount, loginid, username, fname, mname, lname, challanimage,
      ischallanverified, challansubmitteddate, challanverifydate, challanverifybyid, paymentmode, mm.commentorremark,
      (tid.commentorremark) as commentorremarkadmin, paymentmodename
    from member_master mm
    inner join kit_master km on mm.kid = km.kid
    inner join tbl_incomedistribution tid on tid.regno = mm.regno
    where mm.regno = @newregno
    order by tidid desc
    limit 1`, { newregno });
  return res.json({ view: '~/Views/AdminPanel/ChallanMember/Index.cshtml', Model: mapRows(rows, PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult ChallanVerify(int Regno)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ChallanVerify{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = reqInt(req.p.Regno, 'Regno');
  let ReturnOutPut = '';
  try {
    // [DBO].[Usp_ChallanManagement] @RegNo,@ChallanVerifyById,@StrResultOutPut OUT
    const row = await db.procOne(DB, 'Usp_ChallanManagement', { RegNo: Regno, ChallanVerifyById: req.user.emp_id });
    ReturnOutPut = str(col(row, 'strresultoutput'));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    ReturnOutPut = 'Something went wrong. Please try later Exp:' + ExpObj.message;
  }
  return res.json(ReturnOutPut);
}));

// ---------------------------------------------------------------- JsonResult CommentOrRemark(int Regno, string CommentOrRemark)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/CommentOrRemark{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = reqInt(req.p.Regno, 'Regno');
  const CommentOrRemark = s(req.p.CommentOrRemark);
  let ReturnOutPut = '';
  try {
    if (CommentOrRemark === null) throw new Error('Object reference not set to an instance of an object.');
    // [DBO].[Usp_ChallanManagement] @RegNo,@ChallanVerifyById,@StrResultOutPut OUT,@Mode,@CommentOrRemark
    const row = await db.procOne(DB, 'Usp_ChallanManagement', {
      RegNo: Regno, ChallanVerifyById: req.user.emp_id, Mode: 1, CommentOrRemark: CommentOrRemark.replace(/~/g, "'"),
    });
    ReturnOutPut = str(col(row, 'strresultoutput'));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'CommentOrRemark');
    ReturnOutPut = 'Something went wrong. Please try later Exp:' + ExpObj.message;
  }
  return res.json(ReturnOutPut);
}));

module.exports = router;
