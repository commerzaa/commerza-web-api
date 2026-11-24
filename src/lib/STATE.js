/** Exports: class STATE (table state; props SID, CID, STATENAME, SCODE, SACTIVE)
 *   async BindSTATE() : STATE[] (CID 96, active, by name) ; async BINDSTATEONCID(int CID) : STATE[]
 */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['SID', 'CID', 'STATENAME', 'SCODE', 'SACTIVE'];

class STATE {
  async BindSTATE() {
    return mapRows(await query('affiliate', 'select * from state where cid=96 and sactive::int=1 order by statename'), PROPS);
  }

  async BINDSTATEONCID(CID) {
    return mapRows(await query('affiliate', 'select * from state where cid=@CID and sactive::int=1 order by statename', { CID }), PROPS);
  }
}

module.exports = STATE;
