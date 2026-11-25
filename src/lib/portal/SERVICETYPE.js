/** Exports: class SERVICETYPE (table tbl_servicetype; props STID, Service, ServiceType, BaseUrl, ImageName, ACTIVE)
 *   async GetServiceType() : SERVICETYPE[]   (ACTIVE == 1)
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['STID', 'Service', 'ServiceType', 'BaseUrl', 'ImageName', 'ACTIVE'];

class SERVICETYPE {
  async GetServiceType() {
    return mapRows(await query('shopping', 'select * from tbl_servicetype where active=1'), PROPS);
  }
}
SERVICETYPE.PROPS = PROPS;
SERVICETYPE.TABLE = 'tbl_servicetype';

module.exports = SERVICETYPE;
