'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Provide_Help.cs (Provide_HelpController) */
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const { queryOne, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Provide_Help';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e && e.message)); };
const P_NOTES = ['CONDITION', 'CONDITION_VALUE'];
const P_GIVE = ['GiveID', 'InvestID', 'Kid', 'Regno', 'Help_Date', 'Help_Amount', 'Trans_Amount', 'Remain_Amount', 'Status', 'Confirm_Amount', 'Confirm_Date', 'HelpNo', 'Remark'];

// route-config: referral/Provide-Help
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/Provide-Help'], auth, asyncHandler(async (req, res) => {
  const regno = Number(req.user.plid);
  const View_Help = mapRows(await proc(DB, 'usp_getnotesdetails', {}), P_NOTES);
  const ViewBag = { Notes: View_Help };
  const Give_Help = mapRows(await proc(DB, 'details_give_help', { regno }), P_GIVE);
  res.json({ Model: Give_Help, ViewBag });
}));

// auth
router.all(`${P}/ProvideHelp{/:id}`, auth, asyncHandler(async (req, res) => {
  let helpamount = Number(req.p.helpamount);
  const Plid = Number(req.user.plid);
  const out = await procOne(DB, 'usp_providehelp', { plid: Plid, amount: helpamount, packageid: 0 });
  const OutputResult = str(out && out.strresult);
  const OutputResultINVESTID = str(out && out.investid);
  const isauto = Number(await scalar(DB, "select STATUS from TBL_HELPINGSETTINGS where CONDITION_CODE='C0020' limit 1")) || 0;
  const growthpercent = Number(await scalar(DB, "select condition_value from TBL_HELPINGSETTINGS where CONDITION_CODE='C0005' limit 1")) || 0;
  if (isauto === 1) {
    if (OutputResult === 'SUCCESS') {
      helpamount = (helpamount * growthpercent) / 100;
      const myamount = String(helpamount);
      await GenrateAddressImpl(req, OutputResultINVESTID, myamount, req.user.userName || req.user.username, '', '', '');
    }
  }
  res.json(OutputResult);
}));

// Generate BTC address and assign to member. Returns the value the legacy JsonResult carried.
async function GenrateAddressImpl(req, investID, linkAmount, receiverUserName, ProviderUsername, Providermobile, providerLoginid) {
  let PLID = 0;
  const CoinCode = 'BTC';
  const CoinName = 'bitcoin';
  const TotalPayableAmount = linkAmount;
  let resultforadd = '';
  const FromCurrency = str(config.app.Currency);

  const GEtPLID = Number(await scalar(DB, 'select * from usp_getrandom_regno()')) || 0;
  if (GEtPLID === 0) return 'error^Auto Link are not Confirmed !';
  PLID = GEtPLID;
  const mm = await queryOne(DB, 'select * from member_master where regno = @p limit 1', { p: PLID });
  if (!mm) throw NRE();
  ProviderUsername = mm.username;
  Providermobile = mm.emailid;
  providerLoginid = mm.emailid;
  if (PLID === 0) return 'error^Invalid Username!';
  try {
    let GeneratedBtcAddress = ''; let UserId = ''; let Level = ''; let Amount = ''; let Txn_Id = ''; let Confirms_Needed = ''; let Timeout = ''; let Status_Url = ''; let Qrcode_Url = '';
    const UrlForHitforrate = 'https://api.coinmarketcap.com/v1/ticker/' + CoinName + '/?convert=' + config.app.Currency;
    const rr = await axios.get(UrlForHitforrate, { transformResponse: [(d) => d], responseType: 'text' });
    const ObjRateManagement = JSON.parse(rr.data);
    const pu = ObjRateManagement[0].price_usd;
    if (pu === null || pu === undefined || String(pu) === 'null' || String(pu) === '') return 'error';
    const btcrate = String(pu);

    try {
      const Response = await CoinPaymentAPI.CreateTranstion(CoinCode, FromCurrency, CoinCode, TotalPayableAmount);
      const ObjWalletManagement = JSON.parse(Response);
      if (String(ObjWalletManagement.Flag) !== 'success') return 'error';
      const ObjWalletManagementNew = JSON.parse(String(ObjWalletManagement.Message));
      const ObjWalletManagementResult = JSON.parse(String(ObjWalletManagementNew.result));
      GeneratedBtcAddress = String(ObjWalletManagementResult.address);
      UserId = String(ObjWalletManagementResult.address);
      Level = String(ObjWalletManagementResult.address);
      Amount = String(ObjWalletManagementResult.amount);
      Txn_Id = String(ObjWalletManagementResult.txn_id);
      Confirms_Needed = String(ObjWalletManagementResult.confirms_needed);
      Timeout = String(ObjWalletManagementResult.timeout);
      Status_Url = String(ObjWalletManagementResult.status_url);
      Qrcode_Url = String(ObjWalletManagementResult.qrcode_url);
      resultforadd = await CreateBTCLink(investID, linkAmount, receiverUserName, ProviderUsername, Providermobile, providerLoginid, Qrcode_Url, Txn_Id, GeneratedBtcAddress, Amount);
    } catch (ExpObj) {
      return 'error';
    }
    if (resultforadd.toLowerCase() === 'success') {
      const base = {
        btcaddress: GeneratedBtcAddress, userid: UserId, level: Level, plid: PLID, amount: TotalPayableAmount,
        btcrate: Number(btcrate), coincode: CoinCode, btcamount: Amount, txn_id: Txn_Id, confirms_needed: Confirms_Needed,
        timeout: Timeout, status_url: Status_Url, qrcode_url: Qrcode_Url,
      };
      // @StrOutPut is an OUT param (result unused)
      await proc(DB, 'usp_adminbtcaddressmanagements', { ...base, mode: '1' });
      // Mode 2: GetBTCDetails row (result unused by the controller)
      await proc(DB, 'usp_adminbtcaddressmanagements', { ...base, btcaddress: '', userid: '', level: '', mode: '2' });
    }
    return resultforadd.toLowerCase();
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'GenrateAddress', req);
    return ExpObj.message;
  }
}

// auth
router.all(`${P}/GenrateAddress{/:id}`, auth, asyncHandler(async (req, res) => {
  const { investID, linkAmount, receiverUserName, ProviderUsername, Providermobile, providerLoginid } = req.p;
  res.json(await GenrateAddressImpl(req, investID, linkAmount, receiverUserName, ProviderUsername, Providermobile, providerLoginid));
}));

async function CreateBTCLink(investID, linkAmount, receiverUserName, ProviderUsername, Providermobile, providerLoginid, Qrcode_Url, Txn_Id, GeneratedBtcAddress, Amount) {
  let message = '';
  const Row = await procOne(DB, 'usp_giverequest', {
    investid: investID, linkamount: linkAmount, btclinkamount: Amount, receiverusername: ProviderUsername,
    qrcode_url: Qrcode_Url, tranid: Txn_Id, tobtcaddress: GeneratedBtcAddress,
  });
  message = str(Row && Row.message);
  const mm = await queryOne(DB, 'select * from member_master where username = @u limit 1', { u: ProviderUsername });
  if (mm) {
    const SenderSms = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 36 limit 1');
    if (!SenderSms) throw NRE();
    const SenderMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(ProviderUsername, SenderSms.sms_content, '', '', 23);
    const ReciverSms = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 35 limit 1');
    if (!ReciverSms) throw NRE();
    const ReciverMobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(receiverUserName, ReciverSms.sms_content, '', '', 24);
    const SenderEmailAction = await queryOne(DB, 'select * from tbl_emailaction where EID = 31 limit 1');
    if (!SenderEmailAction) throw NRE();
    const SenderEmailSubject = SenderEmailAction.email_subject;
    const SenderDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(ProviderUsername, SenderEmailAction.email_content, '', '', 22, '');
    const ReciverEamilAction = await queryOne(DB, 'select * from tbl_emailaction where EID = 32 limit 1');
    if (!ReciverEamilAction) throw NRE();
    const ReciverEmailSubject = ReciverEamilAction.email_subject;
    const ReciverDynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(mm.username, ReciverEamilAction.email_content, '', '', 23, '');
    if (message === 'success') {
      bg(() => UtilityClass.SendSMSWithAPI(mm.mobile, ReciverMobileSMS, '1'));
      bg(() => UtilityClass.SendSMSWithAPI(Providermobile, SenderMobileSMS, '1'));
      bg(() => UtilityClass.SendEmailByApiSetting(mm.username, '', '', '', '', '', mm.emailid.toLowerCase(), ReciverEmailSubject, ReciverDynamicEmailSms, null));
      bg(() => UtilityClass.SendEmailByApiSetting(ProviderUsername, '', '', '', '', '', providerLoginid.toLowerCase(), SenderEmailSubject, SenderDynamicEmailSms, null));
    }
  }
  return message;
}

// auth
router.all(`${P}/CreateBTCLink{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  res.send(await CreateBTCLink(p.investID, p.linkAmount, p.receiverUserName, p.ProviderUsername, p.Providermobile, p.providerLoginid, p.Qrcode_Url, p.Txn_Id, p.GeneratedBtcAddress, p.Amount));
}));

module.exports = router;
