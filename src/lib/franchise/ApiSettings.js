/** Exports: class ApiSettings (table tbl_emailmembermaster; props TEMID, EMAILID)   async GETALLAPILIST(int PLID) : ApiSettings[]  (DBO.GETALLAPISETTING @PLID) */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

class ApiSettings {
  async GETALLAPILIST(PLID) {
    const API_SETTING = mapRows(await proc('shopping', 'getallapisetting', { plid: PLID }), ['TEMID', 'EMAILID']);
    return API_SETTING;
  }
}

module.exports = ApiSettings;
