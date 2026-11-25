/** Exports: class MatchMaster (table tbl_matchmaster; props TMMID, MATCHTITLE, ISACTIVE)
 *   async matchmasterlist() : MatchMaster[]  (ISACTIVE == 1, by TMMID)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('MatchMaster', 'tbl_matchmaster', { TMMID: 0, MATCHTITLE: null, ISACTIVE: 0 });

class MatchMaster extends Base {
  async matchmasterlist() {
    return Base.mapAll(await query(DB, 'select * from tbl_matchmaster where isactive=1 order by tmmid'));
  }
}

module.exports = MatchMaster;
