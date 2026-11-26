'use strict';
/**
 * Shared helpers for portal batch 18 (CommonController, HomeController, BusinessDetailsController).
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: DB, NRE, s, strParam, bindInt, bindLong, bindDouble, toInt32, toDouble, dropNulls, outv, csStr, view, emptyResult,
 *          toTitleCase, enquiryDate, findAddress, serializeCustomerAddress, otherRouteHandles, legacyAbsolutePath
 */
const db = require('../../../db');
const { mapRow } = require('../../../utils/shape');
const CustomerAddressModel = require('../../../lib/portal/CustomerAddress');
const b2 = require('./batch-02-common');

const DB = 'shopping';
const { NRE, s, toInt32, toDouble, outv } = b2;

/** MVC string binding: missing or "" => null (ConvertEmptyStringToNull). */
const strParam = (v) => (v === undefined || v === null || v === '' ? null : String(v));

/** MVC binding of a non-nullable int / long / double action parameter (missing or invalid => ArgumentException, HTTP 500). */
const bindInt = (v, name) => b2.bindInt(v, name);
const bindLong = (v, name) => b2.bindInt(v, name, 'System.Int64');
const bindDouble = (v, name) => b2.bindDouble(v, name);

/** SqlParameter with a null Value is not sent (procedure default is used): drop null/undefined keys. */
function dropNulls(o) {
  const out = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
  return out;
}

/** SqlParameter.Value.ToString() for an OUT parameter (DBNull => ""). */
const csStr = (rows, name) => { const v = outv(rows, name); return v === null ? '' : (v instanceof Date ? v.toISOString() : String(v)); };

/** return View(...) / PartialView(...) => JSON with the view name, Model and the ViewBag values. */
function view(res, viewPath, Model, bag = {}) {
  const out = { view: viewPath };
  if (Model !== undefined) out.Model = Model;
  return res.json(Object.assign(out, bag));
}

/** public void action => EmptyResult (200, no body). */
const emptyResult = (res) => res.status(200).end();

/** CultureInfo.CurrentCulture.TextInfo.ToTitleCase (all-uppercase words are kept). null => ArgumentNullException. */
function toTitleCase(str) {
  if (str === undefined || str === null) throw new Error('Value cannot be null.\r\nParameter name: str');
  return String(str).replace(/[A-Za-zÀ-ɏ]+/g, (w) => (w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));
}

/** DateTime.Now.ToString("dd MMM yyyy") + "  At  " + DateTime.Now.ToString("hh:mm tt") */
function enquiryDate() {
  const t = new Date();
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p2 = (n) => String(n).padStart(2, '0');
  const h = t.getHours() % 12 === 0 ? 12 : t.getHours() % 12;
  return `${p2(t.getDate())} ${M[t.getMonth()]} ${t.getFullYear()}  At  ${p2(h)}:${p2(t.getMinutes())} ${t.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** db._CustomerAddress.Where(a => a.Id == id).FirstOrDefault() (PascalCase CustomerAddress) or null */
async function findAddress(id) {
  const row = await db.queryOne(DB, 'select * from ims_customeraddress where id = @id limit 1', { id });
  return row ? mapRow(row, CustomerAddressModel.PROPS.filter((p) => !(CustomerAddressModel.NOT_MAPPED || []).includes(p))) : null;
}

/** "\/Date(ms)\/" (JavaScriptSerializer DateTime format) */
const jsDate = (d) => {
  if (d === null || d === undefined) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : `/Date(${x.getTime()})/`;
};
/** new JavaScriptSerializer().Serialize(CustomerAddress): public fields (enum 0) then properties, incl. the [NotMapped] enum ones. null => "null" */
function serializeCustomerAddress(a) {
  if (a === null || a === undefined) return 'null';
  const o = { addresstype: 0, tousertype: 0 };
  for (const p of CustomerAddressModel.PROPS) {
    if (p === 'AddressTypes') o[p] = o.addresstype;
    else if (p === 'ToUserTypes') o[p] = o.tousertype;
    else if (p === 'CreatedDate') o[p] = jsDate(a[p]);
    else o[p] = a[p] === undefined ? null : a[p];
  }
  return JSON.stringify(o);
}

/**
 * true when a route registered by ANOTHER handler (any module mounted in the app) matches method + path.
 * Used by the RouteConfig catch-all "{title}" (BusinessDetails) so that it only answers when nothing else does,
 * like the legacy route table where every specific url came before "{title}".
 */
const cache = new Map();
function otherRouteHandles(req, ownRoute) {
  const method = req.method;
  const urlPath = String(req.originalUrl || req.url || '').split('?')[0];
  const key = method + ' ' + urlPath;
  if (cache.has(key)) return cache.get(key);
  const root = (req.app && (req.app.router || req.app._router)) || null; // eslint-disable-line no-underscore-dangle
  let found = false;
  const walk = (stack, p, depth) => {
    if (!Array.isArray(stack) || depth > 20) return;
    for (const layer of stack) {
      if (found) return;
      try {
        if (layer.route) {
          if (layer.route === ownRoute) continue;
          if (layer.match(p) && (typeof layer.route._handlesMethod !== 'function' || layer.route._handlesMethod(method))) found = true; // eslint-disable-line no-underscore-dangle
        } else if (layer.handle && Array.isArray(layer.handle.stack)) {
          if (!layer.match(p)) continue;
          const sub = layer.slash ? p : (p.slice(String(layer.path || '').length) || '/');
          walk(layer.handle.stack, sub, depth + 1);
        }
      } catch (_) { /* ignore a layer that cannot be matched */ }
    }
  };
  if (root) walk(root.stack, urlPath, 0);
  if (cache.size > 5000) cache.clear();
  cache.set(key, found);
  return found;
}

/** Request.Url.AbsolutePath as the legacy app saw it (our /portal prefix removed) */
function legacyAbsolutePath(req) {
  const p = String(req.originalUrl || req.url || '').split('?')[0];
  return p.replace(/^\/portal(?=\/|$)/i, '') || '/';
}

module.exports = {
  DB, NRE, s, strParam, bindInt, bindLong, bindDouble, toInt32, toDouble, dropNulls, outv, csStr, view, emptyResult,
  toTitleCase, enquiryDate, findAddress, serializeCustomerAddress, otherRouteHandles, legacyAbsolutePath,
};
