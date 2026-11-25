'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Ticket_Details.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../../db');
const config = require('../../config');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const P = '/franchise/Ticket_Details';
const SUP = ['TMID', 'TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS', 'FromRegNo'];
const REP = ['MESSAGE', 'DATE', 'TRMID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const DATE100 = (c) => `to_char(${c}, 'Mon FMDD YYYY FMHH12:MIAM')`;

// same helper as AddTicketController.ImageUploadMasterMethod
// PORT-NOTE: GDI+ thumbnail/re-encode skipped; decoded bytes are written unchanged under config.uploadDir/<SavePaths folder>.
function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  if (ImageBase64Code === undefined || ImageBase64Code === null) throw NRE();
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    let Base64String = ImageBase64Code;
    RealImageName = String(Math.floor(Math.random() * 900000) + 100000) + '-' + IdForAppend + '.jpg';
    const dir = path.join(config.uploadDir, String(SavePaths || '').replace(/^~?[\\/]+/, ''));
    const full = path.join(dir, RealImageName);
    if (Base64String.includes('base64,')) {
      Base64String = Base64String.substring(Base64String.indexOf(',') + 1);
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(full)) fs.unlinkSync(full);
      fs.writeFileSync(full, Buffer.from(Base64String, 'base64'));
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

const account = (req) => {
  const a = sessionStore.get(req, 'Account'); // TempData["Account"]
  if (a === undefined || a === null) throw NRE();
  return String(a);
};

// auth (legacy: no session check; TempData["Account"] is read from the server-side store keyed by the JWT subject)
router.all(`${P}/ChangeStatus{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const category = req.p.category;
  const t = await db.scalar('shopping', 'SELECT tmid FROM tbl_ticketmaster WHERE ticketno = @n LIMIT 1', { n: account(req) });
  const Tmid = t === null || t === undefined ? 0 : parseInt(t, 10);
  const rows = await db.proc('shopping', 'usp_changeticketstatus', { TMID: Tmid, CATID: parseInt(category, 10), UID: 0 });
  const ret = parseInt(rows.length ? rows[0].intresult : 0, 10);
  res.json(ret);
}));

// auth (legacy: no session check; TempData["Account"] keyed by JWT subject)
router.all(`${P}/CreateTicket{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { category, message, popupimg } = req.p;
  let imgname = '';
  try {
    if (popupimg.trim() !== '') {
      const count = Number(await db.scalar('shopping', 'SELECT COUNT(1) FROM tbl_ticketreply')) || 0;
      let ProfileImage = ('AddNewImage' + count).trim();
      ProfileImage = ProfileImage.split('&amp;').join('And').split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '').split(' ').join('-');
      imgname = ProfileImage + '.jpg';
      let base64String = popupimg;
      if (base64String.includes('base64,')) base64String = base64String.substring(base64String.indexOf(',') + 1);
      const buf = Buffer.from(base64String, 'base64');
      if (!buf.length) throw new Error('invalid image');
      const dir = path.join(config.uploadDir, String(config.app.TicketCenterImage || '').replace(/^~?[\\/]+/, ''));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, imgname), buf); // PORT-NOTE: image re-encode (scaled copy computed but unused) skipped
    } else {
      imgname = '';
    }
  } catch (ex) {
    imgname = '';
  }
  let msg = '';
  const t = await db.scalar('shopping', 'SELECT tmid FROM tbl_ticketmaster WHERE ticketno = @n LIMIT 1', { n: account(req) });
  const tmid = t === null || t === undefined ? 0 : parseInt(t, 10);
  const rows = await db.proc('shopping', 'sp_ticketreply', {
    TMID: Number(tmid), REPLYFROM: 0, MESSAGE: message, STATUS: category, FROMTYPE: 1, IMAGE: imgname,
  });
  // PORT-NOTE: ExecuteSqlCommand returned rows affected; the function result row count is used (ret == 1 => ok)
  if (rows.length === 1) msg = 'ok';
  res.json(msg);
}));

const indexHandler = asyncHandler(async (req, res) => {
  const TicketNo = req.p.TicketNo;
  const DecryptTicketId = await UtilityClass.Decryptword(TicketNo);
  const out = {};
  const did = Number(req.user.did);
  const tm = await db.scalar('shopping', 'SELECT tmid FROM tbl_ticketmaster WHERE ticketno = @n LIMIT 1', { n: String(DecryptTicketId) });
  out.TMID = tm === null || tm === undefined ? 0 : parseInt(tm, 10);
  let SupportDetailsLi = [];
  const sub = `merchantid In (SELECT plid FROM portal_master WHERE cid IN (SELECT cid FROM distributor_master WHERE plid = @did))`;
  const ts = await db.scalar('shopping', `SELECT coalesce(status::varchar,'') FROM tbl_ticketmaster WHERE ${sub} AND ticketno = @n LIMIT 1`, { did, n: String(DecryptTicketId) });
  out.Ticketstatus = ts === null || ts === undefined ? null : ts;
  if (TicketNo != null) {
    try {
      SupportDetailsLi = await db.query('shopping',
        `Select tm.ticketno, categoryname, subject, ${DATE100('tm.date')} AS date, ${DATE100('tm.lastupdate')} AS lastupdate, message, tmimage,
         (CASE WHEN sm.id=1 THEN 'PENDING' WHEN sm.id=0 THEN 'UNATTENDED' WHEN tm.status=3 THEN 'INPROCESS' ELSE 'SOLVED' END) AS status, tm.fromregno
         From tbl_ticketmaster tm INNER JOIN tbl_statusmaster sm ON sm.id=tm.status Where ${sub} AND tm.ticketno = @n`,
        { did, n: String(DecryptTicketId) });
    } catch (e) { /* legacy: swallowed */ }
  }
  let ReplyBindLi = [];
  if (TicketNo != null) {
    try {
      ReplyBindLi = await db.query('shopping',
        `SELECT trm.message, ${DATE100('trm.date')} AS date, trm.trid AS trmid, trm.adminuser, image AS imageurl,
         (CASE fromtype WHEN 1 THEN 'Admin Support' When 2 Then 'Customer' When 3 Then 'Merchant' When 4 Then 'You' ELSE 'Admin Support' END) AS fromtype
         FROM tbl_ticketreply trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.ticketno = @n`, { n: String(DecryptTicketId) });
      out.TotalCountReply = Number(await db.scalar('shopping',
        `SELECT Count(1) FROM tbl_ticketreply trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.ticketno = @n`, { n: String(DecryptTicketId) })) || 0;
    } catch (e) { /* legacy: swallowed */ }
  }
  res.json({ ...out, ReplyBindLi: mapRows(ReplyBindLi, REP), Model: mapRows(SupportDetailsLi, SUP) });
});
// auth
router.all(`${P}/Index{/:id}`, ...guard, indexHandler);
// route-config
router.all('/franchise/franchisee/Ticket-Details', ...guard, indexHandler);

// auth
router.all(`${P}/PostAReplyOnTicket{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  let Result = '';
  const Plid = Number(req.user.did);
  const folder = String(config.app.TicketCenterImage);
  const names = [p.ImgPreviewFirst, p.ImgPreviewSecond, p.ImgPreviewThird, p.ImgPreviewFourth, p.ImgPreviewFifth,
    p.ImgPreviewSixth, p.ImgPreviewSeventh, p.ImgPreviewEightth, p.ImgPreviewNineth, p.ImgPreviewTenth];
  let AllImageName = ImageUploadMasterMethod(names[0], folder, String(Plid));
  for (let i = 1; i < names.length; i++) {
    const one = ImageUploadMasterMethod(names[i], folder, String(Plid));
    AllImageName = AllImageName + (one !== '' ? ',' : '') + (one === '' ? '' : one);
  }
  if (p.Message === undefined || p.Message === null) throw NRE();
  const rows = await db.proc('shopping', 'sp_ticketreply', {
    TMID: Number(p.TMID), REPLYFROM: '4', MESSAGE: String(p.Message).split('`').join("'"), STATUS: p.Status, FROMTYPE: '4', IMAGE: AllImageName,
  });
  const Ret = parseInt(rows.length ? rows[0].intresult : 0, 10);
  if (Ret > 0) Result = 'Ok';
  res.json(Result);
}));

module.exports = router;
