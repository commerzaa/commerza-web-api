/** Exports (static, all async): GETDepositeAddress(CoinCode): string; GetBalance(CoinCode): string; GetLiveRates(CoinCode): string; CreateTranstion(CoinCode, FromCurrency, ToCurrency, FromCurrencyAmount): string; GetBasicCoinInfo(CoinCode): string; GetTranstionInformation(CoinCode, TXID): string; Withdrawal(FromCurrency, ToCurrency, FromCurrencyAmount): string; PaymentAutoClearification(RegNo: Int64): string */
'use strict';
const config = require('../config');
const { proc } = require('../db');
const { mapRows } = require('../utils/shape');
const { postJson, jsSerialize, ErrorInsert, jstr, toDecimal, toInt64 } = require('./_http');

const BASE = 'http://coinpayment.mlmkabila.com/api/';
const BTC_PROPS = ['BtcAddress', 'UserId', 'Level', 'BTC', 'Id', 'BTC_RATE', 'COINCODE', 'BTCAMOUNT', 'TXN_ID', 'CONFIRMS_NEEDED', 'TIMEOUT', 'STATUS_URL', 'QRCODE_URL'];

const keys = () => ({ PublicKey: config.app.PublicKey, PrivateKey: config.app.PrivateKey });

/** POST JSON. On failure: ErrorInsert, then return the request JSON (legacy returned StrPostData = request body). */
async function call(path, payload, procName) {
  let StrPostData = jsSerialize(payload);
  try {
    StrPostData = await postJson(BASE + path, StrPostData);
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, procName, 'Dal/CoinPaymentAPI');
  }
  return StrPostData;
}

const GETDepositeAddress = (CoinCode) => call('GETDepositeAddress', { ...keys(), CoinName: CoinCode }, 'GETDepositeAddress');
const GetBalance = (CoinCode) => call('GetBalance', { ...keys() }, 'GetBalance');
const GetLiveRates = (CoinCode) => call('GetRates', { ...keys() }, 'GetLiveRates');
const CreateTranstion = (CoinCode, FromCurrency, ToCurrency, FromCurrencyAmount) =>
  call('CreateTranstion', { ...keys(), FromCurrency, ToCurrency, FromCurrencyAmount }, 'CreateTranstion');
const GetBasicCoinInfo = (CoinCode) => call('BasicInfo', { ...keys() }, 'GetBasicCoinInfo');
const GetTranstionInformation = (CoinCode, TXID) =>
  call('GetTranstionInformation', { ...keys(), TXID, CommandType: 'get_tx_info' }, 'GetTranstionInformation');
const Withdrawal = (FromCurrency, ToCurrency, FromCurrencyAmount) =>
  call('Withdrawal', { ...keys(), FromCurrency, ToCurrency, FromCurrencyAmount }, 'Withdrawal');

async function PaymentAutoClearification(RegNo) {
  let Status = '', Status_Text = '', Receivedf = '', Recv_Confirms = '', Payment_Address = '';
  try {
    const rows = await proc('affiliate', 'usp_adminbtcaddressmanagements', {
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
          jstr(R.time_created); jstr(R.time_expires);
          Status = jstr(R.status);
          Status_Text = jstr(R.status_text);
          jstr(R.type); jstr(R.coin); jstr(R.amount); jstr(R.amountf);
          jstr(R.received);
          Receivedf = jstr(R.receivedf);
          Recv_Confirms = jstr(R.recv_confirms);
          Payment_Address = jstr(R.payment_address);
        }
        if (Status === '100' && Status_Text.toLowerCase() === 'complete'
          && toDecimal(Receivedf) > 0 && toInt64(Recv_Confirms) >= toInt64(Items.CONFIRMS_NEEDED)
          && Payment_Address === Items.BtcAddress && toDecimal(Receivedf) === toDecimal(Items.BTCAMOUNT)) {
          await proc('affiliate', 'usp_ewallettopupfrombtccoin', {
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
    return ExpObj.message;
  }
}

module.exports = { GETDepositeAddress, GetBalance, GetLiveRates, CreateTranstion, GetBasicCoinInfo, GetTranstionInformation, Withdrawal, PaymentAutoClearification };
