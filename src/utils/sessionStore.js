'use strict';
/** Replacement for ASP.NET Session for non-identity data. Keyed by JWT subject (plid/clid/did) + app type. In-memory (single process). */
const store = new Map();
function subject(req) {
  const u = req.user || {};
  return `${u.userType || 'anon'}:${u.plid || u.clid || u.did || req.ip}`;
}
function get(req, key) { const s = store.get(subject(req)); return s ? s[key] : undefined; }
function set(req, key, value) {
  const k = subject(req);
  const s = store.get(k) || {};
  if (value === undefined || value === null) delete s[key]; else s[key] = value;
  store.set(k, s);
}
module.exports = { get, set };
