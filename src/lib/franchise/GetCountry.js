/** Exports (Franchise DAL/Country.cs, static class GetCountry; all async):
 *  InitializeVisitorCountrySession(sessionOrReq?) : void   - writes COUNTRYID/COUNTRYNAME/IPADDRESS/MASTERSESSION/CURRENCYCODE
 *  SettingVisitor(sessionid) : void                         - legacy body fully commented out (no-op, exceptions swallowed)
 *  InsVisitorsWithDomain(country, state, city, ip, req?) : void - legacy DB call commented out; only computes the referrer domain
 *  PORT-NOTE: HttpContext.Current.Session => if an Express `req` is passed the keys go to utils/sessionStore (read back with
 *  sessionStore.get(req, 'COUNTRYID') ...); if a plain object is passed the keys are written onto it.
 *  PORT-NOTE: unlike the API/Member port (../Country), the Franchise C# hard-codes IPADDRESS "182.73.107.186" and does not set CurrencySymbol.
 *  Previously this file re-exported ./Country (Models/Country.cs: class Country.BindCountry), which has none of these methods.
 */
'use strict';
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');

function isReq(x) { return !!x && typeof x === 'object' && typeof x.get === 'function' && ('headers' in x); }

function writer(target) {
  if (isReq(target)) return (k, v) => sessionStore.set(target, k, v);
  const s = target || {};
  return (k, v) => { s[k] = v; };
}

async function InitializeVisitorCountrySession(session) {
  const put = writer(session);
  try {
    // (IP-geolocation lookup via api.ipinfodb.com is commented out in the legacy code)
    put('COUNTRYID', '96');
    put('COUNTRYNAME', 'India');
    put('IPADDRESS', '182.73.107.186');
    put('MASTERSESSION', null);
    put('CURRENCYCODE', String(config.app.ProductCurrency || '')); // legacy: AppSettings["ProductCurrency"].ToString()
  } catch (e) {
    put('COUNTRYID', '96');
    put('COUNTRYNAME', 'India');
    put('IPADDRESS', '182.73.107.186');
    put('MASTERSESSION', null);
    put('CURRENCYCODE', String(config.app.ProductCurrency || ''));
  }
}

async function SettingVisitor(sessionid) { // eslint-disable-line no-unused-vars
  try {
    // all legacy logic is commented out
  } catch (e) { /* swallowed */ }
}

async function InsVisitorsWithDomain(country, state, city, ip, req) { // eslint-disable-line no-unused-vars
  let domainvisitfrom = '';
  const ref = req && typeof req.get === 'function' ? req.get('referer') : undefined;
  if (!ref) {
    domainvisitfrom = 'direct';
  } else {
    let host = '';
    try { host = new URL(ref).host; } catch (_) { host = String(ref); }
    if (host.toLowerCase().includes('qlook.bz')) return;
    domainvisitfrom = host;
  }
  // legacy: using (DataBaseContext Db) { /* USP_INSVISITORSFROMDOMAIN call commented out */ }
}

module.exports = { InitializeVisitorCountrySession, SettingVisitor, InsVisitorsWithDomain };
