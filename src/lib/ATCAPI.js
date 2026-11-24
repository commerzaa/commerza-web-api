/** Exports (static, all async): GetATCWalletBalance(SentFromUserIDParam, SentFromATCWalletAddress): string; ATCRegistrationOld(Userid): string; ATCRegistration(): string; ATCSendReceived(SentFromUserIDParam, SentToUserIDParam, NoOfCoinsSent): string; ATCTransactionHistory(SentFromUserIDParam): string; ValidateATCWalletAddress(Address): string; MatchATCWalletAddressAndUserId(UserID, Address): string; GetTransactionDetailsByTxID(TxID, UserID): string; BTCPaymentClearification(RegNo: Int64): string */
'use strict';
const { scalar, proc } = require('../db');
const { mapRows } = require('../utils/shape');
const { Decryptword } = require('../utils/crypto');
const { getText, ErrorInsert, jstr, toDecimal } = require('./_http');

const BTC_PROPS = ['BtcAddress', 'UserId', 'Level', 'BTC', 'Id', 'BTC_RATE', 'COINCODE', 'BTCAMOUNT', 'TXN_ID', 'CONFIRMS_NEEDED', 'TIMEOUT', 'STATUS_URL', 'QRCODE_URL'];

// The legacy ATC (coin) API methods were gutted: they only return an empty string.
async function GetATCWalletBalance(SentFromUserIDParam, SentFromATCWalletAddress) {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'GetATCWalletBalance', 'DAL/ATCAPI'); return StrPostData; }
}
async function ATCRegistrationOld(Userid) {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'ATCRegistrationOld', 'DAL/ATCAPI'); return StrPostData; }
}
async function ATCRegistration() {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'ATCRegistration', 'DAL/ATCAPI'); return StrPostData; }
}
async function ATCSendReceived(SentFromUserIDParam, SentToUserIDParam, NoOfCoinsSent) {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'ATCSendReceived', 'DAL/ATCAPI'); return StrPostData; }
}
async function ATCTransactionHistory(SentFromUserIDParam) {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'ATCTransactionHistory', 'DAL/ATCAPI'); return StrPostData; }
}
async function ValidateATCWalletAddress(Address) {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'ValidateATCWalletAddress', 'DAL/ATCAPI'); return StrPostData; }
}
async function MatchATCWalletAddressAndUserId(UserID, Address) {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'MatchATCWalletAddressAndUserId', 'DAL/ATCAPI'); return StrPostData; }
}
async function GetTransactionDetailsByTxID(TxID, UserID) {
  const StrPostData = '';
  try { return StrPostData; } catch (e) { await ErrorInsert(e, 'GetTransactionDetailsByTxID', 'DAL/ATCAPI'); return StrPostData; }
}

async function BTCPaymentClearification(RegNo) {
  try {
    let TransactionId = '';
    let Amount = '0.00000000';
    // @StrOutPut is an OUT parameter in T-SQL; PostgreSQL functions return it as a column, so it is not passed.
    const rows = await proc('affiliate', 'usp_adminbtcaddressmanagements', {
      btcaddress: '', userid: '', level: '', mode: '4', plid: RegNo,
    });
    const ObjGetBTCDetails = mapRows(rows, BTC_PROPS);
    for (const Items of ObjGetBTCDetails) {
      let CheckDecimal = 0;
      let TransactionStatus = '';
      let Confirmations = 0;
      let APIForCall = '';
      try {
        let APIKEY = await scalar('affiliate', "Select coalesce(SECRET_PIN,'') From TBL_PAYMODE WHERE PAYMODE='BTC' limit 1");
        APIKEY = Decryptword(APIKEY);
        APIForCall = 'https://block.io/api/v2/get_transactions/?api_key=' + APIKEY + '&type=received&addresses=' + Decryptword(Items.BtcAddress);
        const Result = await getText(APIForCall);
        const ObjWalletManagement = JSON.parse(Result);
        TransactionStatus = jstr(ObjWalletManagement.status);
        if (TransactionStatus === 'success') {
          jstr(ObjWalletManagement.data.network); // Network (unused)
          const ObjJArray = ObjWalletManagement.data.txs;
          TransactionId = jstr(ObjJArray[0].txid);
          Confirmations = parseInt(jstr(ObjJArray[0].confirmations), 10);
          Amount = jstr(ObjJArray[0].amounts_received[0].amount);
        } else {
          return 'Approval Failed';
        }
        try { CheckDecimal = toDecimal(Amount); } catch (_) { return 'Approval Failed'; }
      } catch (ExpObj) {
        // swallowed in legacy
      }
      if (TransactionStatus === 'success' && TransactionId !== '' && CheckDecimal > 0 && Confirmations >= 3) {
        await proc('affiliate', 'usp_ewallettopupfrombtccoin', {
          tagbwaoaid: Items.Id, transactionid: TransactionId, btc: Amount,
        });
        return TransactionStatus + ' & ' + TransactionId + ' & ' + Amount + ' BTC';
      }
    }
    return 'success' + ' & ' + TransactionId + ' & ' + Amount + ' BTC';
  } catch (ExpObj) {
    return ExpObj.message;
  }
}

module.exports = {
  GetATCWalletBalance, ATCRegistrationOld, ATCRegistration, ATCSendReceived, ATCTransactionHistory,
  ValidateATCWalletAddress, MatchATCWalletAddressAndUserId, GetTransactionDetailsByTxID, BTCPaymentClearification,
};
