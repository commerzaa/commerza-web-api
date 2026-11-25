/** Exports: class Product_Cat_And_SubCat (props _Product_Category, _Product_Sub_Category; not an EF entity)
 *   async Product_Cat_And_SubCat_List() : this  (fills _Product_Category = product_category where CATACTIVE,
 *                                                 _Product_Sub_Category = product_subcategory where SCATACTIVE; returns the instance)
 * Row shapes use ./Product_Category.PROPS and ./Product_Subcategory.PROPS.
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

class Product_Cat_And_SubCat {
  constructor() {
    this._Product_Category = null;
    this._Product_Sub_Category = null;
  }

  async Product_Cat_And_SubCat_List() {
    const Product_Category = require('./Product_Category');
    const Product_Subcategory = require('./Product_Subcategory');
    this._Product_Category = mapRows(await query('shopping', 'select * from product_category where catactive::int=1'), Product_Category.PROPS);
    this._Product_Sub_Category = mapRows(await query('shopping', 'select * from product_subcategory where scatactive::int=1'), Product_Subcategory.PROPS);
    return this;
  }
}
Product_Cat_And_SubCat.PROPS = ['_Product_Category', '_Product_Sub_Category'];

module.exports = Product_Cat_And_SubCat;
