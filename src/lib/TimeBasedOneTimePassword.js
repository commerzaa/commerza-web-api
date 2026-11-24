/** Exports: UNIX_EPOCH:Date ; GetPassword(secret) | GetPassword(secret, epoch:Date, timeStep:int) | GetPassword(secret, now:Date, epoch:Date, timeStep:int, digits:int) : string ;
 *  IsValid(string secret, string password, int checkAdjacentIntervals = 10) : bool  (throws OneTimePasswordException)   (static class TimeBasedOneTimePassword) */
'use strict';
const HashedOneTimePassword = require('./HashedOneTimePassword');
const OneTimePasswordException = require('./OneTimePasswordException');

const UNIX_EPOCH = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));

const _cache = new Map(); // secret_password -> Date

function _getPasswordByCounter(secret, counter, digits = 6) {
  return HashedOneTimePassword.GeneratePassword(secret, counter, digits);
}

// (long)(now - epoch).TotalSeconds / timeStep  -> cast to long first, then integer division
function _getCurrentCounter(now, epoch, timeStep) {
  if (now === undefined) { now = new Date(); epoch = UNIX_EPOCH; timeStep = 30; }
  const totalSeconds = (now.getTime() - epoch.getTime()) / 1000;
  return Math.trunc(Math.trunc(totalSeconds) / timeStep);
}

function GetPassword(secret, a, b, c, d) {
  const n = arguments.length;
  if (n <= 1) {
    return _getPasswordByCounter(secret, _getCurrentCounter());
  }
  if (n === 3) { // (secret, epoch, timeStep)
    const counter = _getCurrentCounter(new Date(), a, b);
    return _getPasswordByCounter(secret, counter);
  }
  // (secret, now, epoch, timeStep, digits)
  const counter = _getCurrentCounter(a, b, c);
  return _getPasswordByCounter(secret, counter, d);
}

function _cleanCache() {
  const keysToRemove = [];
  for (const [key, value] of _cache) {
    if ((Date.now() - value.getTime()) / 60000 > 2) keysToRemove.push(key);
  }
  for (const key of keysToRemove) _cache.delete(key);
}

function IsValid(secret, password, checkAdjacentIntervals = 10) {
  // Keeping a cache of the secret/password combinations that have been requested allows us to
  // make this a real one time use system (the cache.Add is commented out in the legacy code).
  _cleanCache();

  const cache_key = `${secret}_${password}`;
  if (_cache.has(cache_key)) {
    throw new OneTimePasswordException('You cannot use the same secret/iterationNumber combination more than once.');
  }

  if (password === GetPassword(secret)) return true;

  for (let i = 1; i <= checkAdjacentIntervals; i++) {
    const getcurrentpass = _getPasswordByCounter(secret, _getCurrentCounter() + i);
    if (password === getcurrentpass) return true;
    // legacy: getcurrentpass_1 (counter - i) is computed but the comparison below re-uses getcurrentpass
    _getPasswordByCounter(secret, _getCurrentCounter() - i);
    if (password === getcurrentpass) return true;
  }
  return false;
}

module.exports = { UNIX_EPOCH, GetPassword, IsValid };
