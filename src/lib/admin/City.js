/** Exports: class CITY (table city; props Ctid, Cid, Sid, CityName, Active)
 *   (file Models/City.cs, class CITY; on case-insensitive file systems ./CITY resolves to this same file)
 *   async City_List_On_CID(int CID) : CITY[]  (Active && Cid, by CityName)
 *   async City_List_On_SID(int SID) : CITY[]  (Active && Sid, by CityName)
 *   async City_List_On_CTID(int ctid) : CITY | null  (Active && Ctid)
 *   async City_List_On_CityName(string Cityname) : CITY[]  (Active && CityName, by CityName)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('CITY', 'city', { Ctid: 0, Cid: 0, Sid: 0, CityName: null, Active: false });

class CITY extends Base {
  async City_List_On_CID(CID) {
    return Base.mapAll(await query(DB, 'select * from city where active::int=1 and cid=@CID order by cityname', { CID }));
  }

  async City_List_On_SID(SID) {
    return Base.mapAll(await query(DB, 'select * from city where active::int=1 and sid=@SID order by cityname', { SID }));
  }

  async City_List_On_CTID(ctid) {
    return Base.map(await queryOne(DB, 'select * from city where active::int=1 and ctid=@ctid order by cityname limit 1', { ctid }));
  }

  async City_List_On_CityName(Cityname) {
    return Base.mapAll(await query(DB, 'select * from city where active::int=1 and cityname=@Cityname order by cityname', { Cityname }));
  }
}

module.exports = CITY;
module.exports.CITY = CITY;
