'use strict';
/**
 * Shared session helpers for the ClusterofferShopingPortal port (contract: SESSION.md in this folder).
 * Exports: LOGIN_PROPS, PORTAL_LOGIN_PROPS, VISITOR_LOCATION_PROPS,
 *          customerTokenPayload(login, sid), issueCustomerToken(login, req, extra),
 *          portalSession, customerAuth, customerOr(body, status), callbackSession,
 *          SessionExpireCheck, DistributerSessionExpireCheck, CheckResellerTimeout,
 *          isCustomer(req), getCustomerLogin(req), loadCustomerLogin(clid), hydrateCustomer,
 *          getSid(req, res), sessionReq(req), sessionGet(req, key), sessionSet(req, key, value), sessionRemove(req, key),
 *          tempDataGet(req, key), tempDataPeek(req, key), tempDataSet(req, key, value),
 *          getPortalLogin(req), setPortalLogin(req, row), initializeVisitorCountrySession(req),
 *          abandonSession(req), parseCookies(req), parseCookieValues(value), setCookie(res, name, value, opts),
 *          deleteCookie(res, name), legacyUrl(req)
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 */
const crypto = require('crypto');
const db = require('../../../db');
const { auth, optionalAuth, requireType, signToken } = require('../../../middleware/auth');
const sessionStore = require('../../../utils/sessionStore');

const DB = 'shopping';

/** Models/LoginRegistration.cs class Login (what Session["Plid"] holds). */
const LOGIN_PROPS = ['Plid', 'Pmid', 'Smdid', 'LoginID', 'UserName', 'Name', 'EmailId', 'Cid', 'DID', 'SecretCode'];
const LOGIN_NUMERIC = new Set(['Plid', 'Pmid', 'Smdid', 'Cid', 'DID']);

/** Models/Portal_Login.cs (only ClassifiedAds puts one of these into Session["Plid"]). */
const PORTAL_LOGIN_PROPS = ['PLID', 'CommunitySide', 'PMID', 'LOGINID', 'PASSWORD', 'LASTLOGIN', 'ACTIVE', 'QPAYREGNO', 'REFRAL_ID',
  'INTRO_REFID', 'DOC', 'CURRENCYSYMBOL', 'CID', 'USERNAME', 'IPADDRESS', 'TITLE', 'FNAME', 'LNAME', 'PHONE', 'DESIGNATION',
  'CPER_EMAILID', 'LASTMAILDATE', 'SUBSCRIPTION_MASTER', 'TBL_NEWSLETTEREMAILID', 'EMAILID', 'USERID', 'TPASSWORD', 'CURRENCY',
  'INTRO_PLID', 'IsActive', 'ReferalCode', 'DefaultLandingUrl', 'MultiLandingUrl', 'IMAGENAME', 'TLPMID', 'IsReferralAccepted'];

/** DAL/Country.cs class VisitorLocation (Session["Propertysessionofcountrystatecity"], never set in active code). */
const VISITOR_LOCATION_PROPS = ['IPAddress', 'CountryName', 'CountryCode', 'CityName', 'RegionName', 'ZipCode', 'Latitude',
  'Longitude', 'TimeZone', 'cid'];

const toNum = (v) => {
  if (v === undefined || v === null || v === '') return v === undefined ? null : v;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== '' ? n : v;
};
const nz = (v) => (v === undefined ? null : v);

// ---------------------------------------------------------------- session id (Session.SessionID)

const SID_COOKIE = 'ASP.NET_SessionId';
const SID_HEADER = 'x-session-id';
const SID_RE = /^[a-z0-5]{24}$/;
const SID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz012345';

function newSid() {
  // 24 chars of [a-z0-5], the same shape as an ASP.NET SessionID (120 random bits).
  const bytes = crypto.randomBytes(15);
  let bits = 0; let acc = 0; let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; out += SID_ALPHABET[(acc >> bits) & 31]; }
  }
  return out;
}

/** Minimal cookie parser (cookie-parser is not installed). First occurrence wins. */
function parseCookies(req) {
  const out = {};
  const h = req && req.headers && req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    let v = part.slice(i + 1).trim();
    try { v = decodeURIComponent(v); } catch (_) { /* keep raw */ }
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/** ASP.NET multi-value cookie ("a=1&b=2", e.g. Request.Cookies["Products"]["product_id"]) -> { a: '1', b: '2' }. */
function parseCookieValues(value) {
  const out = {};
  if (value === undefined || value === null) return out;
  for (const part of String(value).split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i < 0 ? '' : part.slice(0, i);
    let v = i < 0 ? part : part.slice(i + 1);
    try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (_) { /* keep raw */ }
    out[k] = v;
  }
  return out;
}

function isHttps(req) {
  return !!(req && (req.secure || String(req.headers && req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'));
}

/**
 * Response.Cookies.Add / Response.Cookies[name].Value = ...
 * opts: { expires: Date, path = '/', httpOnly = false, values: {k: v} (multi-value cookie, overrides value), req }
 */
function setCookie(res, name, value, opts = {}) {
  if (!res || typeof res.append !== 'function') return;
  let v = value;
  if (opts.values && typeof opts.values === 'object') {
    v = Object.keys(opts.values).map((k) => (k ? `${k}=${encodeURIComponent(nz(opts.values[k]) ?? '')}` : encodeURIComponent(nz(opts.values[k]) ?? ''))).join('&');
  } else {
    v = encodeURIComponent(v === undefined || v === null ? '' : String(v));
  }
  const parts = [`${name}=${v}`, `Path=${opts.path || '/'}`];
  if (opts.expires instanceof Date) parts.push(`Expires=${opts.expires.toUTCString()}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.sameSiteNone || (opts.req && isHttps(opts.req) && opts.sameSiteNone !== false)) parts.push('SameSite=None', 'Secure');
  else parts.push('SameSite=Lax');
  res.append('Set-Cookie', parts.join('; '));
}

/** Response.Cookies[name].Expires = DateTime.Now.AddDays(-1) */
function deleteCookie(res, name) {
  setCookie(res, name, '', { expires: new Date(0) });
}

/**
 * Session.SessionID. Resolution order: token claim `sid` > header `x-session-id` > cookie `ASP.NET_SessionId` > new id.
 * When `res` is given and the id is new (or came only from the token), it is sent back as cookie + `x-session-id` header.
 */
function getSid(req, res) {
  if (req.portalSid) return req.portalSid;
  const fromToken = req.user && typeof req.user.sid === 'string' && SID_RE.test(req.user.sid) ? req.user.sid : null;
  const hdr = req.headers ? String(req.headers[SID_HEADER] || '').trim() : '';
  const fromHeader = SID_RE.test(hdr) ? hdr : null;
  const ck = parseCookies(req)[SID_COOKIE];
  const fromCookie = ck && SID_RE.test(ck) ? ck : null;
  const sid = fromToken || fromHeader || fromCookie || newSid();
  req.portalSid = sid;
  if (res && !res.headersSent) {
    try {
      res.setHeader(SID_HEADER, sid);
      if (sid !== fromCookie) {
        // HttpOnly session cookie (no Expires), like ASP.NET. SameSite=None on https so payment-gateway POST-backs carry it.
        setCookie(res, SID_COOKIE, sid, { httpOnly: true, req });
      }
    } catch (_) { /* headers already sent */ }
  }
  return sid;
}

// ---------------------------------------------------------------- server-side Session[...] (sessionStore)

/** Request-like object whose sessionStore subject is the portal session id ("portal:sid:<sid>"), independent of login. */
function sessionReq(req) {
  return { ip: req.ip, user: { userType: 'portal', plid: `sid:${getSid(req)}` } };
}

const BAG = 'portal';
function bag(req, create) {
  const r = sessionReq(req);
  let b = sessionStore.get(r, BAG);
  if (!b && create) { b = {}; sessionStore.set(r, BAG, b); }
  return b || null;
}

/** Session[key] (keys are case-insensitive, like ASP.NET). Missing -> null. */
function sessionGet(req, key) {
  const b = bag(req, false);
  if (!b) return null;
  const v = b[String(key).toLowerCase()];
  return v === undefined ? null : v;
}

/** Session[key] = value. null/undefined removes the key (same as Session.Remove). */
function sessionSet(req, key, value) {
  const k = String(key).toLowerCase();
  if (value === undefined || value === null) {
    const b = bag(req, false);
    if (b) delete b[k];
    return;
  }
  bag(req, true)[k] = value;
}

/** Session.Remove(key) */
function sessionRemove(req, key) { sessionSet(req, key, null); }

/** Session.Abandon() / Session.Clear(): drops every server-side value of this portal session (not the token). */
function abandonSession(req) {
  sessionStore.set(sessionReq(req), BAG, null);
}

// ---------------------------------------------------------------- TempData (session-backed, read-once)

const TD = '__tempdata';
function tdBag(req, create) {
  let t = sessionGet(req, TD);
  if (!t && create) { t = {}; sessionSet(req, TD, t); }
  return t;
}
/** var x = TempData[key]  (reading marks it for deletion; repeated reads in the same request keep working). */
function tempDataGet(req, key) {
  const k = String(key).toLowerCase();
  req.__tempRead = req.__tempRead || {};
  const t = tdBag(req, false);
  if (t && Object.prototype.hasOwnProperty.call(t, k)) {
    req.__tempRead[k] = t[k];
    delete t[k];
  }
  return Object.prototype.hasOwnProperty.call(req.__tempRead, k) ? req.__tempRead[k] : null;
}
/** TempData.Peek(key) */
function tempDataPeek(req, key) {
  const k = String(key).toLowerCase();
  const t = tdBag(req, false);
  if (t && Object.prototype.hasOwnProperty.call(t, k)) return t[k];
  return req.__tempRead && Object.prototype.hasOwnProperty.call(req.__tempRead, k) ? req.__tempRead[k] : null;
}
/** TempData[key] = value */
function tempDataSet(req, key, value) {
  const k = String(key).toLowerCase();
  if (req.__tempRead) delete req.__tempRead[k];
  const t = tdBag(req, true);
  if (value === undefined || value === null) delete t[k]; else t[k] = value;
}

// ---------------------------------------------------------------- identity: Session["Plid"] (Login) <-> JWT

/** (Login)Session["Plid"] -> JWT claims. Customer-auth compatible (plid = clid = CLID, userName, userType 'customer'). */
function customerTokenPayload(login, sid) {
  const p = {};
  for (const k of LOGIN_PROPS) {
    if (k === 'SecretCode') continue; // [NotMapped], never populated by the login procs
    let v = login ? login[k] : undefined;
    if (v === undefined && login) v = login[k.toLowerCase()];
    v = LOGIN_NUMERIC.has(k) ? toNum(v) : nz(v);
    p[k.toLowerCase()] = v instanceof Date ? v.toISOString() : v;
  }
  p.clid = p.plid;
  p.userName = p.username;
  p.userType = 'customer';
  p.src = 'portal';
  if (sid) p.sid = sid;
  if (p.plid !== null && p.plid !== undefined) p.sub = String(p.plid);
  return p;
}

/**
 * Session["Plid"] = ObjLogin  ->  token. Keeps the current portal session id (cart / OTP / TempData survive the login)
 * and stores the Login snapshot server-side for routes without a bearer token (gateway callbacks, see callbackSession).
 * Returns the JWT string. Callers add it as `token` to the legacy response.
 */
function issueCustomerToken(login, req, extra = {}) {
  const sid = req ? getSid(req) : undefined;
  const payload = { ...customerTokenPayload(login, sid), ...extra };
  if (req) {
    sessionSet(req, 'Plid', getLoginFromClaims(payload));
    req.user = payload;
  }
  return signToken(payload);
}

const isCustomer = (req) => !!(req && req.user && req.user.userType === 'customer'
  && req.user.plid !== undefined && req.user.plid !== null && req.user.plid !== '');

function getLoginFromClaims(u) {
  const o = {};
  for (const k of LOGIN_PROPS) {
    let v = u[k.toLowerCase()];
    if (k === 'Plid' && (v === undefined || v === null)) v = u.clid;
    if (k === 'UserName' && (v === undefined || v === null)) v = u.userName;
    o[k] = LOGIN_NUMERIC.has(k) ? toNum(v) : nz(v);
  }
  return o;
}

/** (Login)Session["Plid"] rebuilt from the token (PascalCase). null when there is no customer session. */
function getCustomerLogin(req) {
  if (!isCustomer(req)) return null;
  return getLoginFromClaims(req.user);
}

/** Same row shape as USP_PORTALLOGIN_M_CUSTOMER / USP_SOCIAL_LOGINCHECK, by CLID (Active = 1). null if not found. */
async function loadCustomerLogin(clid) {
  const row = await db.queryOne(DB,
    `select pl.clid as plid, coalesce(pl.pmid, 0) as pmid, coalesce(smd.smdid, 0) as smdid, pl.loginid,
            coalesce(pl.fname, '') || ' ' || coalesce(pl.lname, '') as name, coalesce(pl.username, pl.loginid) as username,
            pl.cid, pl.did, pl.active
       from tbl_customerlogin pl left join sponsor_master_detail smd on pl.clid = smd.plid
      where pl.clid = @clid
      limit 1`, { clid });
  if (!row) return null;
  const a = row.active;
  if (!(a === true || a === 1 || a === '1' || a === 't' || a === 'true')) return null;
  return {
    Plid: toNum(row.plid), Pmid: toNum(row.pmid), Smdid: toNum(row.smdid), LoginID: nz(row.loginid), UserName: nz(row.username),
    Name: nz(row.name), EmailId: null, Cid: toNum(row.cid), DID: toNum(row.did), SecretCode: null,
  };
}

/**
 * Fills the Login claims a token from /api/CustomerSignIn (customer-auth.js) does not carry
 * (pmid, smdid, loginid, username, name, cid, did). Cached in the portal session under 'Plid'.
 */
async function hydrateCustomer(req, res, next) {
  try {
    if (isCustomer(req) && req.user.loginid === undefined) {
      const clid = req.user.plid !== undefined && req.user.plid !== null ? req.user.plid : req.user.clid;
      let login = sessionGet(req, 'Plid');
      if (!login || String(login.Plid) !== String(clid)) {
        login = await loadCustomerLogin(clid);
        if (login) sessionSet(req, 'Plid', login);
      }
      if (login) {
        const filled = customerTokenPayload(login, req.user.sid);
        for (const k of Object.keys(filled)) if (req.user[k] === undefined) req.user[k] = filled[k];
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}

const attachSid = (req, res, next) => { getSid(req, res); next(); };

/** Public route that touches Session[...] (no login required). Sets req.user when a valid token is sent. */
const portalSession = [optionalAuth, attachSid, hydrateCustomer];

/** `if (Session["Plid"] == null) return RedirectToAction("Index","Home")`, [SessionExpireCheck], unguarded (Login)Session["Plid"]. */
const customerAuth = [auth, requireType('customer'), attachSid, hydrateCustomer];

/**
 * Legacy returned a specific value when the session was missing, e.g. Json("error^loginrequired").
 * router.post(url, ...customerOr('error^loginrequired'), handler)   -> res.status(status).json(body)
 */
function customerOr(body, status = 200) {
  return [optionalAuth, attachSid, hydrateCustomer, (req, res, next) => {
    if (isCustomer(req)) return next();
    return res.status(status).json(body);
  }];
}

/**
 * Payment-gateway / recharge return URLs (browser POST-back without a bearer token): identity comes from the Login
 * snapshot stored in the portal session (cookie ASP.NET_SessionId) by issueCustomerToken. Never rejects.
 */
const callbackSession = [optionalAuth, attachSid, (req, res, next) => {
  if (!isCustomer(req)) {
    const login = sessionGet(req, 'Plid');
    if (login && login.Plid !== null && login.Plid !== undefined) req.user = customerTokenPayload(login, getSid(req));
  }
  next();
}, hydrateCustomer];

/** Legacy filters. */
const SessionExpireCheck = customerAuth;           // Controllers/CustomerPanel/Add_Product.cs: Session["Plid"] == null -> Redirect "~/"
const DistributerSessionExpireCheck = portalSession; // body commented out in legacy: no check
const CheckResellerTimeout = portalSession;          // body commented out in legacy: no check

// ---------------------------------------------------------------- odd session objects

/** (Portal_Login)Session["Plid"] as stored by ClassifiedAds AdPayment / PostAdConfirmation. null if none. */
function getPortalLogin(req) {
  const v = sessionGet(req, 'Plid:Portal_Login');
  return v || null;
}
/** Session["Plid"] = row (a Portal_Login) in ClassifiedAds. Kept apart from the customer Login (see SESSION.md 3.3). */
function setPortalLogin(req, row) {
  sessionSet(req, 'Plid:Portal_Login', row || null);
}

/** DAL/Country.cs GetCountry.InitializeVisitorCountrySession() (the active code only sets constants). */
function initializeVisitorCountrySession(req) {
  sessionSet(req, 'COUNTRYID', '96');
  sessionSet(req, 'COUNTRYNAME', 'India');
  sessionSet(req, 'IPADDRESS', '223.190.123.252');
  sessionSet(req, 'MASTERSESSION', null);
}

/** "~" + Request.Url.AbsolutePath as the legacy app saw it (our '/portal' mount prefix removed). */
function legacyUrl(req) {
  const p = (req.originalUrl || req.url || '').split('?')[0];
  return '~' + (p.replace(/^\/portal(?=\/|$)/i, '') || '/');
}

module.exports = {
  LOGIN_PROPS, PORTAL_LOGIN_PROPS, VISITOR_LOCATION_PROPS,
  customerTokenPayload, issueCustomerToken,
  portalSession, customerAuth, customerOr, callbackSession,
  SessionExpireCheck, DistributerSessionExpireCheck, CheckResellerTimeout,
  isCustomer, getCustomerLogin, loadCustomerLogin, hydrateCustomer,
  getSid, sessionReq, sessionGet, sessionSet, sessionRemove,
  tempDataGet, tempDataPeek, tempDataSet,
  getPortalLogin, setPortalLogin, initializeVisitorCountrySession,
  abandonSession, parseCookies, parseCookieValues, setCookie, deleteCookie, legacyUrl,
};
