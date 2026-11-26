// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SendEmailViaSelfAccount.cs (SendEmailViaSelfAccountController)
'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, outCol, toInt32, cvtInt32Str, rep, multerAny, background } = require('./_shared/batch-24-common');
const { mapPath } = require('./_shared/batch-02-common');

const router = express.Router();
const P = '/portal/SendEmailViaSelfAccount';
const INDEX_VIEW = '~/Views/CustomerPanel/SendEmailViaSelfAccount/Index.cshtml';
/** Models/SendMailHistory.cs class CustomizedSendMailHistory */
const CSMH_PROPS = ['SMID', 'PLID', 'FROMEMAIL', 'TOEMAIL', 'Attachment', 'SENDDATE', 'SUBJECT', 'BODY', 'ISACTIVE', 'ISDELETED', 'MAILTYPE',
  'CampaignName', 'CampaignDate', 'CampaignTime', 'IsMailSend', 'CreatedDate'];
const nz = (v) => (v === undefined || v === '' ? null : v); // MVC string binding ("" => null)
/** first uploaded file of the given field name (HttpPostedFileBase) */
const fileOf = (req, name) => (req.files || []).find((f) => String(f.fieldname).toLowerCase() === name.toLowerCase()) || null;

/** CustomizedSendMailHistory model binding (DefaultModelBinder): returns { MODEL, errors } */
function bindModel(req) {
  const errors = {};
  const MODEL = {};
  for (const p of CSMH_PROPS) MODEL[p] = null;
  const intProp = (k) => {
    const v = req.p[k];
    if (v === undefined) return 0;
    if (v === null || v === '') { errors[k] = [`The ${k} field is required.`]; return 0; } // non-nullable value type posted empty
    if (!/^\s*[+-]?\d+\s*$/.test(String(v))) { errors[k] = [`The value '${v}' is not valid for ${k}.`]; return 0; }
    return parseInt(v, 10);
  };
  MODEL.SMID = intProp('SMID'); MODEL.PLID = intProp('PLID'); MODEL.FROMEMAIL = intProp('FROMEMAIL');
  MODEL.ISACTIVE = intProp('ISACTIVE'); MODEL.ISDELETED = intProp('ISDELETED'); MODEL.IsMailSend = intProp('IsMailSend');
  for (const k of ['TOEMAIL', 'Attachment', 'SUBJECT', 'BODY', 'MAILTYPE', 'CampaignName', 'CampaignDate', 'CampaignTime']) MODEL[k] = nz(req.p[k]);
  MODEL.SENDDATE = req.p.SENDDATE === undefined ? '0001-01-01T00:00:00' : req.p.SENDDATE;
  MODEL.CreatedDate = req.p.CreatedDate === undefined ? '0001-01-01T00:00:00' : req.p.CreatedDate;
  return { MODEL, errors };
}

// ---------------------------------------------------------------- Index(string GroupName)  [AcceptVerbs(Get | Post)]
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/sendemailviaselfaccount -> SendEmailViaSelfAccount/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/sendemailviaselfaccount{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const GroupName = nz(req.p.GroupName) === undefined ? null : nz(req.p.GroupName);
  const Plid = Number(req.user.plid);
  let LiEmails;
  if (GroupName != null && GroupName !== '') {
    LiEmails = await db.query(DB, 'SELECT lower(email) AS email FROM tbl_member_customer_email WHERE isdeleted::int = 0 AND groupname = @GroupName AND plid = @Plid',
      { GroupName: String(GroupName).trim(), Plid });
  } else {
    LiEmails = await db.query(DB, 'SELECT lower(email) AS email FROM tbl_member_customer_email WHERE isdeleted::int = 0 AND plid = @Plid', { Plid });
  }
  ps.tempDataSet(req, 'GroupName', GroupName);
  //**For Binding the Dropdown for searching On Group Name**//
  const ObjGroupName = await db.query(DB, 'SELECT DISTINCT groupname FROM tbl_member_customer_email WHERE plid = @Plid', { Plid: toInt32(Plid) });
  res.json({
    view: INDEX_VIEW,
    EMAIL: mapRows(LiEmails, ['EMAIL']),
    PLID: toInt32(Plid),
    IsPopUpCheck: 1,
    GroupName: mapRows(ObjGroupName, ['GroupName']),
    // TempData the view reads (Sent is set by SENDNEWEMAIL before its RedirectToAction("Index"))
    TempData: { GroupName, Sent: ps.tempDataGet(req, 'Sent') },
  });
}));

// ---------------------------------------------------------------- Edit(string id)
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`${P}/Edit{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const out = { view: INDEX_VIEW, PLID: toInt32(Plid) };
  const TECMID = toInt32(await UtilityClass.Decryptword(req.p.id === undefined ? null : req.p.id));
  ps.tempDataSet(req, 'TECMID', TECMID);
  const ModelForEdit = await db.queryOne(DB, `SELECT tecmid, emailfromtemid AS fromemail, campaignname, emailto AS toemail,
      to_char(campaigndate, 'DD Mon YYYY') AS campaigndate, left(campaigntime::text, 5) AS campaigntime, subject, message AS body
    FROM tbl_emailcampaignmaster WHERE tecmid = @TECMID LIMIT 1`, { TECMID });
  if (ModelForEdit != null) {
    // SqlQuery<CustomizedSendMailHistory>: unselected members keep their CLR defaults
    const m = mapRow(ModelForEdit, CSMH_PROPS);
    for (const k of ['SMID', 'PLID', 'ISACTIVE', 'ISDELETED', 'IsMailSend']) if (m[k] === null) m[k] = 0;
    for (const k of ['SENDDATE', 'CreatedDate']) if (m[k] === null) m[k] = '0001-01-01T00:00:00';
    m.TECMID = ModelForEdit.tecmid;
    out.EditCampaign = m;
  }
  const email = await db.query(DB, 'SELECT lower(email) AS email FROM tbl_member_customer_email WHERE isdeleted::int = 0 AND plid = @Plid', { Plid });
  out.EMAIL = mapRows(email, ['EMAIL']);
  out.TempData = { TECMID };
  res.json(out);
}));

// ---------------------------------------------------------------- SENDNEWEMAIL(CustomizedSendMailHistory MODEL, HttpPostedFileBase fileUploader, string TOEMAIL, string Command, string editor)
// auth ([HttpPost] [ValidateInput(false)]; unguarded session cast)
router.post(`${P}/SENDNEWEMAIL{/:id}`, ps.customerAuth, multerAny(), asyncHandler(async (req, res) => {
  const { MODEL, errors } = bindModel(req);
  const fileUploader = fileOf(req, 'fileUploader');
  const TOEMAIL = nz(req.p.TOEMAIL) === undefined ? null : nz(req.p.TOEMAIL);
  const Command = nz(req.p.Command) === undefined ? null : nz(req.p.Command);
  const editor = nz(req.p.editor) === undefined ? null : nz(req.p.editor);
  let TECMID = 0;
  let Mode = 1;
  let IsMailSend = '';
  let Filename = '';
  const Plid = Number(req.user.plid);
  const bag = {};
  const tec = ps.tempDataGet(req, 'TECMID');
  if (tec !== null) {
    TECMID = toInt32(tec);
    Mode = 2;
  }
  if (Command === 'Save Campaign') IsMailSend = '0';
  if (Command === 'Send Email') IsMailSend = '1';
  if (Command === 'Update') IsMailSend = '3';

  // #region
  if (IsMailSend === '1') {
    const AvailableNoOfCredit = toInt32(ps.tempDataGet(req, 'NoOfEmailAvailable')); // never written in this app => 0
    if (TOEMAIL === null) throw new TypeError('Object reference not set to an instance of an object.');
    const LengthOfAllEmailId = TOEMAIL.length;
    const NoOfEmailId = (LengthOfAllEmailId - rep(TOEMAIL, ',', '').length) + 1;
    if (AvailableNoOfCredit < (LengthOfAllEmailId - NoOfEmailId)) {
      ps.tempDataSet(req, 'Sent', 'You Do Not Have Sufficient Credit For Send This Campaign.');
      return res.json({ view: INDEX_VIEW, Model: MODEL, Message: 'Not Sent', PLID: toInt32(Plid), TempData: { Sent: ps.tempDataPeek(req, 'Sent') } });
    }
  }
  // #endregion

  let ResValue = 0;
  let success = 's';
  if (Object.keys(errors).length === 0) { // ModelState.IsValid
    let ToEmail = MODEL.TOEMAIL;
    if (ToEmail != null) {
      if (ToEmail.length === 0) throw new RangeError('Index was outside the bounds of the array.'); // ToEmail[0]
      if (ToEmail[0] === ',') ToEmail = ToEmail.substring(1, 1 + MODEL.TOEMAIL.length - 1);
    }
    const apiset = await db.queryOne(DB, 'SELECT emailid, password, hostname, senderid, sendername, port FROM tbl_emailmembermaster WHERE temid = @FROMEMAIL LIMIT 1',
      { FROMEMAIL: MODEL.FROMEMAIL });
    if (apiset != null) {
      if (IsMailSend === '1') {
        // PORT-NOTE: legacy sent on a background Thread and tested `success` right after Start(); the thread practically never
        // finished first, so `success` stayed "s" and the campaign was always saved. Reproduced: fire-and-forget send.
        const subject = MODEL.SUBJECT;
        background(() => SendEmailByApiSettingMethod(apiset.emailid, apiset.password, apiset.hostname, ToEmail, subject, editor, fileUploader,
          apiset.senderid, apiset.sendername));
      } else {
        success = 's';
      }
      if (success != null && success === 's') {
        if (fileUploader != null) {
          Filename = String(fileUploader.originalname);
          Filename = path.win32.basename(fileUploader.originalname); // System.IO.Path.GetFileName
          const dest = mapPath('~/attachments/' + Filename);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, fileUploader.buffer); // fileUploader.SaveAs(Server.MapPath("~/attachments/" + Filename))
        }
        const r = await db.procOne(DB, 'usp_emailcampaignmaster', {
          PLID: Plid,
          FROMEMAIL: MODEL.FROMEMAIL,
          TOEMAIL: MODEL.TOEMAIL,
          MSGSUBJECT: MODEL.SUBJECT,
          MESSAGE: editor,
          ATTACHMENT: Filename,
          MAILTYPE: 1,
          CampaignName: MODEL.CampaignName,
          CampaignDate: MODEL.CampaignDate,
          CampaignTime: MODEL.CampaignTime,
          IsSendEmail: toInt32(IsMailSend),
          TECMID,
          Mode,
        });
        ResValue = cvtInt32Str(outCol(r, 'intresult'));
        if (ResValue === 1) ps.tempDataSet(req, 'Sent', 'Campaign Data Saved Successfully !');
        if (ResValue === 2) ps.tempDataSet(req, 'Sent', 'Email Sent Successfully!');
        if (ResValue === 3) ps.tempDataSet(req, 'Sent', 'Update Successfully !');
        if (ResValue === 4) {
          ps.tempDataSet(req, 'Sent', 'This Campaign Email is Already Sent !');
        } else if (ResValue === 0) {
          ps.tempDataSet(req, 'Sent', 'Some Error Occured while updating !');
        }
        if (IsMailSend === '1') {
          bag.Message = 'Sent';
          ps.tempDataSet(req, 'Sent', 'Email Successfully Sent');
        }
        ps.tempDataSet(req, 'TECMID', null);
      } else {
        ps.tempDataSet(req, 'Sent', 'Some Error Occured While Sending the Email !');
        bag.Message = 'Not Sent';
      }
    }
    // RedirectToAction("Index")
    return res.json({ redirect: '/SendEmailViaSelfAccount/Index', ...bag, TempData: { Sent: ps.tempDataPeek(req, 'Sent') } });
  }
  return res.json({ view: INDEX_VIEW, Model: MODEL, PLID: toInt32(Plid), ModelState: errors });
}));

/** public string SendEmailByApiSettingMethod(...) */
async function SendEmailByApiSettingMethod(EMAILID, PASSWORD, HOSTNAME, ToEmail, SUBJECT, BODY, fileUploader, SenderID, SenderName) {
  const ReturnOutPut = await UtilityClass.SendEmailByApiSetting(EMAILID, PASSWORD, HOSTNAME, EMAILID, ToEmail, '', '', SUBJECT, BODY, fileUploader,
    SenderID, SenderName);
  return ReturnOutPut;
}

// ---------------------------------------------------------------- SendEmailByApiSettingMethod(...) : string  (public method => MVC action)
// auth  PORT-NOTE (security): legacy exposed this helper as an anonymous action (an open SMTP relay with caller-supplied
// credentials); it now requires a customer token. Body/return value unchanged (plain string).
router.all(`${P}/SendEmailByApiSettingMethod{/:id}`, ps.customerAuth, multerAny(), asyncHandler(async (req, res) => {
  const g = (k) => (nz(req.p[k]) === undefined ? null : nz(req.p[k]));
  const r = await SendEmailByApiSettingMethod(g('EMAILID'), g('PASSWORD'), g('HOSTNAME'), g('ToEmail'), g('SUBJECT'), g('BODY'),
    fileOf(req, 'fileUploader'), g('SenderID'), g('SenderName'));
  res.type('text/html').send(r === null || r === undefined ? '' : String(r));
}));

module.exports = router;
