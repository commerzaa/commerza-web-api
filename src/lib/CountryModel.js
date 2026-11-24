/** Exports: class Country (Models/Country.cs; table country; props CID, COUNTRYNAME, CACTIVE, ISDCODE)
 *   async BindCountry() : Country[]  (usp_bindcountry @plid=1) ; async BindCountry1() : Country[] ; async AllCountryList() : Country[]  (CACTIVE = true)
 * NOTE: ./Country.js re-exports this class and also carries the DAL GetCountry statics (InitializeVisitorCountrySession, SettingVisitor).
 */
'use strict';
const { query, proc } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['CID', 'COUNTRYNAME', 'CACTIVE', 'ISDCODE'];

class Country {
  async BindCountry() {
    // legacy catch block rethrows the exception
    const country = mapRows(await proc('affiliate', 'usp_bindcountry', { plid: 1 }), PROPS);
    return country;
  }

  async BindCountry1() {
    const country = mapRows(await query('affiliate', 'select * from country'), PROPS);
    return country;
  }

  async AllCountryList() {
    return mapRows(await query('affiliate', 'select * from country where cactive::int=1'), PROPS);
  }
}

module.exports = Country;
