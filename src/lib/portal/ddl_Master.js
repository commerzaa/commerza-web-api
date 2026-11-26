/** Exports: class ddl_Master (table tbl_ddl_master; static PROPS, static TABLE)
 *   async GetDDLList(string Type, string Id) : ddl_Master[]  (dbo.usp_GetDDLMaster @type,@id,@cat_Name out)
 *  Portal C# is identical to the Merchant C# -> extends ../merchant/ddl_Master (adds PROPS/TABLE only). */
'use strict';
const Base = require('../merchant/ddl_Master');

class ddl_Master extends Base {}
ddl_Master.PROPS = ['CategoryId', 'Create_Date', 'ddl_ID', 'ddl_Name', 'ddl_Name_ID', 'ddl_Text', 'ddl_Value', 'isActive', 'MainCategoryId', 'parent_ddl_ID', 'SubCategoryId'];
ddl_Master.TABLE = 'tbl_ddl_master';

module.exports = ddl_Master;
