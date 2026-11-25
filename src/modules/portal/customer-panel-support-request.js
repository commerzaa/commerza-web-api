'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SupportRequest.cs (SupportRequestController)
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { masterpageshow, sqlServerDate100: d100, outCol, toDbl, csReplace, ImageUploadMasterMethod } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/SupportRequest';
const SUPPORT_PROPS = ['TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS'];
const REPLY_PROPS = ['MESSAGE', 'DATE', 'TRID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE'];
const STATUS_CASE = "(case when sm.id = 1 then 'PENDING' when sm.id = 0 then 'UNATTENDED' when tm.status = 3 then 'INPROCESS' else 'SOLVED' end) as status";
const REPLY_COLS = `trm.message, ${d100('trm.date')} as date, trm.trid, trm.adminuser, (trm.image) as imageurl,
  (case when trm.fromtype = 2 then 'Me' else 'Support' end) as fromtype`;
// PORT-NOTE: legacy concatenated the decrypted ticket id into the SQL; it is now a bound parameter cast to numeric
// (a non-numeric value still makes the statement fail, as before).

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
router.all([`${P}/Index{/:id}`, P], ps.customerAuth, asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid === undefined ? null : req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const out = { view: '~/Views/CustomerPanel/SupportRequest/Index.cshtml', TMID: DecryptTicketId };
  let SupportDetailsLi = [];
  if (Ticketid != null) {
    try {
      SupportDetailsLi = mapRows(await db.query(DB,
        `select tm.ticketno, tm.categoryname, tm.subject, ${d100('tm.date')} as date, ${d100('tm.lastupdate')} as lastupdate, tm.message, tm.tmimage, ${STATUS_CASE}
           from tbl_ticketmaster tm inner join tbl_statusmaster sm on sm.id = tm.status
          where tm.fromplid = @plid and tm.tmid = @tmid::numeric order by date desc`,
        { plid: Number(req.user.plid), tmid: DecryptTicketId }), SUPPORT_PROPS);
    } catch (e) { /* swallowed as legacy */ }
  }
  let ReplyBindLi = [];
  if (Ticketid != null) {
    try {
      ReplyBindLi = mapRows(await db.query(DB,
        `select ${REPLY_COLS} from tbl_ticketreply trm left outer join tbl_ticketmaster tm on trm.tmid = tm.tmid
          where tm.tmid = @tmid::numeric order by date desc`, { tmid: DecryptTicketId }), REPLY_PROPS);
      out.TotalCountReply = Number(await db.scalar(DB,
        'select count(1) from tbl_ticketreply trm left outer join tbl_ticketmaster tm on trm.tmid = tm.tmid where tm.tmid = @tmid::numeric',
        { tmid: DecryptTicketId })) || 0;
    } catch (e) { /* swallowed as legacy */ }
  }
  out.ReplyBindLi = ReplyBindLi;
  out.Model = SupportDetailsLi;
  res.json(out);
}));

// auth (legacy: no null check, unguarded (Login)Session["Plid"] cast inside `if (Ticketid != null)`)
// route-config: referral/support-request/{Ticketid} -> SupportRequest/ReferralIndex
router.all([`${P}/ReferralIndex{/:id}`, '/portal/referral/support-request{/:Ticketid}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid === undefined ? null : req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const out = { view: '~/Views/CustomerPanel/SupportRequest/ReferralSupportRequest.cshtml', TMID: DecryptTicketId };
  let SupportDetailsLi = [];
  if (Ticketid != null) {
    SupportDetailsLi = mapRows(await db.query(DB,
      `select tm.ticketno, tm.categoryname, tm.subject, ${d100('tm.date')} as date, ${d100('tm.lastupdate')} as lastupdate, tm.message, tm.tmimage, ${STATUS_CASE}
         from tbl_ticketmastermember tm inner join tbl_statusmaster sm on sm.id = tm.status
        where tm.fromplid = @plid and tm.tmid = @tmid::numeric`,
      { plid: Number(req.user.plid), tmid: DecryptTicketId }), SUPPORT_PROPS);
  }
  let ReplyBindLi = [];
  if (Ticketid != null) {
    ReplyBindLi = mapRows(await db.query(DB,
      `select ${REPLY_COLS} from tbl_ticketreply trm left outer join tbl_ticketmastermember tm on trm.tmid = tm.tmid
        where tm.tmid = @tmid::numeric`, { tmid: DecryptTicketId }), REPLY_PROPS);
    out.TotalCountReply = Number(await db.scalar(DB,
      'select count(1) from tbl_ticketreply trm left outer join tbl_ticketmastermember tm on trm.tmid = tm.tmid where tm.tmid = @tmid::numeric',
      { tmid: DecryptTicketId })) || 0;
  }
  out.ReplyBindLi = ReplyBindLi;
  out.Model = SupportDetailsLi;
  res.json(out);
}));

async function customerReplay(req, view) {
  const Ticketid = req.p.Ticketid === undefined ? null : req.p.Ticketid;
  const out = { view, masterpageshow: masterpageshow(req) };
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  out.TMID = DecryptTicketId;
  let SupportDetailsLi = [];
  if (Ticketid != null) {
    SupportDetailsLi = mapRows(await db.query(DB,
      `select tm.ticketno, tm.categoryname, tm.subject, ${d100('tm.date')} as date, ${d100('ttr.date')} as lastupdate, tm.message, tm.tmimage, ${STATUS_CASE},
              coalesce(fromregno, 0) as fromregno
         from tbl_ticketmaster tm inner join tbl_statusmaster sm on sm.id = tm.status left join tbl_ticketreply ttr on ttr.tmid = tm.tmid
        where tm.fromplid = @plid and tm.tmid = @tmid::numeric order by lastupdate desc limit 1`,
      { plid: Number(req.user.plid), tmid: DecryptTicketId }), SUPPORT_PROPS);
  }
  let ReplyBindLi = [];
  if (Ticketid != null) {
    ReplyBindLi = mapRows(await db.query(DB, `select ${REPLY_COLS} from tbl_ticketreply trm where trm.tmid = @tmid::numeric`, { tmid: DecryptTicketId }), REPLY_PROPS);
    out.TotalCountReply = Number(await db.scalar(DB, 'select count(1) from tbl_ticketreply trm where trm.tmid = @tmid::numeric', { tmid: DecryptTicketId })) || 0;
  }
  out.ReplyBindLi = ReplyBindLi;
  out.Model = SupportDetailsLi;
  return out;
}

// auth (legacy: unguarded session cast inside `if (Ticketid != null)`)
// route-config: customer/support-request/{Ticketid} and customer/support-request-Mobile/{Ticketid} -> SupportRequest/CustomerIndex
router.all([`${P}/CustomerIndex{/:id}`, '/portal/customer/support-request{/:Ticketid}', '/portal/customer/support-request-Mobile{/:Ticketid}'],
  ps.customerAuth, asyncHandler(async (req, res) => {
    res.json(await customerReplay(req, '~/Views/CustomerPanel/SupportRequest/CustomerReplay.cshtml'));
  }));

// auth
router.all(`${P}/CustomerIndexMobile{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  res.json(await customerReplay(req, '~/Views/CustomerPanel/SupportRequest/CustomerReplayMobile.cshtml'));
}));

// auth (unguarded session cast)
router.all(`${P}/PostAReplyOnTicket{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Result = '';
  const Plid = Number(req.user.plid);
  const folder = String(config.app.TicketCenterImage || '');
  const imgs = ['ImgPreviewFirst', 'ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth', 'ImgPreviewFifth', 'ImgPreviewSixth',
    'ImgPreviewSeventh', 'ImgPreviewEightth', 'ImgPreviewNineth', 'ImgPreviewTenth'];
  let AllImageName = ImageUploadMasterMethod(p[imgs[0]], folder, String(Plid));
  for (let i = 1; i < imgs.length; i++) {
    const OneByOneImageName = ImageUploadMasterMethod(p[imgs[i]], folder, String(Plid));
    AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
  }
  if (p.Message === undefined || p.Message === null) throw new TypeError('Object reference not set to an instance of an object.');
  const row = await db.procOne(DB, 'sp_ticketreply', {
    tmid: toDbl(p.TMID), replyfrom: '0', message: csReplace(p.Message, '`', "'"), status: 'Pending', fromtype: '2', image: AllImageName,
  });
  // @INTRESULT OUTPUT -> "intresult" column; Convert.ToInt32
  const v = outCol(row, 'intresult');
  const Ret = v === null || v === '' ? 0 : parseInt(v, 10);
  if (Number.isNaN(Ret)) throw new Error('Input string was not in a correct format.');
  if (Ret > 0) Result = 'Ok';
  res.json(Result);
}));

module.exports = router;
