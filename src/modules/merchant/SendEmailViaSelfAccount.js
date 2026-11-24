'use strict';
// Ported from Franchise\Controllers\CustomerPanel\SendEmailViaSelfAccount.cs  (database: shopping - Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const P = '/merchant/SendEmailViaSelfAccount';
const upload = multer({ storage: multer.memoryStorage() });

const toInt32 = (s) => { const t = String(s).trim(); if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.'); return parseInt(t, 10); };
const TEMP = (req, k) => sessionStore.get(req, 'TempData.' + k);
const SETTEMP = (req, k, v) => sessionStore.set(req, 'TempData.' + k, v);
const MODEL_PROPS = ['SMID', 'PLID', 'FROMEMAIL', 'TOEMAIL', 'Attachment', 'SENDDATE', 'SUBJECT', 'BODY', 'ISACTIVE', 'ISDELETED', 'MAILTYPE',
  'CampaignName', 'CampaignDate', 'CampaignTime', 'IsMailSend', 'CreatedDate'];

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const GroupName = req.p.GroupName;
  const Plid = parseInt(req.user.plid, 10);
  let LiEmails;
  if (GroupName != null && GroupName !== '') {
    LiEmails = await db.query('shopping',
      'SELECT Lower(EMAIL) as EMAIL from TBL_MEMBER_CUSTOMER_EMAIL WHERE ISDELETED=false AND GroupName=@g AND PLID=@plid', { g: GroupName.trim(), plid: Plid });
  } else {
    LiEmails = await db.query('shopping',
      'SELECT Lower(EMAIL) as EMAIL from TBL_MEMBER_CUSTOMER_EMAIL WHERE ISDELETED=false AND PLID=@plid', { plid: Plid });
  }
  const ViewBag = { EMAIL: mapRows(LiEmails, ['EMAIL']), PLID: Plid, IsPopUpCheck: 1 };
  SETTEMP(req, 'GroupName', GroupName);
  const ObjGroupName = await db.query('shopping', 'Select Distinct GroupName From Tbl_Member_Customer_Email Where PLid = @plid', { plid: String(Plid) });
  ViewBag.GroupName = mapRows(ObjGroupName, ['GroupName']);
  const TempData = { GroupName: GroupName == null ? null : GroupName, Sent: TEMP(req, 'Sent') == null ? null : TEMP(req, 'Sent') };
  SETTEMP(req, 'Sent', null); // TempData is read once
  res.json({ ViewBag, TempData, ...ViewBag });
}));

// auth
router.all(P + '/Edit{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = parseInt(req.user.plid, 10);
  const ViewBag = { PLID: Plid };
  const TECMID = toInt32(await UtilityClass.Decryptword(req.p.id));
  SETTEMP(req, 'TECMID', TECMID);
  const row = await db.queryOne('shopping',
    `Select TECMID,EmailFromTEMID as FromEmail,
            CampaignName,EmailTo as TOEMAIL, to_char(CampaignDate,'DD Mon YYYY') as CampaignDate,left(CampaignTime::text,5) as CampaignTime,Subject,Message as Body from
            Tbl_EmailCampaignMaster Where TECMID = @id limit 1`, { id: TECMID });
  const ModelForEdit = mapRow(row, ['TECMID', 'FromEmail', 'CampaignName', 'TOEMAIL', 'CampaignDate', 'CampaignTime', 'Subject', 'Body']);
  if (ModelForEdit != null) ViewBag.EditCampaign = ModelForEdit;
  const email = await db.query('shopping', 'SELECT Lower(EMAIL) as EMAIL from TBL_MEMBER_CUSTOMER_EMAIL WHERE ISDELETED=false AND PLID=@plid', { plid: Plid });
  ViewBag.EMAIL = mapRows(email, ['EMAIL']);
  res.json({ ViewBag, TempData: { TECMID }, ...ViewBag });
}));

async function SendEmailByApiSettingMethod(EMAILID, PASSWORD, HOSTNAME, ToEmail, SUBJECT, BODY, fileUploader, SenderID, SenderName) {
  return UtilityClass.SendEmailByApiSetting(EMAILID, PASSWORD, HOSTNAME, EMAILID, ToEmail, '', '', SUBJECT, BODY, fileUploader, SenderID, SenderName);
}

// auth
router.post(P + '/SENDNEWEMAIL{/:id}', auth, upload.single('fileUploader'), asyncHandler(async (req, res) => {
  let TECMID = 0;
  let Mode = 1;
  let IsMailSend = '';
  let Filename = '';
  const Plid = parseInt(req.user.plid, 10);
  const fileUploader = req.file || null;
  const MODEL = {
    FROMEMAIL: req.p.FROMEMAIL, TOEMAIL: req.p.TOEMAIL, SUBJECT: req.p.SUBJECT, CampaignName: req.p.CampaignName,
    CampaignDate: req.p.CampaignDate, CampaignTime: req.p.CampaignTime,
  };
  const TOEMAIL = req.p.TOEMAIL;
  const Command = req.p.Command;
  const editor = req.p.editor;
  if (TEMP(req, 'TECMID') != null) {
    TECMID = toInt32(TEMP(req, 'TECMID'));
    Mode = 2;
  }
  if (Command === 'Save Campaign') IsMailSend = '0';
  if (Command === 'Send Email') IsMailSend = '1';
  if (Command === 'Update') IsMailSend = '3';

  if (IsMailSend === '1') {
    const AvailableNoOfCredit = TEMP(req, 'NoOfEmailAvailable') == null ? 0 : toInt32(TEMP(req, 'NoOfEmailAvailable'));
    if (TOEMAIL == null) throw new Error('Object reference not set to an instance of an object.');
    const LengthOfAllEmailId = TOEMAIL.length;
    const NoOfEmailId = (LengthOfAllEmailId - TOEMAIL.split(',').join('').length) + 1;
    if (AvailableNoOfCredit < (LengthOfAllEmailId - NoOfEmailId)) {
      SETTEMP(req, 'Sent', 'You Do Not Have Sufficient Credit For Send This Campaign.');
      const ViewBag = { Message: 'Not Sent', PLID: Plid };
      return res.json({ Model: MODEL, ViewBag, TempData: { Sent: TEMP(req, 'Sent') }, ...ViewBag });
    }
  }

  let success = 's';
  // ModelState.IsValid: FROMEMAIL is an int property
  const modelValid = MODEL.FROMEMAIL != null && /^[+-]?\d+$/.test(String(MODEL.FROMEMAIL).trim());
  if (modelValid) {
    let ToEmail = MODEL.TOEMAIL;
    if (ToEmail != null && ToEmail[0] === ',') ToEmail = ToEmail.substring(1, MODEL.TOEMAIL.length);
    const apiset = mapRow(await db.queryOne('shopping',
      'SELECT EMAILID,PASSWORD,HOSTNAME,SenderID,SenderName,PORT FROM TBL_EMAILMEMBERMASTER WHERE TEMID=@temid limit 1', { temid: toInt32(MODEL.FROMEMAIL) }),
    ['EMAILID', 'PASSWORD', 'HOSTNAME', 'SenderID', 'SenderName', 'PORT']);
    let ViewMessage;
    if (apiset != null) {
      if (IsMailSend === '1') {
        // legacy: background thread, `success` is read before the thread finishes (stays "s")
        setImmediate(() => {
          SendEmailByApiSettingMethod(apiset.EMAILID, apiset.PASSWORD, apiset.HOSTNAME, ToEmail, MODEL.SUBJECT, editor, fileUploader, apiset.SenderID, apiset.SenderName)
            .catch((e) => console.error(e.message));
        });
      } else {
        success = 's';
      }
      if (success != null && success === 's') {
        if (fileUploader != null) {
          Filename = path.basename(fileUploader.originalname);
          const dir = path.join(config.uploadDir, 'attachments');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, Filename), fileUploader.buffer);
        }
        const o = await db.procOne('shopping', 'usp_emailcampaignmaster', {
          PLID: Plid, FROMEMAIL: MODEL.FROMEMAIL, TOEMAIL: MODEL.TOEMAIL, MSGSUBJECT: MODEL.SUBJECT, MESSAGE: editor, ATTACHMENT: Filename,
          MAILTYPE: 1, CampaignName: MODEL.CampaignName, CampaignDate: MODEL.CampaignDate, CampaignTime: MODEL.CampaignTime,
          IsSendEmail: toInt32(IsMailSend), TECMID, Mode,
        });
        const ResValue = toInt32(o && o.intresult != null ? o.intresult : 0);
        if (ResValue === 1) SETTEMP(req, 'Sent', 'Campaign Data Saved Successfully !');
        if (ResValue === 2) SETTEMP(req, 'Sent', 'Email Sent Successfully!');
        if (ResValue === 3) SETTEMP(req, 'Sent', 'Update Successfully !');
        if (ResValue === 4) SETTEMP(req, 'Sent', 'This Campaign Email is Already Sent !');
        else if (ResValue === 0) SETTEMP(req, 'Sent', 'Some Error Occured while updating !');
        if (IsMailSend === '1') {
          ViewMessage = 'Sent';
          SETTEMP(req, 'Sent', 'Email Successfully Sent');
        }
        SETTEMP(req, 'TECMID', null);
      } else {
        SETTEMP(req, 'Sent', 'Some Error Occured While Sending the Email !');
        ViewMessage = 'Not Sent';
      }
    }
    // RedirectToAction("Index")
    return res.json({ redirect: 'SendEmailViaSelfAccount/Index', TempData: { Sent: TEMP(req, 'Sent') }, ViewBag: { Message: ViewMessage } });
  }
  const ViewBag = { PLID: Plid };
  res.json({ Model: MODEL, ViewBag, ...ViewBag });
}));

// auth
router.all(P + '/SendEmailByApiSettingMethod{/:id}', auth, asyncHandler(async (req, res) => {
  const q = req.p;
  const r = await SendEmailByApiSettingMethod(q.EMAILID, q.PASSWORD, q.HOSTNAME, q.ToEmail, q.SUBJECT, q.BODY, null, q.SenderID, q.SenderName);
  res.type('text/plain').send(r == null ? '' : String(r));
}));

module.exports = router;
