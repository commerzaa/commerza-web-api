/** Exports: class CITY (table city; props CTID, CID, SID, CITYNAME, ACTIVE)   async BindCITy(int SID) : CITY[] (active, by name) */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['CTID', 'CID', 'SID', 'CITYNAME', 'ACTIVE'];

class CITY {
  async BindCITy(SID) {
    return mapRows(await query('affiliate', 'select * from city where sid=@SID and active::int=1 order by cityname', { SID }), PROPS);
  }
}

module.exports = CITY;
