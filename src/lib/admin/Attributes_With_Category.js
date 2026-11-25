/** Exports: class Attributes_With_Category (table tbl_attributes_with_category; props AWCT_ID, Main_Cat_ID, Sub_Cat_ID, Cat_ID, Att_Name, Att_Type, ddl_ID, Default_Value, Sr_No, Is_Active)
 *   Source Models/Attributes_With_Category.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Attributes_With_Category = defineModel('Attributes_With_Category', 'tbl_attributes_with_category', { AWCT_ID: 0, Main_Cat_ID: 0, Sub_Cat_ID: 0, Cat_ID: 0, Att_Name: null, Att_Type: null, ddl_ID: 0, Default_Value: null, Sr_No: 0, Is_Active: false });

module.exports = Attributes_With_Category;
