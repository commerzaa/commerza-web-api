/** Exports (static, all async; C# `public class ATCAPI`, MLM Admin):
 *   GetATCWalletBalance(SentFromUserIDParam, SentFromATCWalletAddress) : string ; ATCRegistrationOld(Userid) : string ; ATCRegistration() : string
 *   ATCSendReceived(SentFromUserIDParam, SentToUserIDParam, NoOfCoinsSent) : string ; ATCTransactionHistory(SentFromUserIDParam) : string
 *   ValidateATCWalletAddress(Address) : string ; MatchATCWalletAddressAndUserId(UserID, Address) : string ; GetTransactionDetailsByTxID(TxID, UserID) : string
 * Ported (not re-exported from ../ATCAPI): the admin C# has NO BTCPaymentClearification (Member/API have it), its catch blocks log
 * ErrorURL "Controllers/DAL/ATCAPI" (Member: "DAL/ATCAPI") with @Panel "Admin". Every method body is `return "";` (gutted legacy API).
 */
'use strict';
const { errorInsert } = require('./_helpers');

const ERRURL = 'Controllers/DAL/ATCAPI';

async function gutted(PROCEDURENAME) {
  const StrPostData = '';
  try {
    return StrPostData;
  } catch (ExpObj) { // unreachable, kept for parity
    await errorInsert(PROCEDURENAME, ERRURL, ExpObj);
    return StrPostData;
  }
}

const GetATCWalletBalance = async (SentFromUserIDParam, SentFromATCWalletAddress) => gutted('GetATCWalletBalance');
const ATCRegistrationOld = async (Userid) => gutted('ATCRegistrationOld');
const ATCRegistration = async () => gutted('ATCRegistration');
const ATCSendReceived = async (SentFromUserIDParam, SentToUserIDParam, NoOfCoinsSent) => gutted('ATCSendReceived');
const ATCTransactionHistory = async (SentFromUserIDParam) => gutted('ATCTransactionHistory');
const ValidateATCWalletAddress = async (Address) => gutted('ValidateATCWalletAddress');
const MatchATCWalletAddressAndUserId = async (UserID, Address) => gutted('MatchATCWalletAddressAndUserId');
const GetTransactionDetailsByTxID = async (TxID, UserID) => gutted('GetTransactionDetailsByTxID');

module.exports = {
  GetATCWalletBalance, ATCRegistrationOld, ATCRegistration, ATCSendReceived, ATCTransactionHistory,
  ValidateATCWalletAddress, MatchATCWalletAddressAndUserId, GetTransactionDetailsByTxID,
};
