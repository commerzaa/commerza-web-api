'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/SupportRequest.cs (SupportRequestController, 4 actions). DB: 'shopping' */
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const { ImageUploadMasterMethod } = require('./add-ticket'); // AddTicketController.ImageUploadMasterMethod

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/SupportRequest';
const SUP = ['TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS', 'FromRegNo'];
const REP = ['MESSAGE', 'DATE', 'TRID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
// CONVERT(VARCHAR(30), col, 100) => "Mon dd yyyy hh:miAM"
const DATE100 = (c) => `to_char(${c}, 'Mon FMDD YYYY FMHH12:MIAM')`;
// SQL Server implicitly converts '' to 0 when compared with an int column
const tid = (v) => (String(v) === '' ? '0' : String(v));

const SUPPORT_SQL = `Select tm.ticketno, categoryname, subject, ${DATE100('tm.date')} AS date, ${DATE100('tm.lastupdate')} AS lastupdate, message, tmimage,
  (CASE WHEN sm.id=1 THEN 'PENDING' WHEN sm.id=0 THEN 'UNATTENDED' WHEN tm.status::int=3 THEN 'INPROCESS' ELSE 'SOLVED' END) AS status`;
const SUPPORT_FROM = `From tbl_ticketmaster tm INNER JOIN tbl_statusmaster sm ON sm.id=tm.status::int Where fromplid = @plid AND tmid = @t::int`;

// route-config: merchant/support-request/{Ticketid} -> Index
// auth
router.all([`${P}/Index{/:id}`, '/merchant/support-request{/:Ticketid}'], auth, asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const out = { TMID: DecryptTicketId };
  let SupportDetailsLi = [];
  const Plid = Number(req.user.plid);
  // PORT-NOTE: legacy concatenated the ticket id into SQL; here it is bound (non-numeric id still raises, like SQL Server).
  const Ticketstatus = await db.scalar(DB, "select coalesce(status::text,'') from tbl_ticketmaster Where fromplid = @plid and tmid = @t::int LIMIT 1", { plid: String(Plid), t: tid(DecryptTicketId) });
  out.Ticketstatus = Ticketstatus === undefined ? null : Ticketstatus;
  if (Ticketid != null) {
    try {
      SupportDetailsLi = await db.query(DB, `${SUPPORT_SQL}, tm.fromregno ${SUPPORT_FROM}`, { plid: String(Plid), t: tid(DecryptTicketId) });
    } catch (e) { /* legacy: swallowed */ }
  }
  let ReplyBindLi = [];
  if (Ticketid != null) {
    try {
      // legacy selects TRM.TRMID (no TRID column) so ReplyBind.TRID stays 0
      ReplyBindLi = await db.query(DB,
        `SELECT trm.message, ${DATE100('trm.date')} AS date, trm.trmid, trm.adminuser, image AS imageurl,
         (Case When fromtype=2 Then 'Me' Else 'Support' End) AS fromtype
         FROM tbl_ticketreply_merchant trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.tmid = @t::int`,
        { t: tid(DecryptTicketId) });
      out.TotalCountReply = Number(await db.scalar(DB,
        'SELECT Count(1) FROM tbl_ticketreply_merchant trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.tmid = @t::int',
        { t: tid(DecryptTicketId) })) || 0;
    } catch (e) { /* legacy: swallowed */ }
  }
  const replies = mapRows(ReplyBindLi, REP).map((r) => ({ ...r, TRID: 0 }));
  res.json({ ...out, ReplyBindLi: replies, Model: mapRows(SupportDetailsLi, SUP), layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml' });
}));

// Referral / Customer variants (no try/catch in legacy). PORT-NOTE: legacy SELECTs TRM.TRID from TBL_TICKETREPLY_MERCHANT, a column that
// table does not have, so with a Ticketid these two actions fail in the legacy app as well (error surfaces as 500).
async function ticketView(req, view) {
  const Ticketid = req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const out = { TMID: DecryptTicketId, view };
  let SupportDetailsLi = [];
  let ReplyBindLi = [];
  if (Ticketid != null) {
    const Plid = Number(req.user.plid);
    SupportDetailsLi = await db.query(DB, `${SUPPORT_SQL} ${SUPPORT_FROM}`, { plid: String(Plid), t: tid(DecryptTicketId) });
  }
  if (Ticketid != null) {
    ReplyBindLi = await db.query(DB,
      `SELECT trm.message, ${DATE100('trm.date')} AS date, trm.trid, trm.adminuser, image AS imageurl,
       (Case When fromtype=2 Then 'Me' Else 'Support' End) AS fromtype
       FROM tbl_ticketreply_merchant trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.tmid = @t::int`,
      { t: tid(DecryptTicketId) });
    out.TotalCountReply = Number(await db.scalar(DB,
      'SELECT Count(1) FROM tbl_ticketreply_merchant trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.tmid = @t::int',
      { t: tid(DecryptTicketId) })) || 0;
  }
  return { ...out, ReplyBindLi: mapRows(ReplyBindLi, REP), Model: mapRows(SupportDetailsLi, SUP.slice(0, 8)) };
}

// auth (legacy had no null check but dereferenced Session["Plid"])
router.all(`${P}/ReferralIndex{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await ticketView(req, '~/Views/SupportRequest/ReferralSupportRequest.cshtml'));
}));

// auth (legacy had no null check but dereferenced Session["Plid"])
router.all(`${P}/CustomerIndex{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await ticketView(req, '~/Views/SupportRequest/CustomerReplay.cshtml'));
}));

// auth
router.all(`${P}/PostAReplyOnTicket{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Result = '';
  const Plid = Number(req.user.plid);
  const folder = String(config.app.TicketCenterImage);
  const names = [p.ImgPreviewFirst, p.ImgPreviewSecond, p.ImgPreviewThird, p.ImgPreviewFourth, p.ImgPreviewFifth,
    p.ImgPreviewSixth, p.ImgPreviewSeventh, p.ImgPreviewEightth, p.ImgPreviewNineth, p.ImgPreviewTenth];
  let AllImageName = ImageUploadMasterMethod(names[0], folder, String(Plid));
  for (let i = 1; i < names.length; i++) {
    const one = ImageUploadMasterMethod(names[i], folder, String(Plid));
    AllImageName = AllImageName + (one !== '' ? ',' : '') + (one === '' ? '' : one);
  }
  if (p.Message === undefined || p.Message === null) throw NRE();
  const rows = await db.proc(DB, 'sp_ticketreply_merchant', {
    tmid: Number(p.TMID), replyfrom: '0', message: String(p.Message).split('`').join("'"), status: 'Pending', fromtype: '2', image: AllImageName,
  });
  // @INTRESULT OUT => 'intresult' column
  const Ret = parseInt(rows.length ? rows[0].intresult : 0, 10) || 0;
  if (Ret > 0) Result = 'Ok';
  res.json(Result);
}));

module.exports = router;
