/** Exports: class ddl_Master (table tbl_ddl_master; props CategoryId, Create_Date, ddl_ID, ddl_Name, ddl_Name_ID, ddl_Text, ddl_Value, isActive, MainCategoryId, parent_ddl_ID, SubCategoryId)
 *   async GetDDLList(string Type, string Id) : ddl_Master[]  (dbo.usp_GetDDLMaster @type,@id,@cat_Name out)
 */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

class ddl_Master {
  async GetDDLList(Type, Id) {
    return mapRows(await proc('shopping', 'usp_getddlmaster', { type: Type, id: Id }), ['CategoryId', 'Create_Date', 'ddl_ID', 'ddl_Name', 'ddl_Name_ID', 'ddl_Text', 'ddl_Value', 'isActive', 'MainCategoryId', 'parent_ddl_ID', 'SubCategoryId']);
  }
}

module.exports = ddl_Master;
