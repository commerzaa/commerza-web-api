/**
 * Exports: class MapLocation { async UpdateMapLocations(Int32 PMID, string LATITUDE, string LONGITUDE, string FORMATEDADD): string }  (internal in C#)
 */
'use strict';
const db = require('../../db');
const { outValue } = require('../_http');

class MapLocation {
  async UpdateMapLocations(PMID, LATITUDE, LONGITUDE, FORMATEDADD) {
    let ResultOutPut = '';
    try {
      const row = await db.procOne('shopping', 'usp_updatinglatitude_formated_add', {
        pmid: PMID, latitude: LATITUDE, longitude: LONGITUDE, formatedadd: FORMATEDADD,
      });
      ResultOutPut = outValue(row, 'STRRESULT'); // @STRRESULT OUT
    } catch (ex) {
      ResultOutPut = String(ex && ex.message);
    }
    return ResultOutPut;
  }
}

module.exports = MapLocation;
