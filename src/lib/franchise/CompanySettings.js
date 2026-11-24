/** Exports (C# static class CompanySettings, values from AppSettings => config.app, read lazily on every access):
 *  CompanyName, CompanyURL, CompanyDomain, CompanyAdminURL, CompanyInfoEmailId, CompanySupportEmailId, CompanySendMailEmailId, CompanyMailServer, CompanyMailPassword,
 *  CompanyResellerURL, CompanyMerchantURL, AffiliateURL, AdminURLforImage, CompanyFacebookLink, CompanyGooglePlusLink, CompanyTwitterLink, CompanyPinterestLink,
 *  CompanyLinkedinLink, Logo, Baseurl1, Baseurl2, Baseurl3, CompanyMailServerPort (int)
 *  Config keys needed in config.app (missing => ''): CompanyAdminURL, Logo, Baseurl1, Baseurl2, Baseurl3 ; (legacy AppSettings FacebookShare/GoogleplusShare/TwitterShare/PinterestShare/LinkedinShare
 *  are read from config.app.CompanyFacebookLink / CompanyGooglePlusLink / CompanyTwitterLink / CompanyPinterestLink / CompanyLinkedinLink).
 */
'use strict';
const config = require('../../config');

const s = (k) => (config.app[k] === undefined || config.app[k] === null ? '' : String(config.app[k]));
const map = {
  CompanyName: 'CompanyName', CompanyURL: 'CompanyURL', CompanyDomain: 'CompanyDomain', CompanyAdminURL: 'CompanyAdminURL',
  CompanyInfoEmailId: 'CompanyInfoEmailId', CompanySupportEmailId: 'CompanySupportEmailId', CompanySendMailEmailId: 'CompanySendMailEmailId',
  CompanyMailServer: 'CompanyMailServer', CompanyMailPassword: 'CompanyMailPassword', CompanyResellerURL: 'CompanyResellerURL',
  CompanyMerchantURL: 'CompanyMerchantURL', AffiliateURL: 'AffiliateURL', AdminURLforImage: 'AdminURLforImage',
  CompanyFacebookLink: 'CompanyFacebookLink', CompanyGooglePlusLink: 'CompanyGooglePlusLink', CompanyTwitterLink: 'CompanyTwitterLink',
  CompanyPinterestLink: 'CompanyPinterestLink', CompanyLinkedinLink: 'CompanyLinkedinLink', Logo: 'Logo',
  Baseurl1: 'Baseurl1', Baseurl2: 'Baseurl2', Baseurl3: 'Baseurl3',
};

const CompanySettings = {};
for (const [prop, key] of Object.entries(map)) {
  Object.defineProperty(CompanySettings, prop, { enumerable: true, get: () => s(key) });
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
