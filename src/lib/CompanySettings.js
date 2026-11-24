/** Exports:
 *   CompanySettings : object (static mutable fields: DID, RequestedURL, CompanyName, CompanyURL, ... Playstorelink, Companyfavicon)
 *   CompanyMasterSettings : { GetResellerData() : void }   (C# static class CompanyMasterSettings)
 * PORT-NOTE: legacy AppSettings keys are read from config.app[key] (fallback process.env[key]). Keys that are not defined
 * (C# would throw NullReference and the surrounding empty catch silently stopped loading) are left at their default ('' / 0) and
 * loading continues. Keys not present in config.app today: CompanyResellerURL, NoReplyMail, CompanyFaviconIcon, CompanyLogo,
 * CompanyAdvertisement, CompanyServices, CompanyAPIUrl, CompanyCurrency, CompanyOAUTHURL, CompanyVALIDURL, CompanySCOPE,
 * CompanyCLIENTID, CompanyREDIRECT, CompanyLOGOUT, CompanyFacebookLink, CompanyGooglePlusLink, CompanyTwitterLink,
 * CompanyPinterestLink, CompanyLinkedinLink, DedicatedProductURL, CompanyAddress, TicketReplyAdmin, Playstorelink.
 * PORT-NOTE: RequestedURL (HttpContext.Current.Request.Url.Host) has no request context here: defaults to '' and may be assigned by the caller.
 */
'use strict';
const config = require('../config');

const CompanySettings = {
  DID: 0,
  RequestedURL: '',
  CompanyName: '',
  CompanyURL: '',
  CompanyDomain: '',
  CompanyInfoEmailId: '',
  CompanySupportEmailId: '',
  CompanySendMailEmailId: '',
  CompanyMailServer: '',
  CompanyMailPassword: '',
  CompanyResellerURL: '',
  CompanyMerchantURL: '',
  AffiliateURL: '',
  NoReplyMail: '',
  AdminURLforImage: '',
  CompanyMailServerPort: 0,
  CompanyFaviconIcon: '',
  CompanyLogo: '',
  CompanyTitle: '',
  CompanyContact: '',
  CompanyAdvertisement: '',
  CompanyServices: '',
  CompanyAPIUrl: '',
  CompanyCurrency: '',
  CompanyOAUTHURL: '',
  CompanyVALIDURL: '',
  CompanySCOPE: '',
  CompanyCLIENTID: '',
  CompanyREDIRECT: '',
  CompanyLOGOUT: '',
  ResellerLoginId: '',
  FACEBOOKCLIENTID: '',
  FACEBOOKCLIENTSECRET: '',
  CompanyPGMerchantKey: '',
  CompanyPGSalt: '',
  CompanyFacebookLink: '',
  CompanyGooglePlusLink: '',
  CompanyTwitterLink: '',
  CompanyPinterestLink: '',
  CompanyLinkedinLink: '',
  SMSAPI: '',
  DedicatedProductURL: '',
  PMID: 0,
  CompanyAddress: undefined,
  TicketReplyAdmin: undefined,
  ProductBvIntstatus: 0,
  ProductPvIntstatus: 0,
  ProductCashbackIntstatus: 0,
  ProductActivationPV: 0,
  UtilityBvIntstatus: 0,
  UtilityPvIntstatus: 0,
  Playstorelink: undefined,
  Companyfavicon: '',
};

function appSetting(key) {
  const v = config.app[key] !== undefined && config.app[key] !== null ? config.app[key] : process.env[key];
  return v === undefined || v === null ? null : String(v);
}
const str = (key, current) => { const v = appSetting(key); return v === null ? current : v; };
const int = (key, current) => {
  const v = appSetting(key);
  if (v === null) return current;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? current : n;
};

const CompanyMasterSettings = {
  GetResellerData() {
    try {
      const S = CompanySettings;
      S.DID = int('DID', S.DID);
      S.CompanyName = str('CompanyName', S.CompanyName);
      S.CompanyURL = str('CompanyURL', S.CompanyURL);
      S.CompanyDomain = str('CompanyURL', S.CompanyDomain);
      S.CompanyInfoEmailId = str('CompanyInfoEmailId', S.CompanyInfoEmailId);
      S.CompanySupportEmailId = str('CompanySupportEmailId', S.CompanySupportEmailId);
      S.CompanySendMailEmailId = str('CompanySendMailEmailId', S.CompanySendMailEmailId);
      S.CompanyMailServer = str('CompanyMailServer', S.CompanyMailServer);
      S.CompanyMailPassword = str('CompanyMailPassword', S.CompanyMailPassword);
      S.CompanyResellerURL = str('CompanyResellerURL', S.CompanyResellerURL);
      S.CompanyMerchantURL = str('CompanyMerchantURL', S.CompanyMerchantURL);
      S.AffiliateURL = str('AffiliateURL', S.AffiliateURL);
      S.NoReplyMail = str('NoReplyMail', S.NoReplyMail);
      S.AdminURLforImage = str('AdminURLforImage', S.AdminURLforImage);
      S.CompanyMailServerPort = int('CompanyMailServerPort', S.CompanyMailServerPort);
      S.CompanyFaviconIcon = str('CompanyFaviconIcon', S.CompanyFaviconIcon);
      S.CompanyLogo = str('CompanyLogo', S.CompanyLogo);
      S.CompanyTitle = str('CompanyTitle', S.CompanyTitle);
      S.CompanyContact = str('CompanyContact', S.CompanyContact);
      S.CompanyAdvertisement = str('CompanyAdvertisement', S.CompanyAdvertisement);
      S.CompanyServices = str('CompanyServices', S.CompanyServices);
      S.CompanyAPIUrl = str('CompanyAPIUrl', S.CompanyAPIUrl);
      S.CompanyCurrency = str('CompanyCurrency', S.CompanyCurrency);
      S.CompanyOAUTHURL = str('CompanyOAUTHURL', S.CompanyOAUTHURL);
      S.CompanyVALIDURL = str('CompanyVALIDURL', S.CompanyVALIDURL);
      S.CompanySCOPE = str('CompanySCOPE', S.CompanySCOPE);
      S.CompanyCLIENTID = str('CompanyCLIENTID', S.CompanyCLIENTID);
      S.CompanyREDIRECT = str('CompanyREDIRECT', S.CompanyREDIRECT);
      S.CompanyLOGOUT = str('CompanyLOGOUT', S.CompanyLOGOUT);
      S.ResellerLoginId = str('ResellerLoginId', S.ResellerLoginId);
      S.FACEBOOKCLIENTID = str('FACEBOOKCLIENTID', S.FACEBOOKCLIENTID);
      S.FACEBOOKCLIENTSECRET = str('FACEBOOKCLIENTSECRET', S.FACEBOOKCLIENTSECRET);
      S.CompanyPGMerchantKey = str('CompanyPGMerchantKey', S.CompanyPGMerchantKey);
      S.CompanyPGSalt = str('CompanyPGSalt', S.CompanyPGSalt);
      S.CompanyFacebookLink = str('CompanyFacebookLink', S.CompanyFacebookLink);
      S.CompanyGooglePlusLink = str('CompanyGooglePlusLink', S.CompanyGooglePlusLink);
      S.CompanyTwitterLink = str('CompanyTwitterLink', S.CompanyTwitterLink);
      S.CompanyPinterestLink = str('CompanyPinterestLink', S.CompanyPinterestLink);
      S.CompanyLinkedinLink = str('CompanyLinkedinLink', S.CompanyLinkedinLink);
      S.SMSAPI = str('SMSAPI', S.SMSAPI);
      S.DedicatedProductURL = str('DedicatedProductURL', S.DedicatedProductURL);
      S.PMID = int('PMID', S.PMID);
      S.CompanyAddress = str('CompanyAddress', S.CompanyAddress);
      S.TicketReplyAdmin = str('TicketReplyAdmin', S.TicketReplyAdmin);
      S.ProductBvIntstatus = int('ProductBvIntstatus', S.ProductBvIntstatus);
      S.ProductPvIntstatus = int('ProductPvIntstatus', S.ProductPvIntstatus);
      S.ProductActivationPV = int('ProductActivationPV', S.ProductActivationPV);
      S.ProductCashbackIntstatus = int('ProductCashbackIntstatus', S.ProductCashbackIntstatus);
      S.UtilityBvIntstatus = int('UtilityBvIntstatus', S.UtilityBvIntstatus);
      S.UtilityPvIntstatus = int('UtilityPvIntstatus', S.UtilityPvIntstatus);
      S.Playstorelink = str('Playstorelink', S.Playstorelink);
    } catch (e) {
      // legacy: empty catch
    }
  },
};

module.exports = CompanySettings;
module.exports.CompanySettings = CompanySettings;
module.exports.CompanyMasterSettings = CompanyMasterSettings;
