/** Exports: class Attributes_With_Category (table tbl_attributes_with_category; props Att_Name, Att_Type, AWCT_ID, Cat_ID, ddl_ID, Default_Value, Is_Active, IsMendatory, IsSearch, Main_Cat_ID, Sr_No, Sub_Cat_ID)
 *   async GetProductAttributeListByCategory(string Type, string Id) : Attributes_With_Category[]  (DBO.USP_GETATTRIBUTELISTBYCATEGORY @TYPE,@ID,@CAT_NAME OUT)
 */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

class Attributes_With_Category {
  async GetProductAttributeListByCategory(Type, Id) {
    return mapRows(await proc('shopping', 'usp_getattributelistbycategory', { type: Type, id: Id }), ['Att_Name', 'Att_Type', 'AWCT_ID', 'Cat_ID', 'ddl_ID', 'Default_Value', 'Is_Active', 'IsMendatory', 'IsSearch', 'Main_Cat_ID', 'Sr_No', 'Sub_Cat_ID']);
  }
}

module.exports = Attributes_With_Category;
