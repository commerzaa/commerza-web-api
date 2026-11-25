/** Exports: class googlemap
 *   async google(Int64 AdID) : void
 *     Looks up the latest Portal_Master row of the ad (max PMID for AD_ID), geocodes "<city>  <locality>" with the Google
 *     geocode XML API and inserts a LOCATIONS row (PMID, AREANAME=formatted_address, CITYNAME, LONGITUDE, LATITUDE, DISCRIPTION, ACTIVE=1).
 *     DB lookups throw like the C# (outside try); geocode/insert errors are swallowed like the C# empty catch. */
'use strict';
const axios = require('axios');
const { queryOne, exec } = require('../../db');

const DB = 'shopping';
const nre = () => new TypeError('Object reference not set to an instance of an object.');
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)); return m ? m[1] : null; };
const unxml = (s) => (s == null ? '' : String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim());

class googlemap {
  async google(AdID) {
    let pmid = 0;
    let city = ''; let locality = ''; let state = ''; let country = '';
    const mx = await queryOne(DB, 'select max(pmid) as pmid from portal_master where ad_id=@AdID', { AdID });
    if (!mx || mx.pmid == null) throw new Error('The cast to value type \'Int64\' failed because the materialized value is null.');
    pmid = parseInt(mx.pmid, 10);
    const pm = await queryOne(DB, 'select * from portal_master where pmid=@pmid limit 1', { pmid });
    if (!pm) throw nre();
    locality = pm.ad_area;
    city = pm.ad_city;
    state = pm.ad_state;
    const c = await queryOne(DB, 'select * from country where cid=@cid limit 1', { cid: pm.ad_cid });
    if (!c) throw nre();
    country = c.countryname;

    try {
      let add = ''; let lat = ''; let lang = '';
      const addres = (city == null ? '' : city) + '  ' + (locality == null ? '' : locality);
      const description = `${locality == null ? '' : locality} ${city == null ? '' : city}${state == null ? '' : state} ${country == null ? '' : country}`;
      const url = 'http://maps.google.com/maps/api/geocode/xml?address=' + encodeURI(addres) + '&sensor=false';
      const resp = await axios.get(url, { responseType: 'text', transformResponse: (d) => d });
      const xml = String(resp.data || '');
      // PORT-NOTE: DataSet.ReadXml over the response replaced by a small regex reader of <result>/<formatted_address>/<geometry><location><lat|lng>.
      const results = xml.match(/<result>[\s\S]*?<\/result>/g);
      if (!results) throw nre(); // dsResult.Tables["result"] is null when there is no result element
      for (const row of results) {
        const geometry = tag(row, 'geometry');
        const location = geometry ? tag(geometry, 'location') : null;
        if (!location) throw new RangeError('Index was outside the bounds of the array.');
        add = unxml(tag(row, 'formatted_address'));
        lat = unxml(tag(location, 'lat'));
        lang = unxml(tag(location, 'lng'));
      }
      await exec(DB, `insert into locations (pmid, areaname, cityname, longitude, latitude, discription, active)
        values (@pmid, @add, @city, @lang, @lat, @description, '1')`, { pmid, add, city, lang, lat, description });
    } catch (e) {
      // Response.Redirect("Error.html");  (empty catch in the C#)
    }
  }
}

module.exports = googlemap;
