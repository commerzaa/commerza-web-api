/** Exports: class STATE (table state; props SID, CID, STATENAME, SCODE, SACTIVE)   async BindSTATE() : STATE[]  (CID 96, active, by STATENAME) */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

class STATE {
  async BindSTATE() {
    return mapRows(await query('shopping', 'select * from state where cid=96 and sactive::int=1 order by statename'), ['SID', 'CID', 'STATENAME', 'SCODE', 'SACTIVE']);
  }
}

module.exports = STATE;
