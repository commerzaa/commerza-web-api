/** Exports: class Prodct_SubCat_Type (table productsubcat_type; props PSCID, TypeName, CatId, ScatId, TypeStatus)
 *   async Prodct_SubCat_Type_List(int ScatID) : Prodct_SubCat_Type[] | null  (ScatId == ScatID && TypeStatus, by TypeName; null on error)
 * PORT-NOTE: table dbo.ProductSubCat_Type is not present in the Db_Shopping schema dump; the query keeps the EF entity's table/columns.
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['PSCID', 'TypeName', 'CatId', 'ScatId', 'TypeStatus'];

class Prodct_SubCat_Type {
  async Prodct_SubCat_Type_List(ScatID) {
    try {
      return mapRows(await query('shopping', 'select * from productsubcat_type where scatid=@ScatID and typestatus::int=1 order by typename', { ScatID }), PROPS);
    } catch (ex) {
      return null;
    }
  }
}
Prodct_SubCat_Type.PROPS = PROPS;
Prodct_SubCat_Type.TABLE = 'productsubcat_type';

module.exports = Prodct_SubCat_Type;
