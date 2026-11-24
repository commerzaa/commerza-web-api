/** Exports: GeneratePassword(string secret, long iterationNumber, int digits = 6) : string   (static class HashedOneTimePassword) */
'use strict';
const crypto = require('crypto');

// Encoding.ASCII.GetBytes: chars above 0x7F become '?'
function asciiBytes(s) {
  const str = String(s);
  const b = Buffer.alloc(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    b[i] = c > 0x7f ? 0x3f : c;
  }
  return b;
}

function GeneratePassword(secret, iterationNumber, digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(iterationNumber)); // BitConverter.GetBytes + Array.Reverse on little-endian => big-endian
  const key = asciiBytes(secret);
  const hash = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1] & 0xf;
  // Convert the 4 bytes into an integer, ignoring the sign.
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];
  // Limit the number of digits
  const password = binary % Math.pow(10, digits);
  // Pad to required digits
  return String(password).padStart(digits, '0');
}

module.exports = { GeneratePassword };
