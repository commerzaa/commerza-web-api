'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Dashboard_Helping.cs (DashboardHelpingController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');
const BlockChainAPI = require('../../lib/member/BlockChainAPI');

const router = express.Router();
const DB = 'affiliate';

const GIVE_HELP_PROPS = ['Help_Amount', 'Help_Date', 'Confirm_Amount', 'Status', 'name', 'InvestID', 'Trans_Amount', 'Remain_Amount'];
const GET_HELP_PROPS = ['WDID', 'Trans_Id', 'Date', 'WITHDRAWAMOUNT', 'REMAINAMOUNT', 'Confirm_Date', 'Status', 'PAYBLEAMOUNT', 'TRANSAMOUNT'];
const RECENT_PROPS = ['RowNumber', 'Name', 'RegDate', 'Mobile', 'Email', 'SponserID', 'Active', 'SponserName'];
const NEWS_PROPS = ['Title', 'Descriptions', 'NewDate'];
const HELP_REQ_PROPS = ['HRID', 'FName', 'FEmail', 'FMobile', 'TName', 'TEmail', 'TMobile', 'Amount', 'BTC', 'Create_Date', 'Expire_Date', 'BTC_Address', 'LinkID', 'RequestID',
  'GetID', 'GiveID', 'isHideFrom', 'isHideTo', 'FromRegno', 'ToRegno', 'Status', 'RemainTime', 'RemainTime_From', 'NoOfUnseenMessage', 'StatusImage', 'PaySlip', 'Remark',
  'TLoginID', 'FLoginID', 'str_Create_Date', 'qrcode'];
const MANAGER_PROPS = ['loginid', 'email'];
const POPUP_PROPS = ['SenderOrReciver', 'FromRegNo', 'ToRegNo', 'Status', 'BTC_ADDRESS', 'Btc', 'Remark', 'Image', 'RejectButtonShow', 'InvestId', 'Amount', 'SenderName',
  'SenderEmail', 'SenderSponserName', 'SenderSponserEmail', 'RecieverName', 'RecieverEmail', 'RecieverSponserName', 'RecieverSponserEmail'];
const HELP_HISTORY_PROPS = ['HRID', 'FName', 'FEmail', 'FMobile', 'TName', 'TEmail', 'TMobile', 'Amount', 'BTC', 'Create_Date', 'Expire_Date', 'BTC_Address', 'InvestID',
  'RequestID', 'GetID', 'GiveID', 'isHideFrom', 'isHideTo', 'FromRegno', 'ToRegno', 'Status', 'RemainTime', 'RemainTime_From', 'NoOfUnseenMessage', 'StatusImage', 'PaySlip',
  'Remark', 'TLoginID', 'FLoginID', 'str_Create_Date', 'LinkID', 'PHStatus', 'qrcode'];

const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const outStr = (row, name) => { const v = col(row, name); return v === null ? '' : String(v); };
const npe = () => new Error('Object reference not set to an instance of an object.');

// auth
router.all('/member/DashboardHelping/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const ViewBag = { PLID: Plid };
  const ObjUD = await db.procOne(DB, 'usp_userlogindetails', { plid: Plid });
  if (!ObjUD) throw npe();
  ViewBag.RegDate = ObjUD.regdate;
  ViewBag.LastAccess = ObjUD.lastaccess;
  ViewBag.IPAddress = ObjUD.ipaddress;
  ViewBag.ConfirmAmount = ObjUD.confirmamount;
  ViewBag.TransAmount = ObjUD.transamount;

  ViewBag.GiveHelpDashboardDetails = mapRows(await db.proc(DB, 'usp_givehelpdashboarddetails', { plid: Plid }), GIVE_HELP_PROPS);
  ViewBag.GetHelpDashboardDetails = mapRows(await db.proc(DB, 'usp_gethelpdashboarddetails', { plid: Plid }), GET_HELP_PROPS);

  const Autoregnolist = await db.proc(DB, 'usp_autoregnolist', {});
  // Auto approval of BTC/ETH/LTC/XRP/BCH deposits: background thread in legacy
  Promise.resolve().then(async () => {
    for (const item of Autoregnolist) {
      await CoinPaymentAPI.PaymentAutoClearification(Number(item.regno));
    }
  }).catch((e) => console.error('PaymentAutoClearification', e));

  const checkmanager = await db.queryOne(DB, 'select rankid from member_master where regno = @plid limit 1', { plid: Plid });
  const lr = await db.queryOne(DB, 'select loginid from member_master where plid = @plid limit 1', { plid: Plid });
  const loginid = lr ? lr.loginid : null;
  if (checkmanager && Number(checkmanager.rankid) > 0) {
    // (legacy also ran an unused SELECT EMAILID,LOGINID FROM MEMBER_MASTER WHERE SPONSERID = loginid; result discarded)
    const li = await db.proc(DB, 'usp_directmamagemeber', { loginid });
    ViewBag.managerlist = mapRows(li, MANAGER_PROPS);
  }
  if (!checkmanager) throw npe(); // checkmanager.RANKID
  ViewBag.rankid = checkmanager.rankid;

  ViewBag.RecentJoinUser = mapRows(await db.proc(DB, 'usp_recentjoindetails', {}), RECENT_PROPS);
  ViewBag.NewsDetails = mapRows(await db.proc(DB, 'usp_newsdetailshelping', {}), NEWS_PROPS);
  ViewBag.btrate = await UtilityClass.dollarToBitcoinConvertor(1);
  ViewBag.DashboardHelpRequests = mapRows(await db.proc(DB, 'usp_dashboard_help_requests', { plid: Plid }), HELP_REQ_PROPS);
  res.json({ view: '~/Views/CustomerPanel/Dashboard_Helping/Index.cshtml', ViewBag });
}));

// auth
router.all('/member/DashboardHelping/MYTEAM{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  const s1 = req.p.prefix;
  const lr = await db.queryOne(DB, 'select loginid from member_master where plid = @plid limit 1', { plid: Plid });
  const loginid = lr ? lr.loginid : null;
  const li = await db.proc(DB, 'usp_directmamagemeber', { loginid, team: s1 });
  res.json(mapRows(li, MANAGER_PROPS));
}));

// auth
router.all('/member/DashboardHelping/ShowPopUpDetails{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Plid = Number(req.user.plid);
    const HRID = parseInt(req.p.HRID, 10);
    if (Number.isNaN(HRID)) throw npe();
    const ObjPopUpDetails = await db.procOne(DB, 'usp_helppopupmanagement', { hrid: HRID, regno: Math.trunc(Plid) });
    if (!ObjPopUpDetails) throw npe();
    const o = mapRow(ObjPopUpDetails, POPUP_PROPS);
    o.InvestId = req.p.InvestId === undefined ? null : req.p.InvestId;
    return res.json(o);
  } catch (ex) { /* swallowed in legacy */ }
  return res.json('error');
}));

// auth
router.all('/member/DashboardHelping/UploadPaySlip{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Plid = Number(req.user.plid);
    const HRID = parseInt(req.p.HRID, 10);
    if (Number.isNaN(HRID)) throw npe();
    const HashCode = req.p.HashCode;
    const row = await db.queryOne(DB, "select coalesce(tobtcaddress, '') as tobtcaddress from help_requests where hrid = @hrid limit 1", { hrid: HRID });
    const ToBTCAddress = row ? row.tobtcaddress : null;
    const obj_APIStatus = await BlockChainAPI.GetTransactionStatus(HashCode, ToBTCAddress);

    if (obj_APIStatus === null || obj_APIStatus === undefined) {
      return res.json('Invalid Transaction ID or Hash Code.');
    } else if (String(obj_APIStatus.Status).toLowerCase() !== 'success') {
      return res.json('Invalid Transaction ID or Hash Code.');
    } else if (obj_APIStatus.Toaddress !== ToBTCAddress) {
      return res.json('You have deposit BTC in wrong wallet address.');
    } else {
      // PORT-NOTE: @Message OUT param is read from the result row.
      const out = await db.procOne(DB, 'usp_request_process', {
        hrid: HRID, actionby: 0, sessionregno: Plid, btc: 0.0, btc_address: '', hashcode: HashCode, time: 0, istestmode: true,
      });
      return res.json(outStr(out, 'message'));
    }
  } catch (ex) { /* swallowed in legacy */ }
  return res.json('error');
}));

// auth
router.all('/member/DashboardHelping/confirmPaySlip{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Plid = Number(req.user.plid);
    const HRID = parseInt(req.p.HRID, 10);
    if (Number.isNaN(HRID)) throw npe();
    const out = await db.procOne(DB, 'usp_confirm_request', {
      hrid: HRID, actionby: 0, sessionregno: Plid, btc: 0.0, btc_address: '', hashcode: '', time: 0, istestmode: true,
    });
    return res.json(outStr(out, 'message'));
  } catch (ex) { /* swallowed in legacy */ }
  return res.json('error');
}));

// auth
router.all('/member/DashboardHelping/RequestReject{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const Plid = Number(req.user.plid);
    const HRID = parseInt(req.p.HRID, 10);
    if (Number.isNaN(HRID)) throw npe();
    const out = await db.procOne(DB, 'usp_reject_request', { hrid: HRID, actionby: 0, sessionregno: Plid });
    return res.json(outStr(out, 'message'));
  } catch (ex) { /* swallowed in legacy */ }
  return res.json('error');
}));

// auth
router.all('/member/DashboardHelping/ShowPopUpDetailsGH{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const s = String(req.p.loginid).split('|'); // loginid null => NullReferenceException (swallowed)
    if (req.p.loginid === undefined || req.p.loginid === null) throw npe();
    if (s[1] === undefined) throw new Error('Index was outside the bounds of the array.');
    // PORT-NOTE: the legacy name was "[USP_DASHBOARD_HELP_REQUESTS_popupdata ]" (trailing space inside the brackets).
    const obj = await db.proc(DB, 'usp_dashboard_help_requests_popupdata', { loginid: s[1].toString() });
    return res.json(mapRows(obj, HELP_HISTORY_PROPS));
  } catch (ex) { /* swallowed in legacy */ }
  return res.json('error');
}));

// auth
router.all('/member/DashboardHelping/ExtendTime{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const HRID = parseInt(req.p.HRID, 10);
    if (Number.isNaN(HRID)) throw npe();
    const out = await db.procOne(DB, 'usp_extendtime', { hrid: HRID, typerequest: req.p.Type });
    const v = col(out, 'stringoutput');
    if (v === null) throw npe(); // spOutput.Value.ToString() on a null value
    return res.json(String(v));
  } catch (ex) { /* swallowed in legacy */ }
  return res.json('error');
}));

module.exports = router;
