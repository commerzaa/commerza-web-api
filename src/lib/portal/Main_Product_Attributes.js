/** Exports: class Main_Product_Attributes (table ims_masterproductattribute) -- extends ../merchant/Main_Product_Attributes (identical methods inherited):
 *   async Main_Product_Attributes_List() ; Main_Product_Attributes_List_On_MPRID(double) ; Main_Product_Attributes_List_On_SPRID(double)
 *   async ProductArributeListBy_MPRID(double MPRID) ; GetAttributeByMainCatId(int) ; GetAttributeByCatId(int) ; GetAttributeBySubCatId(int)
 *   async GetProductAttributeListByCategory(string Type, string Id)
 *  Portal-specific (overridden / added):
 *   async ProductFeatureListBy_MPRID(double MPRID) : FeaturesList[]{Title,Value,Total,sprid}  (DBO.ims_usp_GetDistinctAttributesByMPRID)
 *   async PRODUCTARRIBUTELISTCOLORSIZE_MPRID(double MPRID) : SIZECOLORLIST[]          (ims_usp_GetAttributesByCOLORSIZEMPRID @MPRID)
 *   async GETPRODUCTSPRIDBYATTRIBUTES(string Title, string color) : ATTRIBUTESCOLORSIZELIST[]  (DBO.USP_GETPRODUCTSPRIDBYATTRIBUTES @PRODUCTTITLE,@COLOR)
 *   async GETALLPRODUCTSPRIDBYATTRIBUTES(string Title) : ATTRIBUTESLIST[]              (DBO.USP_AllGETPRODUCTSPRIDBYATTRIBUTES @PRODUCTTITLE)
 *   async GETALLPRODUCTSPRIDBYATTRIBUTES_Temp(string Title) : ATTRIBUTESLIST[]         (DBO.USP_AllGETPRODUCTSPRIDBYATTRIBUTES_TEMP @PRODUCTTITLE)
 *   async getRelatedProductSpridByAttributes(string anchrurl, string productTitle, string attrFilterTitle) : ATTRIBUTESLIST[]
 *         (anchrurl split on '&', each part UtilityClass.Decryptword'ed and joined with '~'; USP_GETOTHERPRODUCTSPRIDBYATTRIBUTES;
 *          keeps only the first TITLE group, de-duplicated by VALUE)
 *   static PROPS / TABLE ; static FeaturesList / ATTRIBUTESCOLORSIZELIST / ATTRIBUTESLIST / SIZECOLORLIST = { PROPS }
 * PORT-NOTE: procedure USP_AllGETPRODUCTSPRIDBYATTRIBUTES_TEMP is not present in the Db_Shopping schema dump; it is called by name as in C#.
 */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const Base = require('../merchant/Main_Product_Attributes');

const PROPS = ['AWCID', 'CatId', 'SubCatId', 'IsActive', 'MPAID', 'Position', 'ShowOnGrid', 'SPRID', 'Title', 'Value'];
const FEATURE = ['Title', 'Value', 'Total', 'sprid'];
const COLORSIZE = ['SPRID', 'COLOR', 'SIZE', 'ISACTIVE'];
const ATTRLIST = ['SPRID', 'TITLE', 'VALUE', 'IS_SELECTED', 'HELPER_URL', 'IS_AVAILABLE'];
const SIZECOLOR = ['Title', 'Value', 'SPRID'];
// SqlQuery<ATTRIBUTESLIST>: non-returned bool members default to false
const attrDefaults = (r) => ({ ...r, IS_SELECTED: r.IS_SELECTED === null ? false : r.IS_SELECTED, IS_AVAILABLE: r.IS_AVAILABLE === null ? false : r.IS_AVAILABLE });

class Main_Product_Attributes extends Base {
  async ProductFeatureListBy_MPRID(MPRID) {
    return mapRows(await proc('shopping', 'ims_usp_getdistinctattributesbymprid', { mprid: MPRID }), FEATURE);
  }

  async PRODUCTARRIBUTELISTCOLORSIZE_MPRID(MPRID) {
    return mapRows(await proc('shopping', 'ims_usp_getattributesbycolorsizemprid', { mprid: MPRID }), SIZECOLOR);
  }

  async GETPRODUCTSPRIDBYATTRIBUTES(Title, color) {
    return mapRows(await proc('shopping', 'usp_getproductspridbyattributes', { producttitle: Title, color }), COLORSIZE);
  }

  async GETALLPRODUCTSPRIDBYATTRIBUTES(Title) {
    return mapRows(await proc('shopping', 'usp_allgetproductspridbyattributes', { producttitle: Title }), ATTRLIST).map(attrDefaults);
  }

  async GETALLPRODUCTSPRIDBYATTRIBUTES_Temp(Title) {
    return mapRows(await proc('shopping', 'usp_allgetproductspridbyattributes_temp', { producttitle: Title }), ATTRLIST).map(attrDefaults);
  }

  async getRelatedProductSpridByAttributes(anchrurl, productTitle, attrFilterTitle) {
    const UtilityClass = require('./UtilityClass');
    let filterAttrValue = '';
    if (anchrurl === null || anchrurl === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    const queryString = String(anchrurl).split('&');
    for (let i = 0; i < queryString.length; i++) {
      if (i === 0) {
        filterAttrValue = await UtilityClass.Decryptword(queryString[i]);
      } else {
        filterAttrValue = filterAttrValue + '~' + (await UtilityClass.Decryptword(queryString[i]));
      }
    }

    // Check For Available Related Other Attr On Behalf Of Selected Product Title And Selected Attr
    let attributesList = mapRows(await proc('shopping', 'usp_getotherproductspridbyattributes', {
      producttitle: productTitle,
      attrfiltertitle: attrFilterTitle,
      attrfiltervalue: filterAttrValue,
    }), ATTRLIST).map(attrDefaults);
    if (attributesList && attributesList.length > 0) {
      // GroupBy(TITLE) keeps first-appearance order; only the first group is used (loop breaks after it)
      const firstTitle = attributesList[0].TITLE;
      const list = attributesList.filter((x) => x.TITLE === firstTitle);
      attributesList = [];
      const seen = new Set();
      for (const item of list) {
        const key = item.VALUE === null || item.VALUE === undefined ? '\u0000null' : String(item.VALUE);
        if (seen.has(key)) continue;
        seen.add(key);
        attributesList.push({ SPRID: item.SPRID, TITLE: item.TITLE, VALUE: item.VALUE, IS_SELECTED: false, HELPER_URL: null, IS_AVAILABLE: false });
      }
    }
    return attributesList;
  }
}
Main_Product_Attributes.PROPS = PROPS;
Main_Product_Attributes.TABLE = 'ims_masterproductattribute';
Main_Product_Attributes.FeaturesList = { PROPS: FEATURE };
Main_Product_Attributes.ATTRIBUTESCOLORSIZELIST = { PROPS: COLORSIZE };
Main_Product_Attributes.ATTRIBUTESLIST = { PROPS: ATTRLIST };
Main_Product_Attributes.SIZECOLORLIST = { PROPS: SIZECOLOR };

module.exports = Main_Product_Attributes;
