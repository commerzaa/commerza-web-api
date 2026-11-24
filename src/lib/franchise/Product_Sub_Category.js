/** Exports: class Product_Sub_Category (table tbl_sub_category)  (BranchViewModel / Product_Sub_CategoryList are plain property bags: not ported)
 *   async deletealltypecategory(int id, string type) : string      (USP_delete_alltypeCategory, @varResult out)
 *   async insertalltypecategory(int id, string type, string value) : string   (USP_insert_alltypeCategory)
 *   async insertalltypecategoryAtOnce(int id, string type, string value, string image?) : string  (USP_insert_alltypeCategory_new; result trimmed of whitespace and '~'; 3 or 4 args)
 *   async Product_Sub_Category_List(int Catid?) : Product_Sub_Category[]|null   (null on error, or when Catid given and <= 0)
 *   async stringForUpdateallidsinsequence(string allids) : string  (usp_updateAllItemsSorted)
 *   async updateallcategory(int id, string type, string value) : string  (USP_update_alltypeCategory)
 *   async SubProductCategory(int Id) : Product_Sub_Category|null
 */
'use strict';
const { query, queryOne, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { outValue } = require('../_http');

const PROPS = ['AdminCharge', 'catId', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'maincatId', 'sequence', 'status', 'sub_cat_code', 'sub_cat_imgname', 'subcatId', 'subcatname', 'DelieveryCharge', 'HandlingCharge', 'FixedFee'];
const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped]
const trimTilde = (s) => s.trim().replace(/^~+|~+$/g, '').trim(); // .Trim().Trim('~').Trim()

class Product_Sub_Category {
  async deletealltypecategory(id, type) {
    return outValue(await procOne('shopping', 'usp_delete_alltypecategory', { id, type }), 'varResult');
  }

  async insertalltypecategory(id, type, value) {
    return outValue(await procOne('shopping', 'usp_insert_alltypecategory', { id, value, type }), 'varResult');
  }

  async insertalltypecategoryAtOnce(id, type, value, image) {
    const p = { id, value, type };
    if (arguments.length >= 4) p.image = image;
    return trimTilde(outValue(await procOne('shopping', 'usp_insert_alltypecategory_new', p), 'varResult'));
  }

  async Product_Sub_Category_List(Catid) {
    try {
      if (arguments.length === 0 || Catid === undefined) {
        return mapRows(await query('shopping', 'select * from tbl_sub_category where status::int=1 and isdelete::int=0 order by sequence'), PROPS).map(nm);
      }
      if (Catid > 0) {
        return mapRows(await query('shopping', 'select * from tbl_sub_category where catid=@Catid and status::int=1 and isdelete::int=0 order by sequence', { Catid }), PROPS).map(nm);
      }
      return null;
    } catch (ex) {
      return null;
    }
  }

  async stringForUpdateallidsinsequence(allids) {
    return outValue(await procOne('shopping', 'usp_updateallitemssorted', { sortedvalue: allids }), 'strResult');
  }

  async updateallcategory(id, type, value) {
    return outValue(await procOne('shopping', 'usp_update_alltypecategory', { id, value, type }), 'varResult');
  }

  async SubProductCategory(Id) {
    return nm(mapRow(await queryOne('shopping', 'select * from tbl_sub_category where status::int=1 and isdelete::int=0 and subcatid=@Id limit 1', { Id }), PROPS));
  }
}

module.exports = Product_Sub_Category;
