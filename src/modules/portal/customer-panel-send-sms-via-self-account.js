'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SendSmsViaSelfAccount.cs (SendSmsViaSelfAccountController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { LIST_ITEMS_SMS, outCol, toLong, csReplace } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/SendSmsViaSelfAccount';
const EDIT_PROPS = ['MSGTYPE', 'TSCMID', 'SmsFromPlid', 'FromMobile', 'CampaignName', 'ToMobile', 'CampaignDate', 'CampaignTime', 'Message'];

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home")); [AcceptVerbs(Get | Post)]
// route-config: merchant/sendsmsviaselfaccount -> SendSmsViaSelfAccount/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/sendsmsviaselfaccount'], ps.customerAuth, asyncHandler(async (req, res) => {
  const GroupName = req.p.GroupName === undefined ? null : req.p.GroupName;
  const Plid = Number(req.user.plid);
  let mobile;
  if (GroupName !== null && GroupName !== '') {
    mobile = await db.query(DB, 'select mobile from tbl_member_customer_mobile where isdeleted::int = 0 and groupname = @g and plid = @plid', { g: String(GroupName).trim(), plid: Plid });
  } else {
    mobile = await db.query(DB, 'select mobile from tbl_member_customer_mobile where isdeleted::int = 0 and plid = @plid', { plid: Plid });
  }
  ps.tempDataSet(req, 'GroupName', GroupName);
  //**For Binding the Dropdown for searching On Group Name**//
  const ObjGroupName = await db.query(DB, 'select distinct groupname from tbl_member_customer_mobile where plid = @p', { p: Math.round(Plid) });
  res.json({
    view: '~/Views/CustomerPanel/SendSmsViaSelfAccount/Index.cshtml',
    MOBILE: mapRows(mobile, ['MOBILE']),
    PLID: Math.round(Plid),
    ListItems: LIST_ITEMS_SMS(),
    IsPopUpCheck: 1,
    GroupName: mapRows(ObjGroupName, ['GroupName']),
    TempData: { GroupName },
  });
}));

// auth (unguarded session cast)
router.all(`${P}/SENDSMS{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const { TOMOBILE, BODY, CampaignName, CampaignDate, CampaignTime, Command } = req.p;
  if (req.p.APITYPE === undefined || req.p.APITYPE === null || req.p.APITYPE === '') {
    throw new Error("The parameters dictionary contains a null entry for parameter 'APITYPE' of non-nullable type 'System.Int32'.");
  }
  const APITYPE = parseInt(req.p.APITYPE, 10);
  let TSCMID = 0; let Mode = 1; let IsSmsSend = ''; let success = 0; let ResValue = 0;
  const Plid = Number(req.user.plid);
  const tsc = ps.tempDataGet(req, 'TSCMID');
  if (tsc !== null) { TSCMID = toLong(tsc); Mode = 2; }
  if (Command === 'Save Campaign') IsSmsSend = '0';
  if (Command === 'Send Sms') IsSmsSend = '1';
  if (Command === 'Update') IsSmsSend = '3';
  if (IsSmsSend === '1') {
    // TempData["NoOfSmsAvailable"] is never written in this app -> 0
    const AvailableNoOfCredit = toLong(ps.tempDataGet(req, 'NoOfSmsAvailable'));
    const LengthOfAllEmailId = TOMOBILE.length;
    const NoOfEmailId = (LengthOfAllEmailId - csReplace(TOMOBILE, ',', '').length) + 1;
    if (AvailableNoOfCredit < (LengthOfAllEmailId - NoOfEmailId)) {
      // ViewBag.Message = "You don't have sufficient credit for the send !";
      ResValue = 7;
      return res.json(ResValue);
    }
  }
  const row = await db.queryOne(DB, 'select sms_api from tbl_smsapisetting where api_type = @t and status::int = 1 and plid = @plid limit 1', { t: APITYPE, plid: Plid });
  let smsapiset = row ? row.sms_api : null;
  if (smsapiset !== null || IsSmsSend !== '1') {
    if (IsSmsSend === '1') {
      smsapiset = csReplace(smsapiset, 'phone=~', 'phone=' + TOMOBILE);
      smsapiset = csReplace(smsapiset, '~', BODY);
      // PORT-NOTE: legacy started the send on a new Thread and read `success` immediately afterwards (race: the thread
      // had practically never finished, so success stayed 0 -> "Not Sent", no campaign row, response 0). Reproduced:
      // the SMS is sent fire-and-forget and `success` is the value at that moment (0).
      const api = smsapiset;
      Promise.resolve().then(() => UtilityClass.SendMsgToMobileWithSelfAccount(api)).catch((e) => console.error('SendMsgToMobileWithSelfAccount', e.message));
      if (success !== 0) ps.tempDataSet(req, 'Sent', 'Sms Successfully Sent');
    } else {
      success = 1;
    }
    if (success > 0) {
      const r = await db.procOne(DB, 'usp_smscampaignmaster', {
        plid: Plid, type: APITYPE, tomobile: TOMOBILE === undefined ? null : TOMOBILE, message: BODY === undefined ? null : BODY,
        campaignname: CampaignName === undefined ? null : CampaignName, campaigndate: CampaignDate === undefined ? null : CampaignDate,
        campaigntime: CampaignTime === undefined ? null : CampaignTime, issendsms: IsSmsSend, tscmid: TSCMID, mode: Mode,
      });
      // @INTRESULT OUT varchar(50) -> Convert.ToInt32
      const v = outCol(r, 'intresult');
      ResValue = parseInt(v === null ? '' : String(v), 10);
      if (Number.isNaN(ResValue)) throw new Error('Input string was not in a correct format.');
      // ViewBag.Message = "Sent";
      ps.tempDataSet(req, 'TSCMID', null);
    } // else ViewBag.Message = "Not Sent";
    return res.json(ResValue);
  }
  // ViewBag.Message = "Sms Api Not Found. Only Saving Of Campaign Allowed!";
  ResValue = 5;
  return res.json(ResValue);
}));

// auth (unguarded session cast)
router.all(`${P}/Edit{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const TSCMID = toLong(await UtilityClass.Decryptword(req.p.id));
  ps.tempDataSet(req, 'TSCMID', TSCMID);
  const m = await db.queryOne(DB,
    `select msgtype, tscmid, smsfromplid, frommobile, campaignname, smsto as tomobile,
            to_char(campaigndate, 'DD Mon YYYY') as campaigndate, left(campaigntime::text, 5) as campaigntime, message
       from tbl_smscampaignmaster where tscmid = @t limit 1`, { t: TSCMID });
  const out = { view: '~/Views/CustomerPanel/SendSmsViaSelfAccount/Index.cshtml' };
  if (m) out.EditCampaignSms = mapRow(m, EDIT_PROPS);
  const mobile = await db.query(DB, 'select lower(mobile) as mobile from tbl_member_customer_mobile where isdeleted::int = 0 and plid = @plid', { plid: Plid });
  out.MOBILE = mapRows(mobile, ['MOBILE']);
  out.ListItems = LIST_ITEMS_SMS();
  out.TempData = { TSCMID };
  res.json(out);
}));

module.exports = router;
