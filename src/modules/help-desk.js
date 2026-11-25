'use strict';
/** Port of Controllers/MemberPanelCntrl/HelpDeskController.cs (4 routes). */
const express = require('express');
const multer = require('multer');
const config = require('../config');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { mapRow, mapRows } = require('../utils/shape');
const UtilityClass = require('../lib/UtilityClass');

const router = express.Router();
const formOnly = multer({ storage: multer.memoryStorage() }).none(); // legacy read HttpContext.Request.Form (multipart or urlencoded)

const npe = () => new TypeError('Object reference not set to an instance of an object.');
const badFormat = () => new Error('Input string was not in a correct format.');
const form = (req, k) => {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const key = Object.keys(b).find((x) => x.toLowerCase() === k.toLowerCase());
  return key === undefined || b[key] === undefined ? null : String(b[key]);
};
const toInt = (s) => { // Convert.ToInt32/ToInt64(string)
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw badFormat();
  return Number(t);
};
const intOpt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const str = (v) => (v === undefined ? null : v);
const col = (row, name) => { if (!row) return undefined; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : row[k]; };
const firstCol = (row) => (row ? row[Object.keys(row)[0]] : undefined);
const { query, queryOne, proc, procOne } = require('../db');

// legacy HelpDeskController.SaveImage
async function SaveImage(imgecode) {
  if (imgecode === null || imgecode === undefined) throw npe();
  const OriginalImageFolder = config.app.TicketCenterImage;
  let returnfilename = '';
  for (const items of String(imgecode).split('^')) {
    const IdForAppend = 'TicketImage_Member';
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodECommNew(items, OriginalImageFolder, IdForAppend);
      if (getnewfilename.trim() !== '') {
        returnfilename = returnfilename.trim() === '' ? getnewfilename : returnfilename + '^' + getnewfilename;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      const fn = items.split(/[\\/]/).pop();
      returnfilename = returnfilename.trim() === '' ? fn : returnfilename + '^' + fn;
    }
  }
  return returnfilename;
}

// auth
router.post('/api/CreateTicket', auth, formOnly, asyncHandler(async (req, res) => {
  const plid = form(req, 'plid'), CategoryId = form(req, 'CategoryId'), CategoryName = form(req, 'CategoryName'),
    Subject = form(req, 'Subject'), Message = form(req, 'Message');
  let TicketAllImage = form(req, 'TicketAllImage');
  let Result = '';
  const Plid = toInt(plid);

  if (TicketAllImage === '') {
    TicketAllImage = '';
  } else {
    if (TicketAllImage === null) throw npe();
    TicketAllImage = TicketAllImage.split('NA_TicketImage').join('^');
    TicketAllImage = await SaveImage(TicketAllImage);
  }
  if (CategoryName === null) throw npe();
  const categoryname = CategoryName.split('`').join("'");
  const catid = toInt(CategoryId);
  if (Subject === null) throw npe();
  const subject = Subject.split('`').join("'");
  if (Message === null) throw npe();
  const message = Message.split('`').join("'");

  // SP_CREATEATICKET with OUT params @INTRESULT1, @MEMBEREMAILID, @TICKETID (returned as columns)
  const spRow = await procOne('affiliate', 'sp_createaticket', {
    fromplid: Plid, categoryname, catid, subject, message, image: TicketAllImage,
  });
  const r1 = col(spRow, 'intresult1');
  Result = r1 === null || r1 === undefined ? '' : String(r1);
  const t = col(spRow, 'ticketid');
  const TicketID = t === null || t === undefined ? '' : String(t);
  if (Result === 'Ok') {
    try {
      const Obj = await queryOne('affiliate',
        "Select coalesce(Mobile,'') As Phone, coalesce(EmailID,'') AS EmailID, UserName From MEMBER_MASTER where REGNO = @plid limit 1", { plid: Plid });
      if (Obj) { // (EmailID != "" || EmailID != null) is always true
        const msg = await queryOne('affiliate', 'select * from TBL_SMSACTION where ID = 18 limit 1');
        if (!msg) throw npe();
        const Mobilestatus = msg.sms_send_status;
        const emailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where EID = 15 limit 1');
        if (!emailmsg) throw npe();
        const Emailstatus = emailmsg.email_send_status;
        const TokenMobileMsg = await UtilityClass.FindingSmsContentWithUserIdPassword(Obj.username, msg.sms_content, '', TicketID, 6);
        const TokenEmailMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(Obj.username, emailmsg.email_content, '', TicketID, 7, '');

        if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
          if (Number(Mobilestatus) === 1) {
            // legacy: background thread
            Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(Obj.phone, TokenMobileMsg, '1')).catch((e) => console.error('SendSMSWithAPI', e.message));
          }
        }
        if (Number(Emailstatus) === 1) {
          // legacy: background thread; inner check (EmailID != null || EmailID != "") is always true
          Promise.resolve().then(() => UtilityClass.SendEmailByApiSetting(Obj.username, '', '', '', '', '', Obj.emailid, emailmsg.email_subject, TokenEmailMsg, null, '', ''))
            .catch((e) => console.error('SendEmailByApiSetting', e.message));
        }
      }
    } catch (Exp) {
      Result = Exp.message;
      return res.json({ status: 'false', message: 'error', _error: Exp.message });
    }
  }
  return res.json({ status: 'true', message: Result });
}));

// auth
router.post('/api/TicketList', auth, asyncHandler(async (req, res) => {
  const plid = str(req.p.plid);
  let dynamicpagging = intOpt(req.p.dynamicpagging), page = intOpt(req.p.page);
  let orderbydate = str(req.p.orderbydate), SearchField = str(req.p.SearchField), SearchValue = str(req.p.SearchValue),
    fromDate = str(req.p.fromDate), toDate = str(req.p.toDate), status = str(req.p.status);
  // ddlPlan / ddlcustpage were only defaulted (never used afterwards)
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (status === null) status = '0';
  if (page === null) page = 1;

  const MaxRows = dynamicpagging;
  // USP_ALLTICKET has an @RECORDCOUNT OUT param (TotalRecord was never used in the response)
  const rows = await proc('affiliate', 'usp_allticket', {
    fromdate: fromDate, todate: toDate, status, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    startrowindex: page, maxrows: MaxRows, fromplid: plid, orderbydate,
  });
  const AllTicketListLi = mapRows(rows, ['ROWNUMBER', 'TMID', 'TICKETNO', 'DATE', 'CATEGORYNAME', 'LASTUPDATE', 'SUBJECT', 'STATUS', 'ISREADADMIN', 'ISREADMEM']);
  // legacy also called UtilityClass.GridNumbersPerPage() and discarded the result (not ported - no effect)
  return res.json([{ status: 'true', message: 'success', data: AllTicketListLi }]);
}));

// public (master data)
router.post('/api/TicketCategoryList', asyncHandler(async (req, res) => {
  const rows = await query('affiliate', "select * from categorymaster where status = '1' order by catid");
  const data = mapRows(rows, ['catid', 'categoryname', 'status']);
  return res.json({ status: 'true', message: 'success', data });
}));

// auth
router.post('/api/TicketDetails', auth, asyncHandler(async (req, res) => {
  const Ticketid = str(req.p.Ticketid);
  const DecryptTicketId = Ticketid;
  let SupportDetailsLi = [];
  let ReplyBindLi = [];
  let _TotalCountRelply = null;
  if (Ticketid !== null) {
    SupportDetailsLi = mapRows(await proc('affiliate', 'usp_getticket', { tmid: DecryptTicketId, mode: '1' }),
      ['TICKETNO', 'CATEGORYNAME', 'SUBJECT', 'DATE', 'LASTUPDATE', 'Message', 'TMIMAGE', 'STATUS']);
  }
  if (Ticketid !== null) {
    ReplyBindLi = mapRows(await proc('affiliate', 'usp_getticket', { tmid: DecryptTicketId, mode: '2' }),
      ['MESSAGE', 'DATE', 'TRID', 'ADMINUSER', 'IMAGEURL', 'FROMTYPE']);
    const c = firstCol(await procOne('affiliate', 'usp_getticket', { tmid: DecryptTicketId, mode: '3' }));
    _TotalCountRelply = c === undefined || c === null ? 0 : Number(c); // SqlQuery<Int32>().FirstOrDefault()
  }
  return res.json([{ status: 'true', message: 'success', TotalCountReply: _TotalCountRelply, Support: SupportDetailsLi, ReplyBind: ReplyBindLi }]);
}));

module.exports = router;
