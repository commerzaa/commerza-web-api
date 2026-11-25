/** Exports (static class Eblaa_Payments.Utility.PaymentFunctions, Payment Gateway Utility/PaymentFunctions.cs; all sync):
 *   GenerateHash(parameters: Dictionary<string,string> (plain object or Map), salt: string) : string   (PayU request hash, SHA-512 lower-case hex)
 *   Sha512(hashString: string) : string   (UTF-8 bytes -> SHA-512 -> lower-case hex)
 */
'use strict';
const crypto = require('crypto');

// Dictionary<string,string> indexer / ContainsKey on a plain object or a Map
function has(parameters, k) {
  if (parameters instanceof Map) return parameters.has(k);
  return Object.prototype.hasOwnProperty.call(parameters, k);
}
function get(parameters, k) {
  // Dictionary indexer throws KeyNotFoundException for a missing key
  if (parameters === null || parameters === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  if (!has(parameters, k)) {
    const e = new Error(`The given key '${k}' was not present in the dictionary.`);
    e.name = 'KeyNotFoundException';
    throw e;
  }
  return parameters instanceof Map ? parameters.get(k) : parameters[k];
}
// C# string interpolation of a null string => ""
const s_ = (v) => (v === null || v === undefined ? '' : String(v));

function GenerateHash(parameters, salt) {
  // Extract parameters or use empty string if not provided
  const key = get(parameters, 'key');
  const txnid = get(parameters, 'txnid');
  const amount = get(parameters, 'amount');
  const productinfo = get(parameters, 'productinfo');
  const firstname = get(parameters, 'firstname');
  const email = get(parameters, 'email');

  // Get UDF values if present, otherwise use empty string
  const udf1 = has(parameters, 'udf1') ? get(parameters, 'udf1') : '';
  const udf2 = has(parameters, 'udf2') ? get(parameters, 'udf2') : '';
  const udf3 = has(parameters, 'udf3') ? get(parameters, 'udf3') : '';
  const udf4 = has(parameters, 'udf4') ? get(parameters, 'udf4') : '';
  const udf5 = has(parameters, 'udf5') ? get(parameters, 'udf5') : '';

  // Construct hash string with exact parameter sequence
  const hashString = `${s_(key)}|${s_(txnid)}|${s_(amount)}|${s_(productinfo)}|${s_(firstname)}|${s_(email)}|${s_(udf1)}|${s_(udf2)}|${s_(udf3)}|${s_(udf4)}|${s_(udf5)}||||||${s_(salt)}`;

  return Sha512(hashString);
}

function Sha512(hashString) {
  if (hashString === null || hashString === undefined) throw new TypeError('Value cannot be null. Parameter name: s'); // Encoding.UTF8.GetBytes(null)
  return crypto.createHash('sha512').update(Buffer.from(String(hashString), 'utf8')).digest('hex').toLowerCase();
}

module.exports = { GenerateHash, Sha512 };
