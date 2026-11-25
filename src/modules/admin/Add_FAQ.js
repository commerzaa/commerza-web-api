'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_FAQ.cs (class Add_FAQController)
// Database: affiliate (Db_Affiliate). Tables: faq_quesans_master (FAQ_QUESANS_MASTER), faq_topicmaster (FAQ_TOPICMASTER).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nint, nstr, nre, reqInt, toInt32, outStr, col, view, mapRows, mapRow } = require('./_shared/batch02_common');

const router = express.Router();
const C = 'Add_FAQ';

const FAQS_PROPS = ['ROWNUMBER', 'FQID', 'FTID', 'FAQQUE', 'FAQANS', 'TOPICNAME', 'ACTIVE'];
const FAQ_QUESANS_MASTER_PROPS = ['FQID', 'FTID', 'FAQQUE', 'FAQANS', 'ACTIVE'];
const FAQ_TOPICMASTER_PROPS = ['FTID', 'TOPICNAME', 'ACTIVE'];

/** Convert.ToInt64(string): null => 0, invalid => FormatException */
const toInt64 = (s) => toInt32(s);

// ---------------------------------------------------------------- [AdminSessionExpire] Index(string fromDate, string toDate, int? page)
// auth ([AdminSessionExpire])
// route-config: "AdminPanel/add-faq" -> Add_FAQ/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/add-faq'], adminAuth, asyncHandler(async (req, res) => {
  let page = nint(req.p.page);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  if (page === null) page = 1;
  if (!fromDate) fromDate = '';
  if (!toDate) toDate = '';
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    const rows = await db.proc(DB, 'USP_FAQQUEANS', { STARTROWINDEX: page, MAXROWS: MaxRows, ORDERBYFIELD: '', SEARCHFIELD: '', SEARCHVALUE: '' });
    const Obj = mapRows(rows, FAQS_PROPS);
    const TotalRecord = toInt32(outStr(col(rows[0], 'totalcount')) || 'x'); // int.Parse(DBNull => "") => FormatException => catch
    const ViewBag = {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    };
    return view(res, '~/Views/AdminPanel/Add_FAQ/Index.cshtml', Obj, ViewBag);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_FAQQUEANS');
    return view(res, '~/Views/PageNotFound/Index.cshtml');
  }
}));

// ---------------------------------------------------------------- JsonResult InsertFaqMaster(string FaqTitle, string FaqQuestion, string FaqAnswer, int status, string Id)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/InsertFaqMaster{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FaqTitle = nstr(req.p.FaqTitle);
  let FaqQuestion = nstr(req.p.FaqQuestion);
  let FaqAnswer = nstr(req.p.FaqAnswer);
  const status = reqInt(req.p.status, 'status');
  const Id = nstr(req.p.Id);
  let FQID = 0;
  let Reply = '';
  // PORT-NOTE: MVC binds "" to null, so `Id != ""` / `FaqTitle != ""` are true for empty input (kept as in legacy).
  if (Id !== '') FQID = toInt64(Id);
  if (FaqTitle !== '' && FaqQuestion !== '' && FaqAnswer !== '') {
    const Active = status === 1;
    const Titles = toInt64(FaqTitle);
    if (FaqQuestion === null) throw nre();
    FaqQuestion = FaqQuestion.split('+#!#+').join('<');
    FaqQuestion = FaqQuestion.split('+!#!+').join('>');
    if (FaqAnswer === null) throw nre();
    FaqAnswer = FaqAnswer.split('+#!#+').join('<');
    FaqAnswer = FaqAnswer.split('+!#!+').join('>');
    let result;
    if (FQID === 0) {
      result = await db.exec(DB, 'insert into faq_quesans_master (faqque, faqans, ftid, active) values (@q, @a, @t, @act)', {
        q: FaqQuestion.trim(), a: FaqAnswer.trim(), t: Titles, act: Active,
      });
    } else {
      // EF: tracked row updated; SaveChanges() returns 0 when the row is missing or nothing changed
      result = await db.exec(DB, `update faq_quesans_master set faqque = @q, faqans = @a, ftid = @t, active = @act
        where fqid = @id and (faqque is distinct from @q or faqans is distinct from @a or ftid is distinct from @t or active is distinct from @act)`, {
        q: FaqQuestion.trim(), a: FaqAnswer.trim(), t: Titles, act: Active, id: FQID,
      });
    }
    Reply = String(result);
    return res.json(Reply);
  }
  return res.json('Please enter the mandatory fields.');
}));

// ---------------------------------------------------------------- JsonResult InsertFaqTopic(string TopicName, int status, string Id)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/InsertFaqTopic{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TopicName = nstr(req.p.TopicName);
  const status = reqInt(req.p.status, 'status');
  const Id = nstr(req.p.Id);
  let FTID = 0;
  if (Id !== '') FTID = toInt64(Id);
  if (TopicName !== '') {
    const Active = status === 1;
    if (TopicName === null) throw nre(); // TopicName.Trim()
    let result;
    if (FTID === 0) {
      result = await db.exec(DB, 'insert into faq_topicmaster (topicname, active) values (@n, @act)', { n: TopicName.trim(), act: Active });
    } else {
      result = await db.exec(DB, `update faq_topicmaster set topicname = @n, active = @act
        where ftid = @id and (topicname is distinct from @n or active is distinct from @act)`, { n: TopicName.trim(), act: Active, id: FTID });
    }
    return res.json(String(result));
  }
  return res.json('Please enter Topic.');
}));

// ---------------------------------------------------------------- JsonResult GetFaqDetails(long Id)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetFaqDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Id = reqInt(req.p.Id, 'Id');
  const Row = await db.queryOne(DB, 'select fqid, ftid, faqque, faqans, active from faq_quesans_master where fqid = @Id limit 1', { Id });
  if (Row) return res.json(mapRow(Row, FAQ_QUESANS_MASTER_PROPS));
  return res.json('');
}));

// ---------------------------------------------------------------- JsonResult GetFaqTopicDetails(long Id)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetFaqTopicDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Id = reqInt(req.p.Id, 'Id');
  const Row = await db.queryOne(DB, 'select ftid, topicname, active from faq_topicmaster where ftid = @Id limit 1', { Id });
  if (Row) return res.json(mapRow(Row, FAQ_TOPICMASTER_PROPS));
  return res.json('');
}));

// ---------------------------------------------------------------- JsonResult EditFaq(string FaqQuestion, string FaqAnswer, long Id, int Status)
// auth (legacy had no session check; does nothing => adminAuth for consistency)
router.all(`/admin/${C}/EditFaq{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  reqInt(req.p.Id, 'Id');
  reqInt(req.p.Status, 'Status');
  return res.json('');
}));

module.exports = router;
