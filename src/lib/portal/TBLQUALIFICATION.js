/** Exports: class TBLQUALIFICATION (table tblqualification; static PROPS ['QID','NAME','STATUS'], static TABLE)
 *   async GetQualification() : TBLQUALIFICATION[]  (STATUS == 1)
 *  Same logic as ../TBLQUALIFICATION (API port) but the portal's DataBaseContext is Db_Shopping, so this copy uses 'shopping'. */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['QID', 'NAME', 'STATUS'];

class TBLQUALIFICATION {
  async GetQualification() {
    return mapRows(await query('shopping', 'select * from tblqualification where status=1'), PROPS);
  }
}
TBLQUALIFICATION.PROPS = PROPS;
TBLQUALIFICATION.TABLE = 'tblqualification';

module.exports = TBLQUALIFICATION;
