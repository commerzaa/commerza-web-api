'use strict';
/**
 * Helpers private to admin port batch13-03 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: ethPriceUsd(), hostIpAddress(), EWALLET_LIST_PROPS, PENDING_LINKS_LIST_PROPS, boolTrue(v), rowsOut(rows, name), omitNull(params)
 */
const os = require('os');
const axios = require('axios');
const { cvtDec, nullRef, col, str } = require('./batch12-common');

/**
 * Legacy block (QCXTokenPrice.cs, 3 copies):
 *   string Result = new WebClient().DownloadString("https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=USD");
 *   foreach (var Item in JArray.Parse(Result)) if (Item["symbol"].ToString() == "ETH") ETH_PRICE_USD = Convert.ToDecimal(Item["price_usd"].ToString());
 * PORT-NOTE: the coinmarketcap v1 ticker API has been retired; a failure throws like the legacy WebException.
 */
async function ethPriceUsd() {
  const UrlForHit = 'https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=USD';
  const Result = (await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x })).data;
  let arr;
  try { arr = JSON.parse(Result); } catch (e) { throw new Error('Error reading JArray from JsonReader.'); }
  if (!Array.isArray(arr)) throw new Error('Error reading JArray from JsonReader.');
  let ETH_PRICE_USD = 0;
  for (const Item of arr) {
    if (!Item || typeof Item !== 'object' || !('symbol' in Item)) throw nullRef(); // Item["symbol"] == null => NullReferenceException
    const sym = Item.symbol === null ? '' : String(Item.symbol);
    if (sym === 'ETH') {
      if (!('price_usd' in Item)) throw nullRef();
      ETH_PRICE_USD = cvtDec(Item.price_usd === null ? '' : String(Item.price_usd));
    }
  }
  return ETH_PRICE_USD;
}

/**
 * Dns.GetHostEntry(Dns.GetHostName()).AddressList; if (addr.Length > 2) IpAddress = addr[2].ToString();  (the SERVER's address)
 * PORT-NOTE: the .NET AddressList order (IPv6 first, then IPv4) may differ from os.networkInterfaces() order.
 */
function hostIpAddress() {
  const addr = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) for (const a of ifs[name] || []) if (!a.internal) addr.push(a.address);
  return addr.length > 2 ? String(addr[2]) : '';
}

/** public class Ewallet_list (Controllers/AdminPanel/Ewallet_Report.cs) */
const EWALLET_LIST_PROPS = ['ROWNUMBER', 'REGNO', 'Name', 'LOGINID', 'EmailId', 'UserName', 'Phone', 'ReferralIncome', 'LeadershipBonus',
  'GrowthReferralBonus', 'GrowthLeadershipBonus', 'GrowthBonus', 'DepositedATC', 'Payable', 'Withdrawal', 'Available', 'DirectIncome', 'PLID',
  'HoldWalletBalanceByAdmin'];

/** public class PendingLinksList (Controllers/AdminPanel/Pending_Links.cs) */
const PENDING_LINKS_LIST_PROPS = ['RowNumber', 'HRID', 'Amount', 'Create_Date', 'Expire_Date', 'fromLoginId', 'fromEmailid', 'fromName', 'fromMobile',
  'investID', 'giveID', 'Help_Date', 'GHStatus', 'regDate', 'fromRegNo', 'toRegNo', 'toLoginID', 'toEmailid', 'toName', 'toMobile',
  'BlockChainAddress', 'btcAmount', 'HRStatus', 'orderID', 'hashcode'];

/** C# bool property compared with `== true` (pg boolean, or 1/'1' from numeric columns) */
const boolTrue = (v) => v === true || v === 1 || v === '1' || v === 't';

/**
 * OUTPUT parameter value of a row-returning proc as `.Value.ToString()`: the PG function repeats OUT params as columns of every row.
 * Returns null when the proc returned no rows (PG cannot return the OUT value then), '' for DBNull.
 */
const rowsOut = (rows, name) => (rows && rows.length ? str(col(rows[0], name)) : null);

/**
 * new SqlParameter("@x", null): a parameter whose Value is C# null is NOT sent by SqlClient, so the proc uses its declared default.
 * PG named notation would pass NULL instead, so such keys are dropped here (the PG function default then applies).
 */
function omitNull(params) {
  const out = {};
  for (const k of Object.keys(params)) if (params[k] !== null && params[k] !== undefined) out[k] = params[k];
  return out;
}

module.exports = { ethPriceUsd, hostIpAddress, EWALLET_LIST_PROPS, PENDING_LINKS_LIST_PROPS, boolTrue, rowsOut, omitNull };
