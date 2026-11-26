/**
 * Exports (Portal DAL/Country.cs, C# static class GetCountry; file named after the class because Models/Country.cs => ./Country):
 *   InitializeVisitorCountrySession(req): void ; SettingVisitor(string sessionid): void ;
 *   InsVisitorsWithDomain(country, state, city, ip): void ; Maintain_pageLog(country, state, city, ip): void
 * Portal differences vs Merchant: IPADDRESS "223.190.123.252", no CURRENCYCODE key, no try/catch; InsVisitorsWithDomain / Maintain_pageLog bodies
 *   are entirely commented out in the C# (no-ops). Data classes Location / VisitorLocation / UserLocation / InitializeVisitorCountrySessionProp
 *   are plain property bags (not ported).
 * PORT-NOTE: HttpContext.Current.Session => portal-session sessionSet (SESSION.md section 6; pass `req` as the extra argument).
 */
'use strict';
const { sessionSet } = require('../../modules/portal/_shared/portal-session');

async function InitializeVisitorCountrySession(req) {
  // (ipinfodb lookup + USP_CREATEMASTERSESSION are commented out in the C#)
  sessionSet(req, 'COUNTRYID', '96');
  sessionSet(req, 'COUNTRYNAME', 'India');
  sessionSet(req, 'IPADDRESS', '223.190.123.252');
  sessionSet(req, 'MASTERSESSION', null);
}

// eslint-disable-next-line no-unused-vars
async function SettingVisitor(sessionid) {
  // whole body is commented out in the C#
}

// eslint-disable-next-line no-unused-vars
async function InsVisitorsWithDomain(country, state, city, ip) {
  // whole body is commented out in the C#
}

// eslint-disable-next-line no-unused-vars
async function Maintain_pageLog(country, state, city, ip) {
  // whole body is commented out in the C#
}

const GetCountry = { InitializeVisitorCountrySession, SettingVisitor, InsVisitorsWithDomain, Maintain_pageLog };
module.exports = { ...GetCountry, GetCountry };
