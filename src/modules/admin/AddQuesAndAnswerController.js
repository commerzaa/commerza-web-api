'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\AddQuesAndAnswerController.cs (class AddQuesAndAnswerController)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/adminSession');
const { DB, nstr, nre, reqInt, fmtDate, view, mapRow } = require('./_shared/batch02_common');

const router = express.Router();
const C = 'AddQuesAndAnswer';
const upload = multer({ storage: multer.memoryStorage() });

const MATCHDETAILS_PROPS = ['TMMID', 'MATCHTITLE', 'MATCHIMAGE', 'TEAMFIRST', 'TEAMSECOND', 'MATCHDATE', 'MATCHTIME', 'STADIUMNAME', 'PLACE', 'CREATEDBY',
  'CREATEDDATE', 'MODIFIEDBY', 'MODIFIEDDATE', 'ISACTIVE'];
/** Models/QuestionCategory.cs [Table("dbo.TBL_QUESTIONCATEGORYMASTER")] */
const QUESTIONCATEGORY_PROPS = ['TQCID', 'CATEGORYNAME', 'ISACTIVE'];
// class AnswerSetting { string AnswerText; int AnswerCheckbox }

/** HttpPostedFileBase file (multer memory storage, field "file") */
const postedFile = (req) => (req.files || []).find((f) => f.fieldname.toLowerCase() === 'file') || null;

// public void UploadFile(HttpPostedFileBase file)
function UploadFile(file) {
  if (!file) throw nre();
  const fileName = path.basename(file.originalname); // Path.GetFileName(file.FileName)
  const dir = path.join(config.uploadDir, 'MatchImage'); // Server.MapPath("~/MatchImage")
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), file.buffer);
}

// ---------------------------------------------------------------- Index()
// public (legacy had no session check; view only)
// route-config: "AdminPanel/add-ques-and-answer" -> AddQuesAndAnswer/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/add-ques-and-answer'], asyncHandler(async (req, res) => view(res, '~/Views/AdminPanel/QuesAndAnswer/Index.cshtml')));

// ---------------------------------------------------------------- JsonResult AddMatch(string matchtitle, string matchimage, string team1, string team2, string matchdate, string matchtime, string stadium, string place, int status, HttpPostedFileBase file)
// auth-by-check (legacy: no session => NullReferenceException inside the try => Json("error"))
router.all(`/admin/${C}/AddMatch{/:id}`, optionalAuth, upload.any(), asyncHandler(async (req, res) => {
  const status = reqInt(req.p.status, 'status');
  try {
    UploadFile(postedFile(req));
    // condition is always true (status != null on an int)
    if (!isAdmin(req)) throw nre();
    const Eid = req.user.emp_id;
    const date = fmtDate(new Date(), 'dd/MMM/yyyy');
    // PORT-NOTE: "" passed to INT/DATETIME parameters (@TMMID, @MODIFIEDDATE) => SQL Server 0 / 1900-01-01; passed as 0 / '1900-01-01' here.
    await db.proc(DB, 'USP_MATCH_DETAILS', {
      TMMID: 0, MATCHTITLE: nstr(req.p.matchtitle), MATCHIMAGE: nstr(req.p.matchimage), TEAM1: nstr(req.p.team1), TEAM2: nstr(req.p.team2),
      MATCHDATE: nstr(req.p.matchdate), MATCHTIME: nstr(req.p.matchtime), STADIUM: nstr(req.p.stadium), PLACE: nstr(req.p.place), MODE: 1,
      CREATEDBY: Eid, CREATEDDATE: date, MODIFIEDBY: '', MODIFIEDDATE: '1900-01-01', STATUS: status,
    });
    return res.json('success');
  } catch (Exp) {
    return res.json('error');
  }
}));

// ---------------------------------------------------------------- public void UploadFile(HttpPostedFileBase file)
// auth (public method => routable in legacy; writes a file => adminAuth)
router.all(`/admin/${C}/UploadFile{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  UploadFile(postedFile(req));
  res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetMatchDetails(int MatchID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetMatchDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const MatchID = reqInt(req.p.MatchID, 'MatchID');
  const rows = await db.proc(DB, 'usp_GetMatchDetails', { MATCHID: MatchID });
  if (!rows.length) return res.type('application/json').send(''); // Json(null)
  return res.json(mapRow(rows[0], MATCHDETAILS_PROPS));
}));

// ---------------------------------------------------------------- JsonResult UpdateMatch(int TMMID, string matchtitle, string matchimage, string team1, string team2, string matchdate, string matchtime, string stadium, string place, int status)
// auth-by-check (legacy: no session => NullReferenceException inside the try => ErrorInsert + Json("error"))
router.all(`/admin/${C}/UpdateMatch{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const TMMID = reqInt(req.p.TMMID, 'TMMID');
  const status = reqInt(req.p.status, 'status');
  try {
    if (!isAdmin(req)) throw nre();
    const Eid = req.user.emp_id;
    const date = fmtDate(new Date(), 'dd/MMM/yyyy');
    await db.proc(DB, 'USP_MATCH_DETAILS', {
      TMMID, MATCHTITLE: nstr(req.p.matchtitle), MATCHIMAGE: nstr(req.p.matchimage), TEAM1: nstr(req.p.team1), TEAM2: nstr(req.p.team2),
      MATCHDATE: nstr(req.p.matchdate), MATCHTIME: nstr(req.p.matchtime), STADIUM: nstr(req.p.stadium), PLACE: nstr(req.p.place), MODE: 2,
      CREATEDBY: 0, CREATEDDATE: '1900-01-01', MODIFIEDBY: String(Eid), MODIFIEDDATE: date, STATUS: status, // "" => 0 / 1900-01-01 (see AddMatch)
    });
    return res.json('success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_MATCH_DETAILS');
    return res.json('error');
  }
}));

// ---------------------------------------------------------------- JsonResult AddQuestionCategory(string categoryname, int status)
// auth-by-check (legacy: no session => NullReferenceException inside the try => ErrorInsert + Json("error"))
router.all(`/admin/${C}/AddQuestionCategory{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const status = reqInt(req.p.status, 'status');
  try {
    if (!isAdmin(req)) throw nre();
    const Eid = req.user.emp_id;
    const date = fmtDate(new Date(), 'dd/MMM/yyyy');
    await db.proc(DB, 'USP_QUESTIONCATEGORY', {
      TQCID: 0, CATEGORYNAME: nstr(req.p.categoryname), CREATEDBY: Eid, CREATEDDATE: date, MODIFIEDBY: '', MODIFIEDDATE: '1900-01-01', STATUS: status, MODE: 1,
    });
    return res.json('success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_QUESTIONCATEGORY');
    return res.json('error');
  }
}));

// ---------------------------------------------------------------- JsonResult GetCategoryDetails(int quesID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetCategoryDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const quesID = reqInt(req.p.quesID, 'quesID');
  const rows = await db.proc(DB, 'usp_GetQuesCategoryDetails', { QUESID: quesID });
  if (!rows.length) return res.type('application/json').send('');
  return res.json(mapRow(rows[0], QUESTIONCATEGORY_PROPS));
}));

// ---------------------------------------------------------------- JsonResult SubmitForm(string TQTMID, string TMMID, string TQCID, string Question, string Option, string[] AllAnswer)
// auth-by-check (legacy: no session => NullReferenceException inside the try => ErrorInsert + Json("error"))
router.all(`/admin/${C}/SubmitForm{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const P = (k) => nstr(req.p[k]);
  try {
    const TQTMID = P('TQTMID'); const TMMID = P('TMMID'); const TQCID = P('TQCID'); const Question = P('Question'); const Option = P('Option');
    // `TQTMID != "" || TMMID != "" | TQCID != "" || ...` (null != "" is true => practically always true)
    if (TQTMID !== '' || (TMMID !== '' | TQCID !== '') || Question !== '' || Option !== '') {
      let AllAnswer = req.p.AllAnswer !== undefined ? req.p.AllAnswer : req.p['AllAnswer[]'];
      if (AllAnswer !== undefined && AllAnswer !== null && !Array.isArray(AllAnswer)) AllAnswer = [AllAnswer];
      if (!AllAnswer) throw nre();
      if (!AllAnswer.length) throw new Error('Index was outside the bounds of the array.');
      if (AllAnswer[0] === null || AllAnswer[0] === undefined) throw nre();
      const JsonString = String(AllAnswer[0]);
      const Answer = JSON.parse(JsonString); // JavaScriptSerializer.Deserialize<AnswerSetting[]>
      if (!isAdmin(req)) throw nre();
      const Eid = req.user.emp_id;
      const date = fmtDate(new Date(), 'yyyy/MMM/dd');
      for (let i = 0; i < (Answer ? Answer.length : 0); i++) {
        const a = Answer[i] || {};
        if (a.AnswerText === null || a.AnswerText === undefined) throw nre();
        await db.proc(DB, 'USP_ADD_QUES_ANSWER', {
          ANSWER: String(a.AnswerText), ISCORRECT: a.AnswerCheckbox === undefined || a.AnswerCheckbox === null ? 0 : Number(a.AnswerCheckbox),
          TQTMID, TMMID, TQCID, QUESTION: Question, OPTION: Option, CREATEDBY: Eid, CREATEDDATE: date, MODIFIEDBY: '', MODIFIEDDATE: '1900-01-01', STATUS: 1,
        });
      }
    }
    return res.json('success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_ADD_QUES_ANSWER');
    return res.json('error');
  }
}));

module.exports = router;
