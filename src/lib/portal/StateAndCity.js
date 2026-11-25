/** Exports: class StateAndCity (props CTID, CityName, StateName, StateAndCityName; not an EF entity)
 *   async StateAndCityList(int cid) : StateAndCity[]   (city JOIN state on SID, city.CID == cid && city.ACTIVE, ordered by CITYNAME;
 *                                                        StateAndCityName = CITYNAME + " (" + STATENAME + ")")
 */
'use strict';
const { query } = require('../../db');

const PROPS = ['CTID', 'CityName', 'StateName', 'StateAndCityName'];

class StateAndCity {
  async StateAndCityList(cid) {
    const rows = await query('shopping',
      'select ct.ctid, ct.cityname, s.statename from city ct inner join state s on ct.sid = s.sid where ct.cid=@cid and ct.active::int=1 order by ct.cityname',
      { cid });
    return rows.map((Row) => ({
      CTID: Row.ctid,
      CityName: Row.cityname,
      StateName: Row.statename,
      StateAndCityName: (Row.cityname == null ? '' : Row.cityname) + ' (' + (Row.statename == null ? '' : Row.statename) + ')',
    }));
  }
}
StateAndCity.PROPS = PROPS;

module.exports = StateAndCity;
