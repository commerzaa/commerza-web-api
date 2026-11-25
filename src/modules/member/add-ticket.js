'use strict';
/** Port of Member/Controllers/CustomerPanel/AddTicket.cs (AddTicketController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { queryOne, procOne } = require('../../db');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }; // System.Threading.Thread replacement
const col = (row, name) => { if (!row) return undefined; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : row[k]; };

// route-config: referral/add-ticket -> ReferralIndex (id optional)
// auth
router.all('/member/AddTicket/Index{/:id}', auth, (req, res) => res.json({ view: '~/Views/CustomerPanel/AddTicket/Index.cshtml' }));
// auth
router.all(['/member/AddTicket/ReferralIndex{/:id}', '/member/referral/add-ticket{/:id}'], auth, (req, res) => res.json({ view: '~/Views/CustomerPanel/AddTicket/ReferralAddTicket.cshtml' }));
// auth
router.all('/member/AddTicket/CustomerIndex{/:id}', auth, (req, res) => res.json({ view: '~/Views/CustomerPanel/AddTicket/CustomerAddTicket.cshtml' }));

/** Legacy public helper SaveImage(imgecode) (not routed): saves '^' separated base64 images, returns '^' separated file names. */
async function SaveImage(imgecode) {
  const OriginalImageFolder = String((config.app && config.app.TicketCenterImage) || '');
  let returnfilename = '';
  const getcolltionimage = imgecode.split('^');
  for (const items of getcolltionimage) {
    const IdForAppend = 'TicketImage_Member';
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodECommNew(items, OriginalImageFolder, IdForAppend);
      if (String(getnewfilename).trim() !== '') {
        if (returnfilename.trim() === '') returnfilename = getnewfilename;
        else returnfilename = returnfilename + '^' + getnewfilename;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      const fileName = items.split(/[\\/]/).pop();
      if (returnfilename.trim() === '') returnfilename = fileName;
      else returnfilename = returnfilename + '^' + fileName;
    }
  }
  return returnfilename;
}

// auth
router.all('/member/AddTicket/GenerateTicket{/:id}', auth, asyncHandler(async (req, res) => {
  const CategoryId = req.p.CategoryId;
  const CategoryName = req.p.CategoryName;
  const Subject = req.p.Subject;
  const Message = req.p.Message;
  let TicketAllImage = req.p.TicketAllImage;
  let Result = '';
  const Plid = Number(req.user.plid);

  if (TicketAllImage === '') {
    TicketAllImage = '';
  } else {
    TicketAllImage = TicketAllImage.replace(/NA_TicketImage/g, '^');
    TicketAllImage = await SaveImage(TicketAllImage);
  }
  const bt = (s) => s.split('`').join("'");
  // PORT-NOTE: @INTRESULT1 / @MEMBEREMAILID / @TICKETID OUT params are returned as columns of the result row.
  const out = await procOne(DB, 'sp_createaticket', {
    fromplid: Plid, categoryname: bt(CategoryName), catid: parseInt(CategoryId, 10), subject: bt(Subject), message: bt(Message), image: TicketAllImage,
  });
  const o1 = col(out, 'intresult1');
  Result = o1 === undefined || o1 === null ? '' : String(o1);
  const t = col(out, 'ticketid');
  const TicketID = t === undefined || t === null ? '' : String(t);
  if (Result === 'Ok') {
    try {
      const Obj = await queryOne(DB, "SELECT COALESCE(mobile,'') AS Phone,COALESCE(emailid,'') AS EmailID,username AS UserName FROM member_master WHERE regno=@plid", { plid: Plid });
      if (Obj) { // Obj != null && (EmailID != "" || EmailID != null) is always true
        const Phone = col(Obj, 'phone');
        const EmailID = col(Obj, 'emailid');
        const UserName = col(Obj, 'username');
        const msg = await queryOne(DB, 'SELECT sms_content,sms_send_status FROM tbl_smsaction WHERE id=18 LIMIT 1');
        const Mobilestatus = msg.sms_send_status; // NullReference => caught below, like the legacy code
        const emailmsg = await queryOne(DB, 'SELECT email_content,email_subject,email_send_status FROM tbl_emailaction WHERE eid=15 LIMIT 1');
        const Emailstatus = emailmsg.email_send_status;
        const TokenMobileMsg = await UtilityClass.FindingSmsContentWithUserIdPassword(UserName, msg.sms_content, '', TicketID, 6);
        const TokenEmailMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(UserName, emailmsg.email_content, '', TicketID, 7, '');

        if (Phone !== null && Phone !== undefined && Phone !== '') {
          if (Mobilestatus === 1) fire(() => UtilityClass.SendSMSWithAPI(Phone, TokenMobileMsg, '1'));
        }
        if (Emailstatus === 1) {
          fire(() => UtilityClass.SendEmailByApiSetting(UserName, '', '', '', '', '', EmailID, emailmsg.email_subject, TokenEmailMsg, null, '', ''));
        }
      }
    } catch (Exp) {
      Result = Exp.message;
      return res.json(Result);
    }
  }
  return res.json(Result);
}));

module.exports = router;
