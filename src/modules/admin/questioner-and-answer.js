'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\QuestionerAndAnswerController.cs (class QuestionerAndAnswerController => /admin/QuestionerAndAnswer/...)
// Database: affiliate (Db_Affiliate). Proc: Usp_ManageQuestionAnswner (PORT-NOTE: not present in the affilate.sql dump; contract taken from the C# call).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, outStr } = require('./_shared/batch12-common');
const { omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'QuestionerAndAnswer';

// ---------------------------------------------------------------- ActionResult Index()
// public (legacy: no session check, view only)
// route-config: "AdminPanel/create-question" -> QuestionerAndAnswer/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/create-question{/:id}'], (req, res) => {
  res.json({ view: '~/Views/AdminPanel/QuestionerAndAnswer/Index.cshtml' });
});

// ---------------------------------------------------------------- JsonResult AddNewQuestion(string Question, string A, string B, string C, string D, string Answer, string Mode)
// auth (legacy had no session check; admin write operation => adminAuth)
router.all(`/admin/${C}/AddNewQuestion{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // [Usp_ManageQuestionAnswner] @Question,@A,@B,@C,@D,@Answer,@Mode,@StrOutPutResult OUT
  const row = await db.procOne(DB, 'Usp_ManageQuestionAnswner', omitNull({
    Question: nStr(req.p.Question), A: nStr(req.p.A), B: nStr(req.p.B), C: nStr(req.p.C), D: nStr(req.p.D), Answer: nStr(req.p.Answer),
    Mode: nStr(req.p.Mode),
  })); // (C# null values are not sent => proc default)
  const ReturnResult = outStr(row, 'StrOutPutResult'); // StrOutPutResult.Value.ToString()
  return res.json(ReturnResult);
}));

module.exports = router;
