/** Exports: class Product_Sub_Category (table tbl_sub_category; props AdminCharge, catId, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, maincatId, sequence, status, sub_cat_code, sub_cat_imgname, subcatId, subcatname ; [NotMapped] IsSelected)
 *          class Product_Sub_CategoryList (no table; props AdminCharge, catId, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, maincatId, sequence, status, sub_cat_code, sub_cat_imgname, subcatId, subcatname)
 *          class BranchViewModel (no table; props BranchId, IsVerified)
 *   async deletealltypecategory(int id, string type) : string  (proc [USP_delete_alltypeCategory] @id,@type,@varResult out)
 *   async insertalltypecategory(int id, string type, string value) : string  (proc USP_insert_alltypeCategory @id,@value,@type,@varResult out)
 *   async insertalltypecategoryAtOnce(int id, string type, string value, string image) : string  (proc [USP_insert_alltypeCategory_new] @id,@value,@type,@image,@varResult out; result trimmed of spaces and '~')
 *   async insertalltypecategoryAtOnce(int id, string type, string value) : string  (same proc without @image)  -- C# overload: dispatched on argument count
 *   async Product_Sub_Category_List() : Product_Sub_Category[] | null  (status && !isDelete, by sequence; errors => null)
 *   async Product_Sub_Category_List(int Catid) : Product_Sub_Category[] | null  (Catid > 0 ? catId && status && !isDelete by sequence : null; errors => null)
 *   async stringForUpdateallidsinsequence(string allids) : string  (proc usp_updateAllItemsSorted @sortedvalue,@strResult out)
 *   async updateallcategory(int id, string type, string value) : string  (proc USP_update_alltypeCategory @id,@value,@type,@varResult out)
 *   async SubProductCategory(Int32 Id) : Product_Sub_Category | null  (status && !isDelete && subcatId)
 *   Product_Sub_Category.Product_Sub_CategoryList, Product_Sub_Category.BranchViewModel : classes (also ./Product_Sub_CategoryList, ./BranchViewModel)
 *     BranchViewModel: BranchId, IsVerified, Category / MasterCategory / SubCategory (always the instance's own lists; setters ignored like the C#)
 * Not reused from ../franchise/Product_Sub_Category.js: different C# (more methods) and database ('affiliate' here).
 */
'use strict';
const { query, queryOne, procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('Product_Sub_Category', 'tbl_sub_category', { AdminCharge: null, catId: 0, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, maincatId: 0, sequence: 0, status: false, sub_cat_code: null, sub_cat_imgname: null, subcatId: 0, subcatname: null }, ['IsSelected']);
const Product_Sub_CategoryList = defineModel('Product_Sub_CategoryList', null, { AdminCharge: null, catId: 0, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, maincatId: 0, sequence: 0, status: false, sub_cat_code: null, sub_cat_imgname: null, subcatId: 0, subcatname: null });

const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped] IsSelected

// C# string.Trim().Trim('~').Trim()
const trimTilde = (s) => s.trim().replace(/^~+|~+$/g, '').trim();

class BranchViewModel {
  constructor(init) {
    const category = [];
    const mastercategory = [];
    const subcategory = [];
    this.BranchId = 0;
    Object.defineProperty(this, 'Category', { enumerable: true, get: () => category, set: () => {} });
    this.IsVerified = false;
    Object.defineProperty(this, 'MasterCategory', { enumerable: true, get: () => mastercategory, set: () => {} });
    Object.defineProperty(this, 'SubCategory', { enumerable: true, get: () => subcategory, set: () => {} });
    if (init) Object.assign(this, init);
  }
}
BranchViewModel.PROPS = ['BranchId', 'Category', 'IsVerified', 'MasterCategory', 'SubCategory'];
BranchViewModel.TABLE = null;

class Product_Sub_Category extends Base {
  async deletealltypecategory(id, type) {
    const row = await procOne(DB, 'usp_delete_alltypecategory', { id, type });
    const getountput = toStr(out(row, 'varResult'));
    return getountput.toString();
  }

  async insertalltypecategory(id, type, value) {
    const row = await procOne(DB, 'usp_insert_alltypecategory', { id, value, type });
    const getountput = toStr(out(row, 'varResult'));
    return getountput.toString();
  }

  async insertalltypecategoryAtOnce(id, type, value, ...rest) {
    let row;
    if (rest.length >= 1) {
      const image = rest[0];
      row = await procOne(DB, 'usp_insert_alltypecategory_new', { id, value, type, image });
    } else {
      row = await procOne(DB, 'usp_insert_alltypecategory_new', { id, value, type });
    }
    const getountput = trimTilde(toStr(out(row, 'varResult')));
    return getountput.toString();
  }

  async Product_Sub_Category_List(...args) {
    try {
      if (args.length === 0) {
        return Base.mapAll(await query(DB, 'select * from tbl_sub_category where status::int=1 and isdelete::int=0 order by sequence')).map(nm);
      }
      const Catid = args[0];
      if (Catid > 0) {
        return Base.mapAll(await query(DB, 'select * from tbl_sub_category where catid=@Catid and status::int=1 and isdelete::int=0 order by sequence', { Catid })).map(nm);
      } else {
        return null;
      }
    } catch (ex) {
      return null;
    }
  }

  async stringForUpdateallidsinsequence(allids) {
    const row = await procOne(DB, 'usp_updateallitemssorted', { sortedvalue: allids });
    const getountput = toStr(out(row, 'strResult'));
    return getountput.toString();
  }

  async updateallcategory(id, type, value) {
    const row = await procOne(DB, 'usp_update_alltypecategory', { id, value, type });
    const getountput = toStr(out(row, 'varResult'));
    return getountput.toString();
  }

  async SubProductCategory(Id) {
    return nm(Base.map(await queryOne(DB, 'select * from tbl_sub_category where status::int=1 and isdelete::int=0 and subcatid=@Id limit 1', { Id })));
  }
}

module.exports = Product_Sub_Category;
module.exports.Product_Sub_CategoryList = Product_Sub_CategoryList;
module.exports.BranchViewModel = BranchViewModel;
