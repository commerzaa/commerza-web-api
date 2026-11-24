/** Exports: class Orderstatusmaster (table orderstatusmaster; props OSID, Statusname, status, createdate)   async AllOrderstatusMaster() : Orderstatusmaster[]  (status == 1) */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

class Orderstatusmaster {
  async AllOrderstatusMaster() {
    return mapRows(await query('shopping', 'select * from orderstatusmaster where status::int=1'), ['OSID', 'Statusname', 'status', 'createdate']);
  }
}

module.exports = Orderstatusmaster;
