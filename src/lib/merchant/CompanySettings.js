/** Exports (C# static class CompanySettings, values from AppSettings => config.app, read lazily on every access):
 *  CompanyName, CompanyURL, CompanyDomain, CompanyAdminURL, CompanyInfoEmailId, CompanySupportEmailId, CompanySendMailEmailId, CompanyMailServer, CompanyMailPassword,
 *  CompanyResellerURL, CompanyMerchantURL, AdminURLforImage, CompanyDomainLogo, FacebookShare, TwitterShare, GoogleplusShare, LinkedinShare, PinterestShare,
 *  Baseurl1, Baseurl2, Baseurl3, Baseurl4, CompanyMailServerPort (int)
 *  Config keys needed in config.app (missing => ''): CompanyAdminURL, CompanyDomainLogo, FacebookShare, TwitterShare, GoogleplusShare, LinkedinShare, PinterestShare, Baseurl1..Baseurl4
 *  (franchise-only AffiliateURL, CompanyFacebookLink/GooglePlusLink/TwitterLink/PinterestLink/LinkedinLink and Logo do NOT exist in the Merchant C#).
 */
'use strict';
const config = require('../../config');

const s = (k) => (config.app[k] === undefined || config.app[k] === null ? '' : String(config.app[k]));
const keys = [
  'CompanyName', 'CompanyURL', 'CompanyDomain', 'CompanyAdminURL', 'CompanyInfoEmailId', 'CompanySupportEmailId', 'CompanySendMailEmailId',
  'CompanyMailServer', 'CompanyMailPassword', 'CompanyResellerURL', 'CompanyMerchantURL', 'AdminURLforImage', 'CompanyDomainLogo',
  'FacebookShare', 'TwitterShare', 'GoogleplusShare', 'LinkedinShare', 'PinterestShare', 'Baseurl1', 'Baseurl2', 'Baseurl3', 'Baseurl4',
];

const CompanySettings = {};
for (const k of keys) {
  Object.defineProperty(CompanySettings, k, { enumerable: true, get: () => s(k) });
}
Object.defineProperty(CompanySettings, 'CompanyMailServerPort', {
  enumerable: true,
  get: () => {
    const n = parseInt(s('CompanyMailServerPort'), 10);
    if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); // Convert.ToInt32
    return n;
  },
});

module.exports = CompanySettings;
