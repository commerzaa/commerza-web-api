/** Exports: class PORTAL_PICKUPLOCATION (table portal_pickuplocation)   async allPickupList(string LoginID) : PORTAL_PICKUPLOCATION[]  (ISACTIVE = 1 and LOGINID_REF = LoginID) */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['PPLID', 'LOGINID_REF', 'PICKUP_LOCATION', 'NAME', 'EMAILID', 'PHONE', 'ADDRESS_1', 'ADDRESS_2', 'CITY', 'STATE', 'COUNTRY', 'PINCODE', 'CREATED_DATE', 'CREATED_BY', 'UPDATED_DATE', 'UPDATED_BY', 'ISACTIVE'];

class PORTAL_PICKUPLOCATION {
  async allPickupList(LoginID) {
    return mapRows(await query('shopping', 'select * from portal_pickuplocation where isactive::int=1 and loginid_ref=@LoginID', { LoginID }), PROPS);
  }
}

module.exports = PORTAL_PICKUPLOCATION;
