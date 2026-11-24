/** Exports (static class): UNIX_EPOCH:Date ; GetPassword(secret) | GetPassword(secret, epoch:Date, timeStep:int) | GetPassword(secret, now:Date, epoch:Date, timeStep:int, digits:int) : string ;
 *  IsValid(string secret, string password, int checkAdjacentIntervals = 1) : bool  (throws OneTimePasswordException) */
'use strict';
const HashedOneTimePassword = require('./HashedOneTimePassword');
const OneTimePasswordException = require('./OneTimePasswordException');

const UNIX_EPOCH = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
const _cache = new Map(); // secret_password -> Date

function _getPasswordByCounter(secret, counter, digits = 6) {
  return HashedOneTimePassword.GeneratePassword(secret, counter, digits);
}

// (long)(now - epoch).TotalSeconds / timeStep : cast to long first, then integer division
function _getCurrentCounter(now, epoch, timeStep) {
  if (now === undefined) { now = new Date(); epoch = UNIX_EPOCH; timeStep = 30; }
  const totalSeconds = (now.getTime() - epoch.getTime()) / 1000;
  return Math.trunc(Math.trunc(totalSeconds) / timeStep);
}

function GetPassword(secret, a, b, c, d) {
  const n = arguments.length;
  if (n <= 1) return _getPasswordByCounter(secret, _getCurrentCounter());
  if (n === 3) return _getPasswordByCounter(secret, _getCurrentCounter(new Date(), a, b)); // (secret, epoch, timeStep)
  return _getPasswordByCounter(secret, _getCurrentCounter(a, b, c), d); // (secret, now, epoch, timeStep, digits)
}

function _cleanCache() {
  const keysToRemove = [];
  for (const [key, value] of _cache) {
    if ((Date.now() - value.getTime()) / 60000 > 2) keysToRemove.push(key);
  }
  for (const key of keysToRemove) _cache.delete(key);
}

function IsValid(secret, password, checkAdjacentIntervals = 1) {
  _cleanCache();
  const cache_key = `${secret}_${password}`;
  if (_cache.has(cache_key)) {
    throw new OneTimePasswordException('You cannot use the same secret/iterationNumber combination more than once.');
  }
  // _cache.Add(cache_key, DateTime.Now) is commented out in the legacy code
  if (password === GetPassword(secret)) return true;
  for (let i = 1; i <= checkAdjacentIntervals; i++) {
    const getcurrentpass = _getPasswordByCounter(secret, _getCurrentCounter() + i);
    if (password === getcurrentpass) return true;
    _getPasswordByCounter(secret, _getCurrentCounter() - i); // getcurrentpass_1 computed but the legacy comparison re-uses getcurrentpass
    if (password === getcurrentpass) return true;
  }
  return false;
}

module.exports = { UNIX_EPOCH, GetPassword, IsValid };
