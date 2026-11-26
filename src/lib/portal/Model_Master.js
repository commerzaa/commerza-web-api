/** Exports: class Model_Master (table model_master; props mid, bmid, ModelName, CatId, ScatId, PSCID, active)
 *   async Model_Master_List(int ScatID) : Model_Master[] | null  (ScatID > 0: that ScatId; 0: all; active only, by ModelName; null when ScatID < 0 or on error)
 * Same logic as ../Model_Master (API port) but on Db_Shopping (portal DataBaseContext).
 * PORT-NOTE: table dbo.model_master is not present in the Db_Shopping schema dump; the query keeps the EF entity's table/columns.
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['mid', 'bmid', 'ModelName', 'CatId', 'ScatId', 'PSCID', 'active'];

class Model_Master {
  async Model_Master_List(ScatID) {
    try {
      if (ScatID > 0) {
        return mapRows(await query('shopping', 'select * from model_master where scatid=@ScatID and active::int=1 order by modelname', { ScatID }), PROPS);
      }
      if (Number(ScatID) === 0) {
        return mapRows(await query('shopping', 'select * from model_master where active::int=1 order by modelname'), PROPS);
      }
      return null;
    } catch (ex) {
      return null;
    }
  }
}
Model_Master.PROPS = PROPS;
Model_Master.TABLE = 'model_master';

module.exports = Model_Master;
