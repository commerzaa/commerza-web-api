/** Exports: class Product_Counts (props countval, tcid, type, typeID; not an EF entity)
 *   async _product_count_list() : Product_Counts[]      (usp_getCountOfCatandSubCat)
 *   async _product_count_listMain() : Product_Counts[]  (usp_getCountOfMainCat)
 * Same as ../merchant/Product_Counts without getProductCount (that method does not exist in the portal C#).
 */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['countval', 'tcid', 'type', 'typeID'];

class Product_Counts {
  async _product_count_list() {
    return mapRows(await proc('shopping', 'usp_getcountofcatandsubcat', {}), PROPS);
  }

  async _product_count_listMain() {
    return mapRows(await proc('shopping', 'usp_getcountofmaincat', {}), PROPS);
  }
}
Product_Counts.PROPS = PROPS;

module.exports = Product_Counts;
