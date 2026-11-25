/** Exports: class Country (table country; props Cid, CountryName, CurrencySymbol, ISDcode, cActive)
 *          class Location (no table; props IPAddress, CountryName, CountryCode, CityName, RegionName, ZipCode, Latitude, Longitude, TimeZone, Cid)
 *          class InitializeVisitorCountrySessionProp (no table; props COUNTRYNAME, MASTERSESSION, CID)
 *   static async CountryList() : Country[]  (cActive)
 *   static async CountryDetails(int Cid) : Country | null  /  static async CountryDetails(string CountryName) : Country | null
 *       -- C# overload: dispatched on typeof argument (string => by CountryName)
 *   async AllCountryList() : Country[]  (cActive)
 *   static async Country_Details(int Cid) : Country | null  (cActive && Cid)
 *   async InitializeVisitorCountrySession(req) : void   (ipinfodb lookup + [DBO].[USP_CREATEMASTERSESSION_M]; writes session keys
 *       COUNTRYID, COUNTRYNAME, IPADDRESS, StateName, ZIPCODE through utils/sessionStore)
 *   Country.Location, Country.InitializeVisitorCountrySessionProp : model classes (also ./Location, ./InitializeVisitorCountrySessionProp)
 *   Config key: IpInfoDbApiKey (legacy hard-coded api.ipinfodb.com key - never copied here)
 */
'use strict';
const axios = require('axios');
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');
const { query, queryOne, proc } = require('../../db');
const { defineModel, errorInsert, DB } = require('./_models');

const Base = defineModel('Country', 'country', { Cid: 0, CountryName: null, CurrencySymbol: null, ISDcode: null, cActive: false });
const Location = defineModel('Location', null, { IPAddress: null, CountryName: null, CountryCode: null, CityName: null, RegionName: null, ZipCode: null, Latitude: null, Longitude: null, TimeZone: null, Cid: 0 });
const InitializeVisitorCountrySessionProp = defineModel('InitializeVisitorCountrySessionProp', null, { COUNTRYNAME: null, MASTERSESSION: null, CID: 0 });

// JavaScriptSerializer.Deserialize<Location>: property names matched case-insensitively
function toLocation(obj) {
  const lower = {};
  for (const k of Object.keys(obj || {})) lower[k.toLowerCase()] = obj[k];
  const loc = new Location();
  for (const p of Location.PROPS) if (p.toLowerCase() in lower) loc[p] = lower[p.toLowerCase()];
  return loc;
}

class Country extends Base {
  static async CountryList() {
    return Base.mapAll(await query(DB, 'select * from country where cactive::int=1'));
  }

  static async CountryDetails(arg) {
    if (typeof arg === 'string') {
      const CountryName = arg;
      return Base.map(await queryOne(DB, 'select * from country where cactive::int=1 and countryname=@CountryName limit 1', { CountryName }));
    }
    const Cid = arg;
    return Base.map(await queryOne(DB, 'select * from country where cactive::int=1 and cid=@Cid limit 1', { Cid }));
  }

  async AllCountryList() {
    return Base.mapAll(await query(DB, 'select * from country where cactive::int=1'));
  }

  static async Country_Details(Cid) {
    return Base.map(await queryOne(DB, 'select * from country where cactive::int=1 and cid=@Cid limit 1', { Cid }));
  }

  // PORT-NOTE: HttpContext.Current.Request/Session => pass the Express `req`; session values are stored with utils/sessionStore.
  async InitializeVisitorCountrySession(req) {
    const put = (k, v) => sessionStore.set(req, k, v);
    try {
      let Cid = 0;
      let CountryName = '';
      let ipAddress = '';
      if (!ipAddress) {
        ipAddress = req.socket && req.socket.remoteAddress; // REMOTE_ADDR
        if (ipAddress) ipAddress = ipAddress.replace(/^::ffff:/i, ''); // PORT-NOTE: IPv4-mapped IPv6 prefix removed
      }
      if (ipAddress.includes(',')) {
        const indexof = ipAddress.indexOf(',');
        ipAddress = ipAddress.substring(0, indexof);
      }
      const APIKey = String(config.app.IpInfoDbApiKey || '');
      const url = `http://api.ipinfodb.com/v3/ip-city/?key=${APIKey}&ip=${ipAddress}&format=json`;
      const resp = await axios.get(url, { responseType: 'text', transformResponse: (d) => d, timeout: 100000 }); // WebClient.DownloadString
      const json = resp.data;
      const location = toLocation(JSON.parse(json));
      const locations = [];
      locations.push(location);
      if (sessionStore.get(req, 'COUNTRYNAME') === null || sessionStore.get(req, 'COUNTRYNAME') === undefined) {
        const rows = InitializeVisitorCountrySessionProp.mapAll(await proc(DB, 'usp_createmastersession_m', {
          countryname: location.CountryName.trim(),
          statename: location.RegionName.trim(),
          cityname: location.CityName.trim(),
        }));
        for (const r of rows) {
          Cid = parseInt(r.CID, 10) || 0;
          CountryName = r.COUNTRYNAME === null || r.COUNTRYNAME === undefined ? '' : String(r.COUNTRYNAME);
        }
        if (Cid > 0) {
          put('COUNTRYID', Cid.toString());
          put('COUNTRYNAME', CountryName);
          put('IPADDRESS', ipAddress);
          put('StateName', location.RegionName.trim());
          put('ZIPCODE', location.ZipCode.trim());
        } else {
          put('COUNTRYID', '96');
          put('COUNTRYNAME', 'India');
          put('IPADDRESS', ipAddress);
          put('StateName', 'Delhi');
          put('ZIPCODE', '110096');
        }
      }
    } catch (ExpObj) {
      await errorInsert(0, ExpObj.message, 'InitializeVisitorCountrySession', 0, 'Controllers/Model/Country');
      put('COUNTRYID', '96');
      put('COUNTRYNAME', 'India');
      put('IPADDRESS', '182.73.107.186');
      put('StateName', 'Delhi');
      put('ZIPCODE', '110096');
    }
  }
}

module.exports = Country;
module.exports.Location = Location;
module.exports.InitializeVisitorCountrySessionProp = InitializeVisitorCountrySessionProp;
