/** Exports: class Main_Product_Attributes (table ims_masterproductattribute)
 *   async Main_Product_Attributes_List() ; async Main_Product_Attributes_List_On_MPRID(double MPRID) (legacy ignores MPRID: all active) ; async Main_Product_Attributes_List_On_SPRID(double SPRID)
 *   async ProductArributeListBy_MPRID(double MPRID) (ims_usp_GetAttributesByMPRID) ; async ProductFeatureListBy_MPRID(double MPRID) : FeaturesList[]{Title,Value,Total} (IMS_USP_GETDISTINCTATTRIBUTESBYMPRID)
 *   async GetAttributeByMainCatId(int) (USP_GETATTRIBUTEBYMAINCATID) ; GetAttributeByCatId(int) (USP_GETATTRIBUTEBYCATID) ; GetAttributeBySubCatId(int) (USP_GETATTRIBUTEBYSUBCATID)
 *   async GetProductAttributeListByCategory(string Type, string Id) (usp_GetAttributeListByCategory @TYPE,@ID,@CAT_NAME OUT)
 */
'use strict';
const { query, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['AWCID', 'CatId', 'SubCatId', 'IsActive', 'Value', 'MPAID', 'Position', 'ShowOnGrid', 'SPRID', 'Title'];
const FEATURE = ['Title', 'Value', 'Total'];

class Main_Product_Attributes {
  async Main_Product_Attributes_List() {
    return mapRows(await query('shopping', 'select * from ims_masterproductattribute where isactive::int=1'), PROPS);
  }

  async Main_Product_Attributes_List_On_MPRID(MPRID) {
    return mapRows(await query('shopping', 'select * from ims_masterproductattribute where isactive::int=1'), PROPS);
  }

  async Main_Product_Attributes_List_On_SPRID(SPRID) {
    return mapRows(await query('shopping', 'select * from ims_masterproductattribute where isactive::int=1 and sprid=@SPRID', { SPRID }), PROPS);
  }

  async ProductArributeListBy_MPRID(MPRID) {
    return mapRows(await proc('shopping', 'ims_usp_getattributesbymprid', { mprid: MPRID }), PROPS);
  }

  async ProductFeatureListBy_MPRID(MPRID) {
    return mapRows(await proc('shopping', 'ims_usp_getdistinctattributesbymprid', { mprid: MPRID }), FEATURE);
  }

  async GetAttributeByMainCatId(MainCatId) {
    return mapRows(await proc('shopping', 'usp_getattributebymaincatid', { maincatid: MainCatId }), PROPS);
  }

  async GetAttributeByCatId(CatId) {
    return mapRows(await proc('shopping', 'usp_getattributebycatid', { catid: CatId }), PROPS);
  }

  async GetAttributeBySubCatId(SUBCATID) {
    return mapRows(await proc('shopping', 'usp_getattributebysubcatid', { subcatid: SUBCATID }), PROPS);
  }

  async GetProductAttributeListByCategory(Type, Id) {
    return mapRows(await proc('shopping', 'usp_getattributelistbycategory', { type: Type, id: Id }), PROPS);
  }
}

module.exports = Main_Product_Attributes;
