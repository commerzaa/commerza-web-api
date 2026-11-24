/** Exports: class Prodct_SubCat_Type (table productsubcat_type; props PSCID, TypeName, CatId, ScatId, TypeStatus)
 *   async Prodct_SubCat_Type_List(int ScatID) : Prodct_SubCat_Type[] | null (null on error; ScatId = ScatID and TypeStatus true, by TypeName)
 */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['PSCID', 'TypeName', 'CatId', 'ScatId', 'TypeStatus'];

class Prodct_SubCat_Type {
  async Prodct_SubCat_Type_List(ScatID) {
    try {
      return mapRows(await query('affiliate', 'select * from productsubcat_type where scatid=@ScatID and typestatus::int=1 order by typename', { ScatID }), PROPS);
    } catch (ExpObj) {
      return null; // legacy: returns null (ErrorInsert block after it is unreachable)
    }
  }
}

module.exports = Prodct_SubCat_Type;
