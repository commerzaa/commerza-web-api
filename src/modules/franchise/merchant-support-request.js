'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\MerchantSupportRequest.cs (MerchantSupportRequestController)
 * Actions: Index, PostAReplyOnTicket (2)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const DATE100 = "to_char(%s,'Mon DD YYYY HH12:MIAM')";

// AddTicketController.ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend)
function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  let RealImageName = '';
  ImageBase64Code = ImageBase64Code === undefined || ImageBase64Code === null ? '' : String(ImageBase64Code);
  if (ImageBase64Code.trim() !== '') {
    let Base64String = ImageBase64Code;
    let Image = String(100000 + Math.floor(Math.random() * 900000));
    Image = Image.trim().split('&amp;').join('And').split('&').join(' And ').replace(/[^\w\d]/g, '').split(' ').join('-');
    RealImageName = `${Image}-${IdForAppend}.jpg`;
    const dir = path.join(config.uploadDir, String(SavePaths || '').replace(/^[~\/\\]+/, ''));
    const full = path.join(dir, RealImageName);
    if (Base64String.includes('base64,')) {
      Base64String = Base64String.substring(Base64String.indexOf(',') + 1);
      const buf = Buffer.from(Base64String, 'base64');
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(full)) fs.unlinkSync(full);
      // PORT-NOTE: System.Drawing re-encode (scale factor 1) replaced by saving the decoded bytes.
      fs.writeFileSync(full, buf);
    } else {
      RealImageName = ImageBase64Code.replace(/^\//, '');
    }
  }
  return RealImageName;
}

// route-config: franchisee/merchant-support-request/{Ticketid}
// auth
router.all(['/franchise/MerchantSupportRequest/Index{/:id}', '/franchise/franchisee/merchant-support-request{/:Ticketid}'], auth, asyncHandler(async (req, res) => {
  const Ticketid = req.p.Ticketid;
  const DecryptTicketId = await UtilityClass.Decryptword(Ticketid);
  const ViewBag = { TMDID: DecryptTicketId };
  let SupportDetailsLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    try {
      SupportDetailsLi = mapRows(await db.query(DB, `Select TM.TMID,TICKETNO,CATEGORYNAME,SUBJECT,
                ${DATE100.replace('%s', 'DATE')} AS DATE,
                ${DATE100.replace('%s', 'LASTUPDATE')} AS LASTUPDATE,Message,TMIMAGE,
                (CASE WHEN SM.ID=1 THEN 'PENDING' WHEN SM.ID=0 THEN 'UNATTENDED' WHEN TM.STATUS=3 THEN 'INPROCESS' ELSE 'SOLVED' END) AS STATUS From
                TBL_TICKETMASTER TM INNER JOIN TBL_STATUSMASTER SM
                ON SM.ID=TM.STATUS Where TM.TMID=@tmid`, { tmid: DecryptTicketId }), ['TMID', 'TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS']);
    } catch (e) { /* swallowed in legacy */ }
  }
  let ReplyBindLi = [];
  if (Ticketid !== undefined && Ticketid !== null) {
    try {
      ReplyBindLi = mapRows(await db.query(DB, `SELECT TRM.MESSAGE,${DATE100.replace('%s', 'TRM.DATE')} AS DATE,TRM.TRMID AS TRID,TRM.ADMINUSER,(IMAGE) AS IMAGEURL,
                (CASE FROMTYPE WHEN 1 THEN 'Admin Support' When 2 Then 'Merchant' When 3 Then 'You' ELSE 'Admin Support' END) As FROMTYPE FROM TBL_TICKETREPLY_MERCHANT TRM
                LEFT OUTER JOIN TBL_TICKETMASTER TM ON TRM.TMID=TM.TMID WHERE TM.TMID=@tmid`, { tmid: DecryptTicketId }), ['MESSAGE', 'DATE', 'TRID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE']);
      ViewBag.TotalCountReply = Number(await db.scalar(DB, `SELECT Count(1) FROM TBL_TICKETREPLY_MERCHANT TRM
                LEFT OUTER JOIN TBL_TICKETMASTER TM ON TRM.TMID=TM.TMID WHERE TM.TMID=@tmid`, { tmid: DecryptTicketId })) || 0;
    } catch (e) { /* swallowed in legacy */ }
  }
  ViewBag.ReplyBindLi = ReplyBindLi;
  res.json({ Model: SupportDetailsLi, Layout: '~/Views/Shared/_DealsRecordNotFoundLayout.cshtml', ViewBag });
}));

// auth
router.all('/franchise/MerchantSupportRequest/PostAReplyOnTicket{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Result = '';
  const Plid = req.user.did;
  const TicketCenterImage = String(config.app.TicketCenterImage || 'TicketCenterImage');
  let AllImageName = ImageUploadMasterMethod(p.ImgPreviewFirst, TicketCenterImage, String(Plid));
  for (const k of ['ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth', 'ImgPreviewFifth', 'ImgPreviewSixth', 'ImgPreviewSeventh', 'ImgPreviewEightth', 'ImgPreviewNineth', 'ImgPreviewTenth']) {
    const OneByOneImageName = ImageUploadMasterMethod(p[k], TicketCenterImage, String(Plid));
    AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
  }
  const r = await db.procOne(DB, 'SP_TICKETREPLY_MERCHANT', {
    TMDID: Number(p.TMDID), REPLYFROM: '3', MESSAGE: String(p.Message).split('`').join("'"), STATUS: 'Pending', FROMTYPE: '3', IMAGE: AllImageName,
  });
  const Ret = parseInt(r ? r.intresult : 0, 10) || 0;
  if (Ret > 0) Result = 'Ok';
  res.json(Result);
}));

module.exports = router;
