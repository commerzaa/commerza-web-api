'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Email_master.cs (class Email_masterController, no namespace => /Email_master/...)
// Database: affiliate (Db_Affiliate). Proc USP_EMAIL_SETTINGCENTER.
// The C# file also declares email_master_edit (unused property bag - not ported). The empty constructor has no logic.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { nInt, nStr, reqInt, nullRef } = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Email_master';

/** public class email_master */
const EMAIL_MASTER_PROPS = ['EID', 'Action_Name', 'Email_Subject', 'Email_Content', 'Email_Send_Status', 'IsEmailActive'];
/** public class EmailVariable */
const EMAIL_VARIABLE_PROPS = ['var_id', 'actionID', 'var_name', 'var_symbol', 'var_code', 'status'];

/** USP_EMAIL_SETTINGCENTER @StartRowIndex,@MaxRows,@MCID,@MODE,@Status,@actionname,@subject,@Message,@STRRESULT */
const settingCenter = (p) => db.proc(DB, 'USP_EMAIL_SETTINGCENTER', p);
/** Json(null) writes an empty body */
const jsonOrEmpty = (res, v) => (v === null || v === undefined ? res.type('application/json').send('') : res.json(v));

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/Email-Content" -> Email_master/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Email-Content'], adminAuth, asyncHandler(async (req, res) => {
  let page = nInt(req.p.page);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: the legacy batch "USP_EMAIL_SETTINGCENTER @StartRowIndex,@MaxRows,@MCID,@MODE,@actionname,@subject,@Message,@STRRESULT" omits
  // @Status, so the values shifted one position left (all ""): Status = '' (=> 0 for an int parameter), actionname/subject/Message = ''.
  const AllSmsCenter = mapRows(await settingCenter({
    StartRowIndex: page, MaxRows, MCID: 3, MODE: 1, Status: 0, actionname: '', subject: '', Message: '',
  }), EMAIL_MASTER_PROPS);
  res.json({ view: '~/Views/AdminPanel/Email_master/Index.cshtml', Model: AllSmsCenter });
}));

// ---------------------------------------------------------------- JsonResult SmsVariable(int moduleid, int? page, string Message)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/SmsVariable{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const moduleid = reqInt(req.p.moduleid, 'moduleid');
  let page = nInt(req.p.page);
  let Message = nStr(req.p.Message);
  if (Message === null) throw nullRef();
  Message = Message.split('+#!#+').join('<');
  Message = Message.split('+!#!+').join('>');
  Message = Message.replace(/<(.|\n)*?>/g, ''); // computed but (as in legacy) not sent to the proc
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const AllSmsCenter = mapRows(await settingCenter({
    StartRowIndex: page, MaxRows, MCID: moduleid, MODE: 2, Status: 1, actionname: '', subject: '', Message: '', STRRESULT: '',
  }), EMAIL_VARIABLE_PROPS);
  return res.json(AllSmsCenter);
}));

// ---------------------------------------------------------------- JsonResult UpdateData(int id, string actionname, string subject, string Message)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateData{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const id = reqInt(req.p.id, 'id');
  const actionname = nStr(req.p.actionname);
  const subject = nStr(req.p.subject);
  let Message = nStr(req.p.Message);
  if (Message === null) throw nullRef();
  Message = Message.split('+#!#+').join('<');
  Message = Message.split('+!#!+').join('>');
  const MaxRows = await UtilityClass.GridPageSize();
  const r = (await settingCenter({
    StartRowIndex: 1, MaxRows, MCID: id, MODE: 3, Status: 0, actionname, subject, Message, STRRESULT: '',
  }))[0];
  return jsonOrEmpty(res, r ? mapRow(r, EMAIL_MASTER_PROPS) : null);
}));

// ---------------------------------------------------------------- JsonResult updatestatus(int Status, int EID)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/updatestatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Status = reqInt(req.p.Status, 'Status'); // (`Status == null` checks on an int are always false)
  const EID = reqInt(req.p.EID, 'EID');
  const r = (await settingCenter({
    STARTROWINDEX: 1, MAXROWS: 100, MCID: EID, MODE: 4, Status, actionname: '', subject: '', Message: '', STRRESULT: '',
  }))[0];
  return jsonOrEmpty(res, r ? mapRow(r, EMAIL_VARIABLE_PROPS) : null);
}));

module.exports = router;
