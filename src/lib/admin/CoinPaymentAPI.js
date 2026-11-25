/** Exports (static, all async; C# `public class CoinPaymentAPI`, MLM Admin, database 'affiliate'):
 *   GETDepositeAddress(CoinCode) : string ; GetBalance(CoinCode) : string ; GetLiveRates(CoinCode) : string
 *   CreateTranstion(CoinCode, FromCurrency, ToCurrency, FromCurrencyAmount) : string ; GetBasicCoinInfo(CoinCode) : string
 *   GetTranstionInformation(CoinCode, TXID) : string ; Withdrawal(FromCurrency, address, FromCurrencyAmount) : string
 *   PaymentAutoClearification(RegNo: Int64) : string
 * Ported from the admin C# (not re-exported from ../CoinPaymentAPI) because:
 *   - Withdrawal differs: 2nd parameter is `address` (JSON key "address", Member/API: "ToCurrency") and the URL is http://localhost:14176/api/Withdrawal
 *   - every catch logs through the ADMIN DataUtility.ErrorInsert (@Panel = "Admin").
 *   All other methods are logically identical to the Member/API C# (same URLs, payloads, procs).
 * Config keys: PublicKey, PrivateKey (AppSettings).
 * PORT-NOTE: on an HTTP failure the legacy code returned StrPostData = the serialized REQUEST body (it was never overwritten); kept.
 */
'use strict';
const config = require('../../config');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { postJson, jsSerialize, jstr, toDecimal, toInt64 } = require('../_http');
const { errorInsert } = require('./_helpers');

const DB = 'affiliate';
const BASE = 'http://coinpayment.mlmkabila.com/api/';
const BTC_PROPS = ['BtcAddress', 'UserId', 'Level', 'BTC', 'Id', 'BTC_RATE', 'COINCODE', 'BTCAMOUNT', 'TXN_ID', 'CONFIRMS_NEEDED', 'TIMEOUT', 'STATUS_URL', 'QRCODE_URL'];

const keys = () => ({ PublicKey: config.app.PublicKey || '', PrivateKey: config.app.PrivateKey || '' });

/** HttpWebRequest POST application/json; on failure ErrorInsert(PROCEDURENAME, "Dal/CoinPaymentAPI") and return the request JSON. */
async function call(url, payload, PROCEDURENAME) {
  let StrPostData = jsSerialize(payload);
  try {
    StrPostData = await postJson(url, StrPostData);
  } catch (ExpObj) {
    await errorInsert(PROCEDURENAME, 'Dal/CoinPaymentAPI', ExpObj);
  }
  return StrPostData;
}

// GETDepositeAddressParam { PublicKey, PrivateKey, CoinName }
const GETDepositeAddress = async (CoinCode) => call(BASE + 'GETDepositeAddress', { ...keys(), CoinName: CoinCode }, 'GETDepositeAddress');
// GetBalanceParam { PublicKey, PrivateKey }
const GetBalance = async (CoinCode) => call(BASE + 'GetBalance', { ...keys() }, 'GetBalance');
const GetLiveRates = async (CoinCode) => call(BASE + 'GetRates', { ...keys() }, 'GetLiveRates');
// CreateTranstionParam { PublicKey, PrivateKey, FromCurrency, ToCurrency, FromCurrencyAmount }
const CreateTranstion = async (CoinCode, FromCurrency, ToCurrency, FromCurrencyAmount) =>
  call(BASE + 'CreateTranstion', { ...keys(), FromCurrency, ToCurrency, FromCurrencyAmount }, 'CreateTranstion');
const GetBasicCoinInfo = async (CoinCode) => call(BASE + 'BasicInfo', { ...keys() }, 'GetBasicCoinInfo');
// GetTranstionInformationParam { PublicKey, PrivateKey, TXID, CommandType = "get_tx_info" }
const GetTranstionInformation = async (CoinCode, TXID) =>
  call(BASE + 'GetTranstionInformation', { ...keys(), TXID, CommandType: 'get_tx_info' }, 'GetTranstionInformation');
// WithdrawalParam { PublicKey, PrivateKey, FromCurrency, address, FromCurrencyAmount } -- admin posts to localhost:14176
const Withdrawal = async (FromCurrency, address, FromCurrencyAmount) =>
  call('http://localhost:14176/api/Withdrawal', { ...keys(), FromCurrency, address, FromCurrencyAmount }, 'Withdrawal');

async function PaymentAutoClearification(RegNo) {
  let Status = '', Status_Text = '', Receivedf = '', Recv_Confirms = '', Payment_Address = '';
  try {
    // [DBO].[USP_ADMINBTCADDRESSMANAGEMENTS] @BtcAddress,@UserId,@Level,@Mode,@StrOutPut Out,@PLID,@AMOUNT,... (@StrOutPut is a result column)
    const rows = await proc(DB, 'usp_adminbtcaddressmanagements', {
      btcaddress: '', userid: '', level: '', mode: '4', plid: RegNo, amount: '0.00000000', btcrate: '0.00000000',
      coincode: '', btcamount: '0.00000000', txn_id: '', confirms_needed: '', timeout: '', status_url: '', qrcode_url: '',
    });
    const ObjGetBTCDetails = mapRows(rows, BTC_PROPS);
    for (const Items of ObjGetBTCDetails) {
      try {
        const Response = await GetTranstionInformation(Items.COINCODE, Items.TXN_ID);
        const ObjWalletManagement = JSON.parse(Response);
        if (jstr(ObjWalletManagement.Flag) !== 'success') {
          continue;
        } else {
          const ObjWalletManagementNew = JSON.parse(jstr(ObjWalletManagement.Message));
          const R = JSON.parse(jstr(ObjWalletManagementNew.result));
          jstr(R.time_created); jstr(R.time_expires); // Time_Created / Time_Expires (unused)
          Status = jstr(R.status);
          Status_Text = jstr(R.status_text);
          jstr(R.type); jstr(R.coin); jstr(R.amount); jstr(R.amountf); jstr(R.received); // unused locals
          Receivedf = jstr(R.receivedf);
          Recv_Confirms = jstr(R.recv_confirms);
          Payment_Address = jstr(R.payment_address);
        }
        if (Status === '100' && Status_Text.toLowerCase() === 'complete'
          && toDecimal(Receivedf) > 0 && toInt64(Recv_Confirms) >= toInt64(Items.CONFIRMS_NEEDED)
          && Payment_Address === Items.BtcAddress && toDecimal(Receivedf) === toDecimal(Items.BTCAMOUNT)) {
          // [USP_EWALLETTOPUPFROMBTCCOIN] @TAGBWAOAID,@TRANSACTIONID,@BTC,@STRRESULT OUT,@COINCODE
          await proc(DB, 'usp_ewallettopupfrombtccoin', {
            tagbwaoaid: Items.Id, transactionid: Items.TXN_ID, btc: toDecimal(Receivedf), coincode: Items.COINCODE,
          });
          continue;
        } else {
          continue;
        }
      } catch (ExpObj) {
        continue;
      }
    }
    return 'success';
  } catch (ExpObj) {
    return ExpObj.message; // legacy returned before its (unreachable) ErrorInsert block
  }
}

module.exports = { GETDepositeAddress, GetBalance, GetLiveRates, CreateTranstion, GetBasicCoinInfo, GetTranstionInformation, Withdrawal, PaymentAutoClearification };
