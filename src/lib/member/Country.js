/** Exports: class Country (Models/Country.cs: BindCountry, BindCountry1, AllCountryList) - same as ../CountryModel.js (identical C#, database 'affiliate').
 *  ../Country.js attaches the DAL GetCountry statics (InitializeVisitorCountrySession, SettingVisitor) to that same class; it is loaded
 *  here so they exist regardless of require order (member modules call Country.SettingVisitor / InitializeVisitorCountrySession).
 */
require('../Country');
module.exports = require('../CountryModel');
