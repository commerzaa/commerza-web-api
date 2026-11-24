'use strict';
/**
 * Exports (static class):
 *   async GetLocalIP(req?) : string   - legacy took no args (HttpContext.Current); pass express `req`, or install
 *                                        `app.use(GetIP.requestContext)` once so it works without args.
 *   requestContext(req,res,next)      - optional middleware (AsyncLocalStorage) replacing HttpContext.Current
 */
const { AsyncLocalStorage } = require('async_hooks');
const DataUtility = require('./DataUtility');

const als = new AsyncLocalStorage();
function requestContext(req, res, next) { als.run(req, next); }

async function GetLocalIP(req) {
  let _IP = '';
  try {
    const r = req || als.getStore();
    if (!r) throw new Error('Object reference not set to an instance of an object.');
    const xff = r.headers && r.headers['x-forwarded-for'];
    _IP = Array.isArray(xff) ? xff.join(',') : xff;
    if (!_IP) {
      _IP = (r.socket && r.socket.remoteAddress) || r.ip || '';
      // PORT-NOTE: IPv4-mapped IPv6 prefix removed (Node reports ::ffff:1.2.3.4)
      _IP = _IP.replace(/^::ffff:/i, '');
    }
    if (_IP.includes(',')) {
      _IP = _IP.substring(0, _IP.indexOf(','));
    }
  } catch (ExpObj) {
    _IP = 'No Ip Fetched.';
    try {
      const ut = new DataUtility();
      await ut.ErrorInsert(0, ExpObj.message, 'GetLocalIP', 0, 'Models/GetIP');
    } catch (e) { console.error('GetLocalIP ErrorInsert failed', e.message); }
  }
  return _IP;
}

module.exports = { GetLocalIP, requestContext };
