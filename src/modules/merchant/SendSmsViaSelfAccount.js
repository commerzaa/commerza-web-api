'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\SendSmsViaSelfAccount.cs (SendSmsViaSelfAccountController) */
const express = require('express');
const { query, queryOne, proc } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const P = '/merchant/SendSmsViaSelfAccount';

const ListItems = () => [{ Text: 'Transactional', Value: '1' }, { Text: 'Promotional', Value: '2' }];

// auth (null session => RedirectToAction("Index","Home")); [AcceptVerbs(Get|Post)]
// route-config: merchant/sendsmsviaselfaccount
router.all([`${P}/Index{/:id}`, '/merchant/sendsmsviaselfaccount'], auth, asyncHandler(async (req, res) => {
  const GroupName = req.p.GroupName;
  const Plid = Number(req.user.plid);
  let mobile;
  if (GroupName !== undefined && GroupName !== null && GroupName !== '') {
    mobile = await query('shopping', 'SELECT MOBILE From TBL_MEMBER_CUSTOMER_MOBILE WHERE ISDELETED=0 AND GroupName=@g AND PLID=@plid', { g: String(GroupName).trim(), plid: Plid });
  } else {
    mobile = await query('shopping', 'SELECT MOBILE From TBL_MEMBER_CUSTOMER_MOBILE WHERE ISDELETED=0 AND PLID=@plid', { plid: Plid });
  }
  sessionStore.set(req, 'GroupName', GroupName === undefined ? null : GroupName); // TempData["GroupName"]
  const ObjGroupName = await query('shopping', 'Select Distinct GroupName From TBL_MEMBER_CUSTOMER_MOBILE Where PLid =@p', { p: parseInt(req.user.plid, 10) });
  res.json({
    MOBILE: mapRows(mobile, ['MOBILE']),
    PLID: Math.round(Plid),
    ListItems: ListItems(),
    IsPopUpCheck: 1,
    GroupName: mapRows(ObjGroupName, ['GroupName']),
    TempData: { GroupName: GroupName === undefined ? null : GroupName },
  });
}));

// auth
router.all(`${P}/SENDSMS{/:id}`, auth, asyncHandler(async (req, res) => {
  const { TOMOBILE, BODY, CampaignName, CampaignDate, CampaignTime, Command } = req.p;
  const APITYPE = parseInt(req.p.APITYPE, 10);
  let TSCMID = 0; let Mode = 1; let IsSmsSend = ''; let success = 0; let ResValue = 0;
  const Plid = Number(req.user.plid);
  const tsc = sessionStore.get(req, 'TSCMID');
  if (tsc !== undefined && tsc !== null) { TSCMID = Number(tsc); Mode = 2; }
  if (Command === 'Save Campaign') IsSmsSend = '0';
  if (Command === 'Send Sms') IsSmsSend = '1';
  if (Command === 'Update') IsSmsSend = '3';
  if (IsSmsSend === '1') {
    const AvailableNoOfCredit = Number(sessionStore.get(req, 'NoOfSmsAvailable') || 0);
    const LengthOfAllEmailId = TOMOBILE.length;
    const NoOfEmailId = (LengthOfAllEmailId - TOMOBILE.replace(/,/g, '').length) + 1;
    if (AvailableNoOfCredit < (LengthOfAllEmailId - NoOfEmailId)) {
      // ViewBag.Message = "You don't have sufficient credit for the send !";
      return res.json(7);
    }
  }
  const row = await queryOne('shopping', 'SELECT sms_api FROM Tbl_SMSAPISETTING WHERE api_type=@t and status=1 and plid=@plid limit 1', { t: APITYPE, plid: Plid });
  let smsapiset = row ? row.sms_api : null;
  if (smsapiset !== null || IsSmsSend !== '1') {
    if (IsSmsSend === '1') {
      smsapiset = smsapiset.replace('phone=~', 'phone=' + TOMOBILE);
      smsapiset = smsapiset.replace('~', BODY);
      // PORT-NOTE: C# ran the send in a Thread and read `success` immediately (race); here the send is awaited so `success` is deterministic.
      success = await UtilityClass.SendMsgToMobileWithSelfAccount(smsapiset);
      if (success !== 0) sessionStore.set(req, 'Sent', 'Sms Successfully Sent'); // TempData["Sent"]
    } else {
      success = 1;
    }
    if (success > 0) {
      const rows = await proc('shopping', 'Usp_SmsCampaignMaster', {
        plid: Plid, type: APITYPE, tomobile: TOMOBILE, message: BODY, campaignname: CampaignName, campaigndate: CampaignDate,
        campaigntime: CampaignTime, issendsms: IsSmsSend, tscmid: TSCMID, mode: Mode,
      });
      ResValue = parseInt((rows[0] || {}).intresult, 10);
      sessionStore.set(req, 'TSCMID', null); // TempData["TSCMID"] = null
    } // else ViewBag.Message = "Not Sent"
    return res.json(ResValue);
  }
  // ViewBag.Message = "Sms Api Not Found. Only Saving Of Campaign Allowed!"
  res.json(5);
}));

// auth
router.all(`${P}/Edit{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const TSCMID = Number(await UtilityClass.Decryptword(req.p.id));
  sessionStore.set(req, 'TSCMID', TSCMID); // TempData["TSCMID"]
  const m = await queryOne('shopping',
    `Select MSGTYPE, TSCMID,SmsFromPlid,FromMobile,
    CampaignName,SmsTo as ToMobile, to_char(CampaignDate,'DD Mon YYYY') as CampaignDate, to_char(CampaignTime,'HH24:MI') as CampaignTime,Message from
    Tbl_SmsCampaignMaster Where TSCMID = @t`, { t: TSCMID });
  const out = {};
  if (m) out.EditCampaignSms = mapRow(m, ['MSGTYPE', 'TSCMID', 'SmsFromPlid', 'FromMobile', 'CampaignName', 'ToMobile', 'CampaignDate', 'CampaignTime', 'Message']);
  const mobile = await query('shopping', 'SELECT Lower(MOBILE) as MOBILE from TBL_MEMBER_CUSTOMER_MOBILE WHERE ISDELETED=0 AND PLID=@plid', { plid: Plid });
  out.MOBILE = mapRows(mobile, ['MOBILE']);
  out.ListItems = ListItems();
  out.TempData = { TSCMID };
  res.json(out);
}));

module.exports = router;
