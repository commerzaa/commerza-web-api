'use strict';
// Ported from Franchise\Controllers\CustomerPanel\SupportRequest.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../../db');
const config = require('../../config');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const P = '/franchise/SupportRequest';
const SUP = ['TMID', 'TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS'];
const REP = ['MESSAGE', 'DATE', 'TRID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// AddTicketController.ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend)
// PORT-NOTE: GDI+ thumbnail/re-encode skipped; decoded bytes are written unchanged (as .jpg name) under config.uploadDir/<SavePaths folder>.
function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  if (ImageBase64Code === undefined || ImageBase64Code === null) throw NRE();
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    let Base64String = ImageBase64Code;
    const Image = String(Math.floor(Math.random() * 900000) + 100000);
    RealImageName = Image + '-' + IdForAppend + '.jpg';
    const dir = path.join(config.uploadDir, String(SavePaths || '').replace(/^~?[\\/]+/, ''));
    const full = path.join(dir, RealImageName);
    if (Base64String.includes('base64,')) {
      Base64String = Base64String.substring(Base64String.indexOf(',') + 1);
      const buf = Buffer.from(Base64String, 'base64');
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(full)) fs.unlinkSync(full);
      fs.writeFileSync(full, buf);
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

const DATE100 = (c) => `to_char(${c}, 'Mon FMDD YYYY FMHH12:MIAM')`;

const indexHandler = asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const out = { TMDID: DecryptTicketId };
  let SupportDetailsLi = [];
  const DID = Number(req.user.did);
  if (Ticketid != null) {
    try {
      SupportDetailsLi = await db.query('shopping',
        `Select tm.ticketno, categoryname, subject, ${DATE100('tm.date')} AS date, ${DATE100('tm.lastupdate')} AS lastupdate, message, tmimage,
         (CASE WHEN sm.id=1 THEN 'PENDING' WHEN sm.id=0 THEN 'UNATTENDED' WHEN tm.status=3 THEN 'INPROCESS' ELSE 'SOLVED' END) AS status
         From tbl_ticketmaster tm INNER JOIN tbl_statusmaster sm ON sm.id=tm.status Where fromplid = @did AND tmid = @t::bigint`,
        { did: DID, t: String(DecryptTicketId) });
    } catch (e) { /* legacy: swallowed */ }
  }
  let ReplyBindLi = [];
  if (Ticketid != null) {
    try {
      ReplyBindLi = await db.query('shopping',
        `SELECT trm.message, ${DATE100('trm.date')} AS date, trm.trid AS trid, trm.adminuser, image AS imageurl,
         (Case When fromtype=2 Then 'Me' Else 'Support' End) AS fromtype
         FROM tbl_ticketreply_distributor trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.tmid = @t::bigint`,
        { t: String(DecryptTicketId) });
      out.TotalCountReply = Number(await db.scalar('shopping',
        `SELECT Count(1) FROM tbl_ticketreply_distributor trm LEFT OUTER JOIN tbl_ticketmaster tm ON trm.tmid=tm.tmid WHERE tm.tmid = @t::bigint`,
        { t: String(DecryptTicketId) })) || 0;
    } catch (e) { /* legacy: swallowed */ }
  }
  res.json({ ...out, ReplyBindLi: mapRows(ReplyBindLi, REP), Model: mapRows(SupportDetailsLi, SUP) });
});

// auth
router.all(`${P}/Index{/:id}`, ...guard, indexHandler);
// route-config
router.all('/franchise/franchisee/support-request{/:Ticketid}', ...guard, indexHandler);

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
  const rows = await db.proc('shopping', 'sp_ticketreply_reseller', {
    TMDID: Number(p.TMDID), REPLYFROM: '2', MESSAGE: String(p.Message).split('`').join("'"), STATUS: 'Pending',
    FROMTYPE: '2', IMAGE: AllImageName,
  });
  // @INTRESULT OUT => 'intresult' column
  const Ret = parseInt(rows.length ? rows[0].intresult : 0, 10);
  if (Ret > 0) Result = 'Ok';
  res.json(Result);
}));

module.exports = router;
module.exports.ImageUploadMasterMethod = ImageUploadMasterMethod;
