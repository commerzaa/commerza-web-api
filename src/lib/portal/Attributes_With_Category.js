/** Exports: class Attributes_With_Category (table tbl_attributes_with_category; props Att_Name, Att_Type, AWCT_ID, Cat_ID, ddl_ID, Default_Value, Is_Active, IsMendatory, IsSearch, Main_Cat_ID, Sr_No, Sub_Cat_ID)
 *   async GetProductAttributeListByCategory(string Type, string Id) : Attributes_With_Category[]  (DBO.USP_GETATTRIBUTELISTBYCATEGORY @TYPE,@ID,@CAT_NAME OUT)
 * Same logic as ../merchant/Attributes_With_Category; the portal entity has no isSelectiveAttr property.
 */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['Att_Name', 'Att_Type', 'AWCT_ID', 'Cat_ID', 'ddl_ID', 'Default_Value', 'Is_Active', 'IsMendatory', 'IsSearch', 'Main_Cat_ID', 'Sr_No', 'Sub_Cat_ID'];

class Attributes_With_Category {
  async GetProductAttributeListByCategory(Type, Id) {
    return mapRows(await proc('shopping', 'usp_getattributelistbycategory', { type: Type, id: Id }), PROPS);
  }
}
Attributes_With_Category.PROPS = PROPS;
Attributes_With_Category.TABLE = 'tbl_attributes_with_category';

module.exports = Attributes_With_Category;
