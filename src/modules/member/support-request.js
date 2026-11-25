'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Support_Request.cs  (Support_RequestController, 4 actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid
const express = require('express');
const router = express.Router();
const { query, scalar, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/Support_Request';
const SUPPORT_PROPS = ['TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS'];
const REPLY_PROPS = ['MESSAGE', 'DATE', 'TRID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE'];
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
// T-SQL CONVERT(VARCHAR(30), col, 100)  =>  'Mon dd yyyy hh:miAM'
const d100 = (c) => `(to_char(${c}, 'Mon') || ' ' || lpad(to_char(${c}, 'FMDD'), 2, ' ') || ' ' || to_char(${c}, 'YYYY') || ' ' || lpad(to_char(${c}, 'FMHH12'), 2, ' ') || ':' || to_char(${c}, 'MIAM'))`;
// PORT-NOTE: tbl_ticketmaster.status is varchar in the PostgreSQL schema while tbl_statusmaster.id is integer => compared as text.
const SUPPORT_SQL = `Select tm.ticketno, tm.categoryname, tm.subject, ${d100('tm."date"')} AS "date", ${d100('tm.lastupdate')} AS lastupdate, tm.message, tm.tmimage,
  (CASE WHEN sm.id = 1 THEN 'PENDING' WHEN sm.id = 0 THEN 'UNATTENDED' WHEN tm.status::text = '3' THEN 'INPROCESS' ELSE 'SOLVED' END) AS status
  From tbl_ticketmaster tm INNER JOIN tbl_statusmaster sm ON sm.id::text = tm.status::text
  Where tm.fromplid = @plid AND tm.tmid = @tmid`;
const REPLY_SQL = `SELECT trm.message, ${d100('trm."date"')} AS "date", trm.trid, trm.adminuser, (trm.image) AS imageurl,
  (CASE WHEN trm.fromtype = 2 THEN 'Me' ELSE 'Support' END) AS fromtype
  FROM tbl_ticketreply trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid = tm.tmid WHERE tm.tmid = @tmid`;
const COUNT_SQL = `SELECT Count(1) FROM tbl_ticketreply trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid = tm.tmid WHERE tm.tmid = @tmid`;

async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Builds the ViewBag/Model of the three ticket views. swallow=true reproduces the try/catch blocks of Index() (errors only logged).
async function loadTicket(req, Ticketid, swallow) {
  const DecryptTicketId = UtilityClass.Decryptword(Ticketid);
  const ViewBag = { TMID: DecryptTicketId };
  let SupportDetailsLi = [];
  let ReplyBindLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    try {
      SupportDetailsLi = mapRows(await query(DB, SUPPORT_SQL, { plid: req.user.plid, tmid: DecryptTicketId }), SUPPORT_PROPS);
    } catch (ExpObj) {
      if (!swallow) throw ExpObj;
      await errInsert(req, 'Index', ExpObj);
    }
  }
  if (Ticketid !== undefined && Ticketid !== null) {
    try {
      ReplyBindLi = mapRows(await query(DB, REPLY_SQL, { tmid: DecryptTicketId }), REPLY_PROPS);
      ViewBag.TotalCountReply = Number(await scalar(DB, COUNT_SQL, { tmid: DecryptTicketId })) || 0;
    } catch (ExpObj) {
      if (!swallow) throw ExpObj;
      await errInsert(req, 'Index', ExpObj);
    }
  }
  ViewBag.ReplyBindLi = ReplyBindLi;
  return { Model: SupportDetailsLi, ViewBag };
}

// Index(string Ticketid)
// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  const { Model, ViewBag } = await loadTicket(req, req.p.Ticketid, true);
  res.json({ view: '~/Views/CustomerPanel/SupportRequest/Index.cshtml', layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml', Model, ViewBag });
}));

// ReferralIndex(string Ticketid) - no session check in the C# but it reads Session["Plid"] => auth
// auth
router.all(`${BASE}/ReferralIndex{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Model, ViewBag } = await loadTicket(req, req.p.Ticketid, false);
  res.json({ view: '~/Views/CustomerPanel/SupportRequest/ReferralSupportRequest.cshtml', Model, ViewBag });
}));

// CustomerIndex(string Ticketid) - no session check in the C# but it reads Session["Plid"] => auth
// auth
router.all(`${BASE}/CustomerIndex{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Model, ViewBag } = await loadTicket(req, req.p.Ticketid, false);
  res.json({ view: '~/Views/CustomerPanel/SupportRequest/CustomerReplay.cshtml', Model, ViewBag });
}));

// PostAReplyOnTicket(string TMID, string Message, string ImgPreviewFirst ... string ImgPreviewTenth)
// (images are never processed by the C#: @IMAGE is always '')
// auth
router.all(`${BASE}/PostAReplyOnTicket{/:id}`, auth, asyncHandler(async (req, res) => {
  let Result = '';
  const Message = req.p.Message;
  if (Message === undefined || Message === null) throw new Error('Object reference not set to an instance of an object.'); // Message.Replace on null
  const tmid = Number(req.p.TMID);
  if (req.p.TMID === undefined || req.p.TMID === null || req.p.TMID === '' || Number.isNaN(tmid)) throw new Error('Input string was not in a correct format.');
  // PORT-NOTE: @INTRESULT OUT is read from the "intresult" column of the single result row
  const rows = await proc(DB, 'sp_ticketreply', {
    tmid, replyfrom: '0', message: String(Message).split('`').join("'"), status: 'Pending', fromtype: '2', image: '',
  });
  const Ret = parseInt(outv(rows[0], 'intresult'), 10);
  if (Ret > 0) Result = 'Ok';
  res.json(Result);
}));

module.exports = router;
