/** Exports: class Brand_Master (table brand_master; props bmid, PSCID, BrandName, CatId, ScatId, active)
 *   async Brand_Master_List(int ScatID) : Brand_Master[] | null  (ScatID > 0: that ScatId; 0: all; active only, by BrandName; null when ScatID < 0 or on error)
 * PORT-NOTE: table dbo.Brand_master is not present in the Db_Shopping schema dump; the query keeps the EF entity's table/columns.
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['bmid', 'PSCID', 'BrandName', 'CatId', 'ScatId', 'active'];

class Brand_Master {
  async Brand_Master_List(ScatID) {
    try {
      if (ScatID > 0) {
        return mapRows(await query('shopping', 'select * from brand_master where scatid=@ScatID and active::int=1 order by brandname', { ScatID }), PROPS);
      }
      if (Number(ScatID) === 0) {
        return mapRows(await query('shopping', 'select * from brand_master where active::int=1 order by brandname'), PROPS);
      }
      return null;
    } catch (ex) {
      return null;
    }
  }
}
Brand_Master.PROPS = PROPS;
Brand_Master.TABLE = 'brand_master';

module.exports = Brand_Master;
