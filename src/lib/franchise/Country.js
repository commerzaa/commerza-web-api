/** Exports: class Country (table country; props CID, COUNTRYNAME)   async BindCountry() : Country[]  (usp_bindcountry @plid=1; exceptions propagate) */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

class Country {
  async BindCountry() {
    const country = mapRows(await proc('shopping', 'usp_bindcountry', { plid: 1 }), ['CID', 'COUNTRYNAME']);
    return country;
  }
}

module.exports = Country;
