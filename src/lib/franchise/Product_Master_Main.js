/** Exports: class Product_Master_Main (table ims_masterproduct)
 *   async Product_Main_List(Int64 MPRID?) ; async Product_Main_ListOnCatId_ID(int catid) (MainCategoryId == catid, as in the C#) ; async Product_Main_ListOnMaincatId_ID(int) ;
 *   async Product_Main_ListOnSubCatId_ID(int) ; async Product_Main_OnID(Int64 MPRID) : obj|null ; async Product_Main_OnPrCode(string PrCode) : obj|null
 */
'use strict';
const { query, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['BranchId', 'catid', 'BrandId', 'CompanyId', 'CreatedDate', 'FullDescription', 'KeyFeatures', 'MainCategoryId', 'MaxOrderQty', 'MinOrderQty', 'ModifyDate', 'MPRID', 'Paymode', 'ProductCode', 'ProductTitle', 'ShotDescription', 'SubCategoryId', 'VatCategoryId'];
const nm = (o) => (o ? { ...o, MVat: 0 } : o); // [NotMapped]

class Product_Master_Main {
  async Product_Main_List(MPRID) {
    if (arguments.length === 0 || MPRID === undefined) {
      return mapRows(await query('shopping', 'select * from ims_masterproduct'), PROPS).map(nm);
    }
    return mapRows(await query('shopping', 'select * from ims_masterproduct where mprid=@MPRID', { MPRID }), PROPS).map(nm);
  }

  async Product_Main_ListOnCatId_ID(catid) {
    return mapRows(await query('shopping', 'select * from ims_masterproduct where maincategoryid=@catid', { catid }), PROPS).map(nm);
  }

  async Product_Main_ListOnMaincatId_ID(MainCatid) {
    return mapRows(await query('shopping', 'select * from ims_masterproduct where maincategoryid=@MainCatid', { MainCatid }), PROPS).map(nm);
  }

  async Product_Main_ListOnSubCatId_ID(subCatid) {
    return mapRows(await query('shopping', 'select * from ims_masterproduct where subcategoryid=@subCatid', { subCatid }), PROPS).map(nm);
  }

  async Product_Main_OnID(MPRID) {
    return nm(mapRow(await queryOne('shopping', 'select * from ims_masterproduct where mprid=@MPRID limit 1', { MPRID }), PROPS));
  }

  async Product_Main_OnPrCode(PrCode) {
    return nm(mapRow(await queryOne('shopping', 'select * from ims_masterproduct where productcode=@PrCode limit 1', { PrCode }), PROPS));
  }
}

module.exports = Product_Master_Main;
