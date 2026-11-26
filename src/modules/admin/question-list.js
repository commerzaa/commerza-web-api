'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\QuestionListController.cs (class QuestionListController => /admin/QuestionList/...)
// Database: affiliate (Db_Affiliate). Proc: Usp_ManageQuestionAnswner (PORT-NOTE: not present in the affilate.sql dump).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB } = require('./_shared/batch12-common');

const router = express.Router();
const C = 'QuestionList';

/** class QuestionList */
const QUESTION_LIST_PROPS = ['TQMID', 'Question', 'A', 'B', 'C', 'D', 'StatusName'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (legacy had no session check; admin data => adminAuth)
// route-config: "AdminPanel/question-list" -> QuestionList/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/question-list'], adminAuth, asyncHandler(async (req, res) => {
  // [Usp_ManageQuestionAnswner] @Question,@A,@B,@C,@D,@Answer,@Mode,@StrOutPutResult OUT  (@StrOutPutResult was passed as input "")
  const rows = await db.proc(DB, 'Usp_ManageQuestionAnswner', { Question: '', A: '', B: '', C: '', D: '', Answer: '', Mode: 2 });
  const ObjPackageList = mapRows(rows, QUESTION_LIST_PROPS);
  return res.json({ view: '~/Views/AdminPanel/QuestionList/Index.cshtml', Model: ObjPackageList });
}));

module.exports = router;
