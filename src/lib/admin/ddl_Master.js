/** Exports: class ddl_Master (table tbl_ddl_master; props CategoryId, Create_Date, ddl_ID, ddl_Name, ddl_Name_ID, ddl_Text, ddl_Value, isActive, MainCategoryId, parent_ddl_ID, SubCategoryId, Title)
 *   async GetDDLList(string Type, string Id) : ddl_Master[]  (proc dbo.usp_GetDDLMaster @type,@id,@cat_Name out)
 * Differs from ../franchise/ddl_Master.js: extra property Title and database 'affiliate' (Admin DataBaseContext = Db_Affiliate).
 */
'use strict';
const { proc } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('ddl_Master', 'tbl_ddl_master', { CategoryId: null, Create_Date: null, ddl_ID: 0, ddl_Name: null, ddl_Name_ID: null, ddl_Text: null, ddl_Value: null, isActive: false, MainCategoryId: null, parent_ddl_ID: 0, SubCategoryId: null, Title: null });

class ddl_Master extends Base {
  async GetDDLList(Type, Id) {
    return Base.mapAll(await proc(DB, 'usp_getddlmaster', { type: Type, id: Id }));
  }
}

module.exports = ddl_Master;
