/** Exports (static class GetIP): GetLocalIP(req?) : string   ; requestContext(req,res,next) optional middleware replacing HttpContext.Current */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
function requestContext(req, res, next) { als.run(req, next); }

// PORT-NOTE: legacy read HttpContext.Current; pass the express `req` or install requestContext middleware once.
// Unlike lib/GetIP.js the Franchise version has no ErrorInsert in its catch block, so none is done here.
function GetLocalIP(req) {
  let _IP = '';
  try {
    const r = req || als.getStore();
    if (!r) throw new Error('Object reference not set to an instance of an object.');
    const xff = r.headers && r.headers['x-forwarded-for'];
    _IP = Array.isArray(xff) ? xff.join(',') : xff;
    if (!_IP) {
      _IP = (r.socket && r.socket.remoteAddress) || r.ip || '';
      _IP = _IP.replace(/^::ffff:/i, ''); // PORT-NOTE: IPv4-mapped IPv6 prefix removed
    }
    if (_IP.includes(',')) {
      const indexof = _IP.indexOf(',');
      _IP = _IP.substring(0, indexof);
    }
  } catch (e) {
    _IP = 'No Ip Fetched.';
  }
  return _IP;
}

module.exports = { GetLocalIP, requestContext };
