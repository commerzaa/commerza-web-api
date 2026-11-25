/** Exports: class BV_Discount_Per (table tbl_bv_discount_slab; props DSID, BV_Per, Discount, status)
 *   Source Models/BV_Discount_Per.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const BV_Discount_Per = defineModel('BV_Discount_Per', 'tbl_bv_discount_slab', { DSID: 0, BV_Per: 0, Discount: 0, status: false });

module.exports = BV_Discount_Per;
