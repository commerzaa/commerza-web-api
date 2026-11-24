/** Exports (static, all async): PaymentAutoClearificationBTCNode(RegNo: Int64): string; GetNewAddress(): string; GetBalance(address): string; GetReceivedByAddress(bitcoinaddress, minconf): string; GetTransaction(txid): string; GetTxOut(txid, n, includemempool): string; GetTimestamp(value: Date): string; SendToAddress(WalletAddress, NoofCoin): string */
'use strict';
const { proc } = require('../db');
const { mapRows } = require('../utils/shape');
const { postJson, jsSerialize, jstr, toDecimal } = require('./_http');

const NODE = 'http://bitcoinnode.mlmkabila.in/api/';
const DEOMAN_PROPS = ['TOTALRECEIVEDCOIN', 'TYPEID', 'TCLMID', 'TAAMID', 'COINCODE', 'CONTARCTADDRESS', 'WALLET_ADDRESS', 'BTC_RATE'];

/** POST JSON; on any failure returns the request JSON (legacy swallowed the exception and returned StrPostData). */
async function nodeCall(path, payload) {
  let StrPostData = jsSerialize(payload);
  try {
    StrPostData = await postJson(NODE + path, StrPostData);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

async function PaymentAutoClearificationBTCNode(RegNo) {
  let Received = '', Receivedf = '';
  const Payment_Address = '';
  try {
    const rows = await proc('affiliate', 'usp_adminbtcaddressmanagements_new', {
      btcaddress: '', userid: '', level: '', mode: '6', plid: RegNo, amount: '0.00000000', btcrate: '0.00000000',
      coincode: '', btcamount: '0.00000000', txn_id: '', confirms_needed: '', timeout: '', status_url: '', qrcode_url: '',
    });
    const ObjGetDeomanBalanceDetails = mapRows(rows, DEOMAN_PROPS);
    for (const Items of ObjGetDeomanBalanceDetails) {
      try {
        const APIResponseBalance = await GetReceivedByAddress(Items.WALLET_ADDRESS, '3');
        const ObjWalletManagement = JSON.parse(APIResponseBalance);
        if (jstr(ObjWalletManagement.Flag).toLowerCase() !== 'success') {
          continue;
        } else {
          Received = jstr(ObjWalletManagement.Message);
          Receivedf = Received;
        }
        if (toDecimal(Receivedf) > 0 && Items.WALLET_ADDRESS !== '') {
          await proc('affiliate', 'usp_creditbtcdemonbalance', {
            taamid: Items.TAAMID, transactionid: Payment_Address, qty: toDecimal(Receivedf),
            coincode: Items.COINCODE, received: Received,
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

const GetNewAddress = () => nodeCall('getnewaddress', {});
const GetBalance = (address) => nodeCall('getbalance', { address });
const GetReceivedByAddress = (bitcoinaddress, minconf) => nodeCall('getreceivedbyaddress', { bitcoinaddress, minconf });
const GetTransaction = (txid) => nodeCall('gettransaction', { txid });
const GetTxOut = (txid, n, includemempool) => nodeCall('gettxout', { txid, n, includemempool });

async function GetTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}0`;
}

async function SendToAddress(WalletAddress, NoofCoin) {
  // Convert.ToDecimal(NoofCoin) throws outside the try block in legacy
  return nodeCall('sendtoaddress', { WalletAddress, NoofCoin: toDecimal(NoofCoin) });
}

module.exports = { PaymentAutoClearificationBTCNode, GetNewAddress, GetBalance, GetReceivedByAddress, GetTransaction, GetTxOut, GetTimestamp, SendToAddress };
