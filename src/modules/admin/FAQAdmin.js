'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FAQAdmin.cs (class FAQAdminController => /admin/FAQAdmin/...)
// Database: affiliate (Db_Affiliate). EF DbSet _FAQ => table faq (id identity, title, question, answer, boxid, status bit).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FAQAdmin';

/** Models/FAQ.cs entity */
const FAQ_PROPS = ['id', 'Title', 'Question', 'Answer', 'boxid', 'status'];

/** non-nullable bool action parameter (MVC: "true"/"false", checkbox "true,false" => first value; missing/invalid => 500) */
function reqBool(v, name) {
  let s = v;
  if (Array.isArray(s)) s = s[0];
  if (typeof s === 'boolean') return s;
  if (typeof s === 'string') {
    const t = s.split(',')[0].trim().toLowerCase();
    if (t === 'true') return true;
    if (t === 'false') return false;
  }
  const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Boolean'`);
  e.status = 500;
  throw e;
}
/** non-nullable int entity column (DBNull => EF materialization error) */
function entInt(v) {
  if (v === null || v === undefined) throw new Error("The 'boxid' property on 'FAQ' could not be set to a 'null' value.");
  return Number(v);
}

// ---------------------------------------------------------------- Index()
// auth
// route-config: "AdminPanel/FAQ-Admin" -> FAQAdmin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/FAQ-Admin'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/FAQAdmin/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult FAQDetails_byid(int Id)
// public (legacy had no session check; reads a public FAQ row)
router.all(`/admin/${C}/FAQDetails_byid{/:id}`, asyncHandler(async (req, res) => {
  const Id = B.reqInt(req.p.Id, 'Id');
  const r = await db.queryOne(DB, 'select * from faq where id = @Id limit 1', { Id });
  if (!r) return res.type('application/json').send(''); // Json(null) => empty body
  const row = mapRow(r, FAQ_PROPS);
  if (row.status !== null && row.status !== undefined) row.status = !!row.status;
  return res.json(row);
}));

// ---------------------------------------------------------------- JsonResult UpdateFAQ(string Title, string Qus, string Ans, int mode, int id, int boxid, bool status)
// auth (PORT-NOTE: legacy had NO session check although it inserts/updates the FAQ table - protected here)
router.all(`/admin/${C}/UpdateFAQ{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Title = B.nStr(req.p.Title);
  const Qus = B.nStr(req.p.Qus);
  const Ans = B.nStr(req.p.Ans);
  const mode = B.reqInt(req.p.mode, 'mode');
  const id = B.reqInt(req.p.id, 'id');
  const boxid = B.reqInt(req.p.boxid, 'boxid');
  const status = reqBool(req.p.status, 'status');
  let ret = '';
  const pending = []; // changes tracked until db.SaveChanges()
  if (mode === 1) {
    const row = await db.queryOne(DB, 'select * from faq order by boxid desc nulls last limit 1', {});
    if (!row) throw B.nullRef();
    const F = { boxid: entInt(B.col(row, 'boxid')) + 1, Title, Question: Qus, Answer: Ans, status };
    pending.push(['insert into faq (title, question, answer, boxid, status) values (@Title, @Question, @Answer, @boxid, @status)', F]);
    ret = 'Insert';
  }
  if (mode === 2) {
    // row1 = _FAQ.Where(boxid == boxid).ToList(); row = _FAQ.Where(id == id).FirstOrDefault()
    const row = await db.queryOne(DB, 'select id from faq where id = @id limit 1', { id });
    if (!row) throw B.nullRef(); // row.Question = Qus on null
    pending.push(['update faq set question = @Qus, answer = @Ans, status = @status where id = @id', { Qus, Ans, status, id }]);
    pending.push(['update faq set title = @Title where boxid = @boxid', { Title, boxid }]);
    ret = 'Update';
  }
  if (mode === 3 && boxid > 0) {
    const F = { boxid, Title, Question: Qus, Answer: Ans, status };
    pending.push(['insert into faq (title, question, answer, boxid, status) values (@Title, @Question, @Answer, @boxid, @status)', F]);
    ret = 'Update';
  }
  await db.tx(DB, async (t) => { for (const [sql, p] of pending) await t.exec(sql, p); });
  return res.json(ret);
}));

module.exports = router;
