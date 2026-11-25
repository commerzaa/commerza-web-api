'use strict';
/**
 * Shared helpers for portal batch 13 (Product_Detail, Product, PromosAndAdvertisement, ReferralOuter, referralprogram,
 * RESTRICTED_AND_PROHIBITEDITEMS, ReturnPlicy, ringsizer, SearchNotFound, servicejewaria_Mobile).
 * Exports: DB, pageUrl(req), seoViewBag(ViewBag, WID), str(v), NRE(), toInt32(v), toInt64(v), toDecimal(v), outOf(rows, name)
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 */
const WebsiteDetail = require('../../../lib/portal/WebsiteDetail');

const DB = 'shopping';

/** HttpContext.Request.Url.ToString() / AbsoluteUri (full URL incl. query string). */
function pageUrl(req) {
  const host = (req.get && req.get('host')) || (req.headers && req.headers.host) || '';
  return `${req.protocol || 'http'}://${host}${req.originalUrl || req.url || ''}`;
}

/** ViewBag.Title/MetaDesc/MetaKeyword = "" then WebsiteDetail.GetWebsiteInfo(WID) Seo* when not null. */
async function seoViewBag(ViewBag, WID) {
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(WID);
  if (ObjWebsiteDescription != null) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  return ObjWebsiteDescription;
}

const str = (v) => (v === null || v === undefined ? '' : String(v));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

/** Convert.ToInt32: null -> 0, invalid string -> FormatException. */
function toInt32(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
const toInt64 = toInt32;

/** Convert.ToDecimal: null -> 0. */
function toDecimal(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).trim());
  if (String(v).trim() === '' || !Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

/** OUTPUT parameter of a proc returned as a column of the (first) result row. */
function outOf(rows, name) {
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  const k = Object.keys(r).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? null : r[k];
}

module.exports = { DB, pageUrl, seoViewBag, str, NRE, toInt32, toInt64, toDecimal, outOf };
