'use strict';
/**
 * ASP.NET Web API parameter binding emulation.
 * Simple-type action parameters bind from the query string (even for POST), then route values, then body
 * (form-urlencoded / JSON). Binding is CASE-INSENSITIVE. Use in handlers:
 *    const { LoginID, Password } = req.p;      // any casing of the key works
 *    req.p.get('plid')                          // explicit
 * [FromBody] complex objects: use req.body directly.
 */
function build(req) {
  const merged = {};
  const add = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) if (!(k.toLowerCase() in merged)) merged[k.toLowerCase()] = o[k]; };
  add(req.query); add(req.params); if (!Array.isArray(req.body)) add(req.body);
  return new Proxy({}, {
    get(_, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop === 'get') return (k) => merged[String(k).toLowerCase()];
      if (prop === 'has') return (k) => String(k).toLowerCase() in merged;
      if (prop === 'all') return () => ({ ...merged });
      return merged[prop.toLowerCase()];
    },
    has(_, prop) { return String(prop).toLowerCase() in merged; },
    ownKeys() { return Object.keys(merged); },
    getOwnPropertyDescriptor(_, prop) { return { enumerable: true, configurable: true, value: merged[String(prop).toLowerCase()] }; },
  });
}

// req.p is built lazily: this middleware runs before routing (req.params still empty) and before route-level
// parsers such as multer (req.body not yet filled). Rebuild whenever the params/body objects change
// (req.query is not compared: in Express 5 it is a getter returning a fresh object on every read).
module.exports = (req, _res, next) => {
  let cache = null, seen = [];
  Object.defineProperty(req, 'p', {
    configurable: true,
    enumerable: true,
    get() {
      const now = [this.params, this.body];
      if (!cache || now.some((o, i) => o !== seen[i])) { cache = build(this); seen = now; }
      return cache;
    },
    set(v) { cache = v; seen = [this.params, this.body]; },
  });
  next();
};
module.exports.build = build;
