/** Exports: identical to ../merchant/TimeBasedOneTimePassword (Portal C# is identical to the Merchant C#; no DB)
 *   UNIX_EPOCH, GetPassword(secret[, ...]) : string, IsValid(string secret, string password, int checkAdjacentIntervals = 1) : bool */
'use strict';
module.exports = require('../merchant/TimeBasedOneTimePassword');
