/** Exports (static class BlockChainAPI): async GetTransactionStatus(string HASHKey, string ToBTCAddress) : APIStatus{Status,Network,Txid,Blockhash,Block_no,Confirmations,Time,Toaddress,Value}|null
 *  (Franchise version: URL .../api/v2/tx/BTC/{hash}; Toaddress/Value = LAST output, no address filter) */
'use strict';
const { getText } = require('../_http');

const str = (v) => (v == null ? null : String(v));

async function GetTransactionStatus(HASHKey, ToBTCAddress) {
  try {
    const Obj = { Status: null, Network: null, Txid: null, Blockhash: null, Block_no: null, Confirmations: null, Time: 0, Toaddress: null, Value: 0 };
    const json = await getText('https://chain.so/api/v2/tx/BTC/' + HASHKey);
    const ApiObj = json ? JSON.parse(json) : {}; // empty body => new T() (data null => NullReference => caught)
    if (ApiObj != null) {
      Obj.Status = str(ApiObj.status);
      Obj.Txid = str(ApiObj.data.txid);
      Obj.Network = str(ApiObj.data.network);
      Obj.Blockhash = str(ApiObj.data.blockhash);
      Obj.Block_no = str(ApiObj.data.block_no);
      Obj.Confirmations = str(ApiObj.data.confirmations);
      Obj.Time = parseInt(ApiObj.data.time, 10) || 0;
      const Data = ApiObj.data.outputs;
      for (const Item of Data) {
        Obj.Toaddress = Item.address;
        Obj.Value = Number(Item.value);
      }
    }
    return Obj;
  } catch (e) {
    return null;
  }
}

module.exports = { GetTransactionStatus };
