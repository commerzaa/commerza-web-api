/**
 * Exports (Merchant DAL/Country.cs, C# static class GetCountry):
 *   InitializeVisitorCountrySession(req): void ; SettingVisitor(string sessionid): void ; InsVisitorsWithDomain(country, state, city, ip, req?): void
 * Merchant-specific: ../GetCountry (API port) sets IPADDRESS from GetIP and an extra CurrencySymbol key and logs to ErrorInsert, and
 * ../franchise/GetCountry re-exports the Country *model* (BindCountry only). The Merchant C# does neither, so it is ported here.
 * PORT-NOTE: HttpContext.Current.Session => utils/sessionStore keyed by the request (pass `req`).
 */
'use strict';
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');

function InitializeVisitorCountrySession(req) {
  const set = (k, v) => sessionStore.set(req, k, v);
  try {
    // (ipinfodb lookup + USP_CREATEMASTERSESSION_M is commented out in the C#)
    set('COUNTRYID', '96');
    set('COUNTRYNAME', 'India');
    set('IPADDRESS', '182.73.107.186');
    set('MASTERSESSION', null);
    set('CURRENCYCODE', String(config.app.ProductCurrency || ''));
  } catch (_) {
    set('COUNTRYID', '96');
    set('COUNTRYNAME', 'India');
    set('IPADDRESS', '182.73.107.186');
    set('MASTERSESSION', null);
    set('CURRENCYCODE', String(config.app.ProductCurrency || ''));
  }
}

// eslint-disable-next-line no-unused-vars
function SettingVisitor(sessionid) {
  try {
    // whole body (ipinfodb lookup, USP_VISITOR_HISTROY_SESSION_PAGECOUNT, InsVisitorsWithDomain) is commented out in the C#
  } catch (_) { /* swallowed */ }
}

// Only derives `domainvisitfrom` from the UrlReferrer; the USP_INSVISITORSFROMDOMAIN call is commented out in the C#.
// PORT-NOTE: HttpContext.Current.Request => optional 5th argument `req` (no DB side effect either way).
// eslint-disable-next-line no-unused-vars
function InsVisitorsWithDomain(country, state, city, ip, req) {
  let domainvisitfrom = '';
  const ref = req && typeof req.get === 'function' ? req.get('referer') : null;
  if (!ref) {
    domainvisitfrom = 'direct';
  } else {
    let host = '';
    try { host = new URL(ref).host; } catch (_) { host = ''; }
    if (host.toLowerCase().includes('qlook.bz')) return;
    domainvisitfrom = host;
  }
  void domainvisitfrom;
}

module.exports = { InitializeVisitorCountrySession, SettingVisitor, InsVisitorsWithDomain };
