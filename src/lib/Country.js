'use strict';
/**
 * Exports: InitializeVisitorCountrySession(session?): void ; SettingVisitor(sessionid): void   (C# class GetCountry)
 * PORT-NOTE: the legacy code wrote into HttpContext.Current.Session. Here an optional plain `session` object
 * (e.g. req.session) receives the same keys; without one nothing is stored.
 * PORT-NOTE: AppSettings ProductCurrency / ProductCurrencySymbol are read from config.app (add PRODUCT_CURRENCY /
 * PRODUCT_CURRENCY_SYMBOL to config/.env.example if missing).
 */
const config = require('../config');
const { errorInsert } = require('./_libhelpers');

async function InitializeVisitorCountrySession(session) {
  const s = session || {};
  try {
    s['COUNTRYID'] = '96';
    s['COUNTRYNAME'] = 'India';
    let ip = 'No Ip Fetched.';
    try {
      const GetIP = require('./GetIP');
      ip = await GetIP.GetLocalIP();
    } catch (e) { /* GetIP unavailable: legacy returned "No Ip Fetched." without HttpContext */ }
    s['IPADDRESS'] = ip;
    s['MASTERSESSION'] = null;
    s['CURRENCYCODE'] = String(config.app.ProductCurrency);
    s['CurrencySymbol'] = String(config.app.ProductCurrencySymbol);
  } catch (ExpObj) {
    s['COUNTRYID'] = '96';
    s['COUNTRYNAME'] = 'India';
    s['IPADDRESS'] = '182.73.107.186';
    s['MASTERSESSION'] = null;
    s['CURRENCYCODE'] = String(config.app.ProductCurrency);
    s['CurrencySymbol'] = String(config.app.ProductCurrencySymbol);
    await errorInsert('InitializeVisitorCountrySession', 'Dal/GetCountry', ExpObj);
  }
}

async function SettingVisitor(sessionid) {
  try {
    // all legacy logic is commented out
  } catch (ExpObj) {
    await errorInsert('SettingVisitor', 'Dal/GetCountry', ExpObj);
  }
}

// Models/Country.cs (class Country: BindCountry/BindCountry1/AllCountryList) lives in ./CountryModel; both share this name, so the
// class is exported with the GetCountry statics attached.
const CountryModel = require('./CountryModel');
CountryModel.InitializeVisitorCountrySession = InitializeVisitorCountrySession;
CountryModel.SettingVisitor = SettingVisitor;
module.exports = CountryModel;
