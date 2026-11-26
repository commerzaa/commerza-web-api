'use strict';
/**
 * Shared helpers for portal batch 14 (servicejewaria, sitemap, socialmediapromo, support, SurfNow, termandcondition, termofuse,
 * TrafficBooster, Train, UserPanel/Business_KYC, Member_Profile, Orders, Proceed_To_Payment, Wishlist, video_gallery, VisitorConfirmation).
 * Not a router (lives in _shared/).
 */
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const ps = require('./portal-session');
const WebsiteDetail = require('../../../lib/portal/WebsiteDetail');

const DB = 'shopping';

/** Convert.ToString / ToStringOrEmpty: null/undefined => '' */
const s = (v) => (v === null || v === undefined ? '' : String(v));
const nz = (v) => (v === undefined ? null : v);
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

/** case-insensitive column lookup */
function col(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? null : row[k];
}
/** SqlParameter(Output).Value.ToString() read from the result row(s) of db.proc (DBNull / no row => '') */
const outStr = (rowOrRows, name) => s(col(Array.isArray(rowOrRows) ? rowOrRows[0] : rowOrRows, name));

/** HttpContext.Request.Url.ToString() */
const fullUrl = (req) => `${req.protocol}://${req.get('host')}${req.originalUrl}`;

/** Server.MapPath(x) => config.uploadDir/<x without leading ~ / ./ ../> (same rule as lib/portal/UtilityClass) */
function mapPath(p) {
  let f = s(p).replace(/\\/g, '/').replace(/^~/, '');
  while (/^(\.{1,2}\/|\/)/.test(f)) f = f.replace(/^(\.{1,2}\/|\/)/, '');
  return path.join(config.uploadDir, f);
}

/** System.Threading.Thread(...).Start() => fire and forget */
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[portal batch14 bg]', e && e.message)); };

/** Convert.ToInt32(string): null => 0, otherwise strict Int32 parse (FormatException / OverflowException) */
function toInt32(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Input string was not in a correct format.');
    return Math.round(v);
  }
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(t, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}
/** Convert.ToDecimal(string): null => 0, otherwise strict parse (FormatException) */
function toDecimal(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const t = String(v).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseFloat(t);
}
/** Non-nullable simple action parameter (int/Int32/decimal): MVC throws ArgumentException when missing or unparsable. */
function requiredInt(v, name, action) {
  const t = v === undefined || v === null ? '' : String(v).trim();
  if (!/^[+-]?\d+$/.test(t) || Math.abs(parseInt(t, 10)) > 2147483647) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32' for method '${action}'.`);
    e.status = 500;
    throw e;
  }
  return parseInt(t, 10);
}
/** Nullable<int> action parameter: missing/unparsable => null */
function nullableInt(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  return Math.abs(n) > 2147483647 ? null : n;
}
/** string action parameter: absent => null (MVC binds empty form values to null as well) */
const strParam = (v) => (v === undefined || v === null || v === '' ? null : String(v));

const pad2 = (n) => String(n).padStart(2, '0');
/** DateTime.Now.ToString("dd-MM-yyyy") */
const todayDMY = () => { const d = new Date(); return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; };
/** new Random().Next(min, max) (max exclusive) */
const randomNext = (min, max) => min + Math.floor(Math.random() * (max - min));

/** ViewBag.masterpageshow = Session["LoginwithMobile"] != null ? "MobileLogin" : "" */
const masterpageshow = (req) => (ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '');

/**
 * Common body of the static CMS pages: Canonical + SEO tags from WebsiteDetail.GetWebsiteInfo(WID).
 * (The "Domain Management" block only read Request.Url values; its redirect logic is commented out in legacy.)
 */
async function seoViewBag(req, WID) {
  const ViewBag = {};
  ViewBag.Canonical = fullUrl(req);
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(WID);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    ViewBag.Title = nz(ObjWebsiteDescription.SeoTitle);
    ViewBag.MetaDesc = nz(ObjWebsiteDescription.SeoDescription);
    ViewBag.MetaKeyword = nz(ObjWebsiteDescription.SeoKeyword);
  }
  return ViewBag;
}

/**
 * CommonController.updatemerchantkyc(double plid) (public static helper of Controllers/CommonController.cs, not an action here).
 * Inlined because CommonController is ported by another batch. Legacy string-concatenated SQL is parameterised.
 */
async function updatemerchantkyc(plid) {
  let result = 0;
  try {
    const p = Number(plid);
    const countkyc = Number(await db.scalar(DB, 'select count(1) from kyc where isaprove = 0 and regno = @plid', { plid: p })) || 0;
    const countbankverifyied = Number(await db.scalar(DB,
      'select count(1) from bank_accounts_merchant where plid = @plid and active = true and isaprove = 0', { plid: p })) || 0;
    const et = await db.scalar(DB, 'select distinct entitytype from tbl_businesskycdetails where plid = @plid limit 1', { plid: p });
    const Entitype = et === null || et === undefined ? 0 : Number(et);
    if (Entitype === 1 && countkyc === 2 && countbankverifyied === 1) {
      await db.exec(DB, 'update portal_login set iskycapproved = 2 where plid = @plid and active = true', { plid: p });
      result = 1;
    } else if (Entitype === 3 && countkyc === 6 && countbankverifyied === 1) {
      await db.exec(DB, 'update portal_login set iskycapproved = 2 where plid = @plid and active = true', { plid: p });
      result = 1;
    } else {
      result = 0;
    }
    return result;
  } catch (Ex) {
    throw new Error(Ex.message);
  }
}

/** new MailAddress(x) validation (System.Net.Mail): empty => ArgumentException, bad format => FormatException */
function checkMailAddress(addr, paramName) {
  if (addr === null || addr === undefined) throw new Error(`Value cannot be null.\r\nParameter name: ${paramName}`);
  if (String(addr) === '') throw new Error(`The parameter '${paramName}' cannot be an empty string.\r\nParameter name: ${paramName}`);
  if (!/^[^@\s]+@[^@\s]+$/.test(String(addr).trim().replace(/^.*<([^>]+)>\s*$/, '$1'))) {
    throw new Error('The specified string is not in the form required for an e-mail address.');
  }
}

module.exports = {
  DB, s, nz, NRE, col, outStr, fullUrl, mapPath, bg, toInt32, toDecimal, requiredInt, nullableInt, strParam, todayDMY, randomNext,
  masterpageshow, seoViewBag, updatemerchantkyc, checkMailAddress,
};
