/**
 * Exports (static class InvictaWalletAPI, all async, return string): GetWalletBalance(WalletName, accesstoken);
 *   DebitWallet(WalletName, Amount: decimal, TrnRefNo, TrnDate, Remarks, accesstoken); CreditWallet(WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken);
 *   CheckPaymentStatus(TrnId, accesstoken)
 * (Merchant version: no GetCoinLiveRate / GetRefreshToken / StandAloneCreditWallet; wallet base URL is hard coded in the C#.)
 * PORT-NOTE: GetWalletBalance catch => returns Exception.Message (WebException text "The remote server returned an error: (401) Unauthorized.").
 * PORT-NOTE: DebitWallet / CreditWallet have an empty catch => on any failure the serialized request JSON (StrPostData) is returned, reproduced.
 * PORT-NOTE: CheckPaymentStatus is a GET with ContentLength = 0 and legacy called GetRequestStream() on it, which throws ProtocolException;
 *   the empty catch swallows it and the legacy always returned "" (empty string); reproduced without making a call.
 * PORT-NOTE: decimal Amount is serialised as a JS number (trailing zeros of a .NET decimal such as 100.50 are not preserved).
 */
'use strict';
const { postJson, jsSerialize, netErrorMessage } = require('../_http');

const WALLET_BASE = 'https://invicta-wallet-core-frontapi-clone-sso.azurewebsites.net/InvictaXWalletApi/api/WalletPayment';

async function GetWalletBalance(WalletName, accesstoken) {
  const BaseURl = WALLET_BASE + '/GetWalletBalance';
  const body = { WalletName, Param1: null, Param2: null, Param3: null, Param4: null, Param5: null };
  let StrPostData = jsSerialize(body);
  try {
    StrPostData = await postJson(BaseURl, StrPostData, { Authorization: 'Bearer ' + accesstoken });
  } catch (objExp) {
    StrPostData = netErrorMessage(objExp);
  }
  return StrPostData;
}

async function _walletTxn(action, WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken) {
  const BaseURl = WALLET_BASE + '/' + action;
  const body = { WalletName, Amount, TrnRefNo, TrnDate, Remarks, CallBackUrl: '', Param2: null, Param3: null, Param4: null, Param5: null };
  let StrPostData = jsSerialize(body);
  try {
    StrPostData = await postJson(BaseURl, StrPostData, { Authorization: 'Bearer ' + accesstoken });
  } catch (e) {
    // empty catch in legacy: StrPostData (the request JSON) is returned
  }
  return StrPostData;
}

async function DebitWallet(WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken) {
  return _walletTxn('DebitWallet', WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken);
}

async function CreditWallet(WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken) {
  return _walletTxn('CreditWallet', WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken);
}

async function CheckPaymentStatus(TrnId, accesstoken) {
  // legacy: GET + GetRequestStream() => ProtocolException => swallowed by empty catch => ""
  return '';
}

module.exports = { GetWalletBalance, DebitWallet, CreditWallet, CheckPaymentStatus };
