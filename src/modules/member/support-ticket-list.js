'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/SupportRequest.cs (SupportRequestController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc, query } = require('../../db');
const { mapRows } = require('../../utils/shape');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

// SupportDetails / ReplyBind model classes (declared in comments in this file, defined elsewhere in the project)
const SUPPORT_PROPS = ['TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS'];
const REPLY_PROPS = ['MESSAGE', 'DATE', 'TRID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE'];

// CONVERT(VARCHAR(30),col,100) => 'Mon dd yyyy hh:miAM'
const D100 = (c) => `to_char(${c}, 'Mon DD YYYY HH12:MIAM')`;
const TICKET_SQL = `Select TICKETNO,CATEGORYNAME,SUBJECT,
  ${D100('DATE')} AS DATE,
  ${D100('LASTUPDATE')} AS LASTUPDATE,Message,TMIMAGE,
  (CASE WHEN SM.ID=1 THEN 'PENDING' WHEN SM.ID=0 THEN 'UNATTENDED' WHEN TM.STATUS=3 THEN 'INPROCESS' ELSE 'SOLVED' END) AS STATUS
  From TBL_TICKETMASTER TM INNER JOIN TBL_STATUSMASTER SM ON SM.ID=TM.STATUS Where FROMPLID=@Plid AND TMID=@TMID`;
const REPLY_SQL = `SELECT TRM.MESSAGE,${D100('TRM.DATE')} AS DATE,TRM.TRID,TRM.ADMINUSER,(IMAGE) AS IMAGEURL,
  (Case When FROMTYPE=2 Then 'Me' Else 'Support' End) AS FROMTYPE FROM TBL_TICKETREPLY TRM
  LEFT OUTER JOIN TBL_TICKETMASTER TM ON TRM.TMID=TM.TMID WHERE TM.TMID=@TMID`;
const COUNT_SQL = `SELECT Count(1) AS cnt FROM TBL_TICKETREPLY TRM
  LEFT OUTER JOIN TBL_TICKETMASTER TM ON TRM.TMID=TM.TMID WHERE TM.TMID=@TMID`;
const firstValue = (rows) => {
  const f = rows && rows[0];
  if (!f) return 0;
  const v = Object.values(f)[0];
  return v === null || v === undefined ? 0 : Number(v);
};
async function errInsert(req, e, name) {
  console.error(e);
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (e2) { console.error(e2); }
}

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all('/member/SupportRequest/Index{/:Ticketid}', auth, asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const ViewBag = { TMID: DecryptTicketId };
  let SupportDetailsLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    try {
      SupportDetailsLi = mapRows(await query(DB, TICKET_SQL, { Plid: Number(req.user.plid), TMID: DecryptTicketId }), SUPPORT_PROPS);
    } catch (e) {
      await errInsert(req, e, 'Index');
    }
  }
  let ReplyBindLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    try {
      ReplyBindLi = mapRows(await query(DB, REPLY_SQL, { TMID: DecryptTicketId }), REPLY_PROPS);
      const c = await query(DB, COUNT_SQL, { TMID: DecryptTicketId });
      ViewBag.TotalCountReply = firstValue(c);
    } catch (e) {
      await errInsert(req, e, 'Index');
    }
  }
  ViewBag.ReplyBindLi = ReplyBindLi;
  return res.json({
    view: '~/Views/CustomerPanel/SupportRequest/Index.cshtml', Layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml', Model: SupportDetailsLi, ViewBag,
  });
}));

// ---- ReferralIndex -------------------------------------------------------------------------------------
// route-config: referral/support-request/{Ticketid}  (SupportRequest / ReferralIndex)
// auth (legacy had no session check but it shows a logged-in member's ticket)
router.all(['/member/SupportRequest/ReferralIndex{/:Ticketid}', '/member/referral/support-request{/:Ticketid}'], auth, asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const ViewBag = { TMID: DecryptTicketId };
  let SupportDetailsLi = [];
  let ReplyBindLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    SupportDetailsLi = mapRows(await proc(DB, 'usp_getticket', { tmid: DecryptTicketId, mode: '1' }), SUPPORT_PROPS);
  }
  if (Ticketid !== undefined && Ticketid !== null) {
    ReplyBindLi = mapRows(await proc(DB, 'usp_getticket', { tmid: DecryptTicketId, mode: '2' }), REPLY_PROPS);
    ViewBag.TotalCountReply = firstValue(await proc(DB, 'usp_getticket', { tmid: DecryptTicketId, mode: '3' }));
  }
  ViewBag.ReplyBindLi = ReplyBindLi;
  return res.json({ view: '~/Views/CustomerPanel/SupportRequest/ReferralSupportRequest.cshtml', Model: SupportDetailsLi, ViewBag });
}));

// ---- CustomerIndex -------------------------------------------------------------------------------------
// auth
router.all('/member/SupportRequest/CustomerIndex{/:Ticketid}', auth, asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const ViewBag = { TMID: DecryptTicketId };
  let SupportDetailsLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    SupportDetailsLi = mapRows(await query(DB, TICKET_SQL, { Plid: Number(req.user.plid), TMID: DecryptTicketId }), SUPPORT_PROPS);
  }
  let ReplyBindLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    ReplyBindLi = mapRows(await query(DB, REPLY_SQL, { TMID: DecryptTicketId }), REPLY_PROPS);
    ViewBag.TotalCountReply = firstValue(await query(DB, COUNT_SQL, { TMID: DecryptTicketId }));
  }
  ViewBag.ReplyBindLi = ReplyBindLi;
  return res.json({ view: '~/Views/CustomerPanel/SupportRequest/CustomerReplay.cshtml', Model: SupportDetailsLi, ViewBag });
}));

// SaveImage (public C# method; also exposed as an action, returns the file-name string)
async function SaveImage(imgecode) {
  const OriginalImageFolder = String(config.app.TicketCenterImage || '');
  let returnfilename = '';
  const getcolltionimage = String(imgecode).split('^');
  for (const items of getcolltionimage) {
    const IdForAppend = 'TicketImage_MemberReply';
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodECommNew(items, OriginalImageFolder, IdForAppend);
      if (String(getnewfilename).trim() !== '') {
        returnfilename = returnfilename.trim() === '' ? getnewfilename : `${returnfilename}^${getnewfilename}`;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      // System.IO.Path.GetFileName
      const fn = items.split(/[\\/]/).pop();
      returnfilename = returnfilename.trim() === '' ? fn : `${returnfilename}^${fn}`;
    }
  }
  return returnfilename;
}

// ---- PostAReplyOnTicket --------------------------------------------------------------------------------
// auth
router.all('/member/SupportRequest/PostAReplyOnTicket{/:id}', auth, asyncHandler(async (req, res) => {
  const { TMID, Message } = req.p;
  let TicketMemberReplyImg = req.p.TicketMemberReplyImg;
  let Result = '';
  if (TicketMemberReplyImg === '') {
    TicketMemberReplyImg = '';
  } else {
    TicketMemberReplyImg = String(TicketMemberReplyImg).replace(/NA_TicketImage/g, '^');
    TicketMemberReplyImg = await SaveImage(TicketMemberReplyImg);
  }
  const tm = Number(TMID);
  if (TMID === undefined || TMID === null || Number.isNaN(tm)) throw new Error('Input string was not in a correct format.');
  // PORT-NOTE: @INTRESULT OUT is read from the first result row (column intresult).
  const rows = await proc(DB, 'sp_ticketreply', {
    tmid: tm, replyfrom: '0', message: String(Message).replace(/`/g, "'"), status: 'Pending', fromtype: '2', image: TicketMemberReplyImg,
  });
  const f = rows && rows[0];
  const k = f ? Object.keys(f).find((x) => x.toLowerCase() === 'intresult') : undefined;
  const Ret = k === undefined ? 0 : (parseInt(f[k], 10) || 0);
  if (Ret > 0) Result = 'Ok';
  return res.json(Result);
}));

// ---- SaveImage -----------------------------------------------------------------------------------------
// auth (public method on the controller => reachable action; returns a plain string)
router.all('/member/SupportRequest/SaveImage{/:id}', auth, asyncHandler(async (req, res) => {
  const out = await SaveImage(req.p.imgecode);
  return res.type('text/plain').send(out);
}));

module.exports = router;
