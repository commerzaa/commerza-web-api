'use strict';
/**
 * Exports: class IMS_MasterProductAttribute (CartProduct/IMS_MasterProductAttribute.cs)
 *   async GetAttributeByMainCatId(MainCatId:int) -> List<IMS_MasterProductAttribute>
 *   async GetAttributeBySubCatId(SUBCATID:int)   -> List<IMS_MasterProductAttribute>
 *   async GetAttributeByCatId(CatId:int)         -> List<IMS_MasterProductAttribute>
 * Database: shopping (legacy Cart_Entity). Rows keep the C# property names.
 */
const { proc } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['MPAID', 'SPRID', 'Title', 'Value', 'ShowOnGrid', 'Position', 'IsActive', 'CatId', 'AWCID', 'SubCatId'];

class IMS_MasterProductAttribute {
  async GetAttributeByMainCatId(MainCatId) {
    return mapRows(await proc('shopping', 'usp_getattributebymaincatid', { maincatid: MainCatId }), PROPS);
  }

  async GetAttributeBySubCatId(SUBCATID) {
    return mapRows(await proc('shopping', 'usp_getattributebysubcatid', { subcatid: SUBCATID }), PROPS);
  }

  async GetAttributeByCatId(CatId) {
    return mapRows(await proc('shopping', 'usp_getattributebycatid', { catid: CatId }), PROPS);
  }
}

module.exports = IMS_MasterProductAttribute;
module.exports.IMS_MasterProductAttribute = IMS_MasterProductAttribute;
