/** Exports: same as ../member/BitCoinCoreDaemon (=> ../BitCoinCoreDaemon), static, all async:
 *   PaymentAutoClearificationBTCNode(RegNo: Int64) : string ; GetNewAddress() : string ; GetBalance(address) : string
 *   GetReceivedByAddress(bitcoinaddress, minconf) : string ; GetTransaction(txid) : string ; GetTxOut(txid, n, includemempool) : string
 *   GetTimestamp(value: Date) : string ; SendToAddress(WalletAddress, NoofCoin) : string
 * Admin C# DAL/BitCoinCoreDaemon.cs is logically identical to the Member C# (diff -w: only using order / blank lines / region names;
 * GetDeomanBalanceDetails is a plain property bag). No ErrorInsert calls, same database 'affiliate' => re-export.
 */
module.exports = require('../member/BitCoinCoreDaemon');
