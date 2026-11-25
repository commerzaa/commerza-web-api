/** Exports: GeneratePassword(string secret, long iterationNumber, int digits = 6) : string  (same as ../member/HashedOneTimePassword.js)
 *           OneTimePasswordException : class (same as ../member/OneTimePasswordException.js; also ./OneTimePasswordException)
 *  Admin Models/HashedOneTimePassword.cs = Member HashedOneTimePassword.cs + Member OneTimePasswordException.cs in one file (identical code).
 */
'use strict';
module.exports = { ...require('../member/HashedOneTimePassword'), OneTimePasswordException: require('../member/OneTimePasswordException') };
