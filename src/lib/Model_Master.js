/** Exports: class Model_Master (table model_master; props mid, bmid, ModelName, CatId, ScatId, PSCID, active)
 *   async Model_Master_List(int ScatID) : Model_Master[] | null (ScatID > 0: that ScatId; 0: all; active only, by ModelName; null on error / negative)
 */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['mid', 'bmid', 'ModelName', 'CatId', 'ScatId', 'PSCID', 'active'];

class Model_Master {
  async Model_Master_List(ScatID) {
    try {
      if (ScatID > 0) {
        return mapRows(await query('affiliate', 'select * from model_master where scatid=@ScatID and active::int=1 order by modelname', { ScatID }), PROPS);
      }
      if (ScatID === 0) {
        return mapRows(await query('affiliate', 'select * from model_master where active::int=1 order by modelname'), PROPS);
      }
      return null;
    } catch (ExpObj) {
      return null; // legacy: returns null (ErrorInsert block after it is unreachable)
    }
  }
}

module.exports = Model_Master;
