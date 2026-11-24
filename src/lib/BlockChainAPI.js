/** Exports (static, all async): GetTransactionStatus(HASHKey, ToBTCAddress): APIStatus{Status,Network,Txid,Blockhash,Block_no,Confirmations,Time,Toaddress,Value}|null; dollarToBitcoinConvertor(amount: decimal): number; RupeesToBitcoinConvertor(amount: decimal): number; BitcoinTodollarConvertor(): string */
'use strict';
const config = require('../config');
const { getText } = require('./_http');

const str = (v) => (v == null ? null : String(v)); // Newtonsoft coerces JSON scalars into string properties

async function GetTransactionStatus(HASHKey, ToBTCAddress) {
  try {
    const Obj = { Status: null, Network: null, Txid: null, Blockhash: null, Block_no: null, Confirmations: null, Time: 0, Toaddress: null, Value: 0 };
    const json = await getText('https://chain.so/api/v2/get_tx/BTC/' + HASHKey);
    const ApiObj = json ? JSON.parse(json) : {}; // empty body => new T() (data null => NullReference => caught below)
    if (ApiObj != null) {
      Obj.Status = str(ApiObj.status);
      Obj.Txid = str(ApiObj.data.txid);
      Obj.Network = str(ApiObj.data.network);
      Obj.Blockhash = str(ApiObj.data.blockhash);
      Obj.Block_no = str(ApiObj.data.block_no);
      Obj.Confirmations = str(ApiObj.data.confirmations);
      Obj.Time = parseInt(ApiObj.data.time, 10) || 0;
      const Data = ApiObj.data.outputs;
      for (const item of Data) {
        if (item.address === ToBTCAddress) {
          Obj.Toaddress = item.address;
          Obj.Value = Number(item.value);
        }
      }
    }
    return Obj;
  } catch (e) {
    return null;
  }
}

async function dollarToBitcoinConvertor(amount) {
  const CurrencySymbol = config.app.CurrencySymbol;
  try {
    const str0 = (await getText('https://blockchain.info/tobtc?currency=' + CurrencySymbol + '&value=' + amount + '')).split(/\r?\n/)[0];
    const n = Number(str0.trim());
    if (str0.trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
    return n;
  } catch (ex) {
    return 0;
  }
}

async function RupeesToBitcoinConvertor(amount) {
  try {
    const str0 = (await getText('https://blockchain.info/tobtc?currency=INR&value=' + amount + '')).split(/\r?\n/)[0];
    const n = Number(str0.trim());
    if (str0.trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
    return n;
  } catch (ex) {
    return 0;
  }
}

async function BitcoinTodollarConvertor() {
  try {
    const Result = await getText('https://bitpay.com/api/rates/USD');
    const ObjRateManagement = JSON.parse(Result);
    if (ObjRateManagement.rate === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    return String(ObjRateManagement.rate);
  } catch (ex) {
    return ex.message;
  }
}

module.exports = { GetTransactionStatus, dollarToBitcoinConvertor, RupeesToBitcoinConvertor, BitcoinTodollarConvertor };
