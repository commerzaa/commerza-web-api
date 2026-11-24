/** Exports: class Product_Counts (props countval, tcid, type, typeID)   async _product_count_list() : Product_Counts[]  (usp_getCountOfCatandSubCat) ; async _product_count_listMain() : Product_Counts[]  (usp_getCountOfMainCat)
 *   async getProductCount(string ProductName) : int   (count of verified/merchant-status-5 sub products with that master product title)
 */
'use strict';
const { proc, scalar } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['countval', 'tcid', 'type', 'typeID'];

class Product_Counts {
  async _product_count_list() {
    return mapRows(await proc('shopping', 'usp_getcountofcatandsubcat', {}), PROPS);
  }

  async _product_count_listMain() {
    return mapRows(await proc('shopping', 'usp_getcountofmaincat', {}), PROPS);
  }

  // PORT-NOTE: legacy concatenated the (quote-escaped) name into the SQL; now a bound parameter (same result).
  async getProductCount(ProductName) {
    if (ProductName === null || ProductName === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    const n = await scalar('shopping',
      'SELECT COUNT(*) FROM ims_masterproduct pm INNER JOIN ims_subproduct sm ON sm.mprid=pm.mprid WHERE sm.isverified IN (0,1,2,3) AND sm.ismerchantstatus=5 AND pm.producttitle=@ProductName',
      { ProductName });
    return Number(n) || 0;
  }
}

module.exports = Product_Counts;
