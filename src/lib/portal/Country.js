/** Exports: class Country (table country; props CID, COUNTRYNAME, ISDCODE)
 *   async BindCountry(Int64 Cid?) : Country[]   (usp_bindcountry_Customer @plid = Cid, or 1 when called without argument; exceptions propagate)
 *   async BindISDCode() : Country[]             (select CID, COUNTRYNAME, '+' + ISDCODE as ISDCODE from country)
 * Differs from ../merchant/Country (usp_bindcountry, no ISDCODE): portal calls usp_bindcountry_Customer and has BindISDCode / BindCountry(Cid).
 */
'use strict';
const { query, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['CID', 'COUNTRYNAME', 'ISDCODE'];

class Country {
  // C# overloads BindCountry(Int64 Cid) and BindCountry() (=> @plid = 1)
  async BindCountry(Cid) {
    const plid = arguments.length === 0 || Cid === undefined ? 1 : Cid;
    const country = mapRows(await proc('shopping', 'usp_bindcountry_customer', { plid }), PROPS);
    return country;
  }

  async BindISDCode() {
    // T-SQL '+' + NULL => NULL ; PostgreSQL || behaves the same
    return mapRows(await query('shopping', "select cid, countryname, ('+' || isdcode) as isdcode from country"), PROPS);
  }
}
Country.PROPS = PROPS;
Country.TABLE = 'country';

module.exports = Country;
