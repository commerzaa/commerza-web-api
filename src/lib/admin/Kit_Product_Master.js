/** Exports: class Kit_Product_Master (table tbl_kitproductmaster; props TKPMID, PrCode, NAME, ProductName, ProductCode, ProductDescription, IsActive, Status, UNITID, UNIT, ISNEWOFFER, ISNEWARRIVAL, ISBIGSAVING, ISFESTIVALOFFER, ISQUICKSHOP ; [NotMapped] ProductName, ProductCode, ProductDescription, IsActive)
 *   async GetallKitProductList() : Kit_Product_Master[]  (by TKPMID)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Kit_Product_Master', 'tbl_kitproductmaster', { TKPMID: 0, PrCode: null, NAME: null, ProductName: null, ProductCode: null, ProductDescription: null, IsActive: 0, Status: 0, UNITID: null, UNIT: 0, ISNEWOFFER: 0, ISNEWARRIVAL: 0, ISBIGSAVING: 0, ISFESTIVALOFFER: 0, ISQUICKSHOP: 0 }, ['ProductName', 'ProductCode', 'ProductDescription', 'IsActive']);

class Kit_Product_Master extends Base {
  async GetallKitProductList() {
    return Base.mapAll(await query(DB, 'select * from tbl_kitproductmaster order by tkpmid'));
  }
}

module.exports = Kit_Product_Master;
