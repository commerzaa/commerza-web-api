/** Exports: class ShippingDetail (table tbl_shippingtype; props shid, Shippingmathod, url, image, status)
 *   async AddShippingDetails(int shid, string Shippingmathod, string mode) : string  (proc usp_tbl_Addshippingtype @shid,@Shippingmathod,@mode,@strResult out)
 *   async ShippingMethoddelete(int shid) : string  (same proc, Shippingmathod "", mode "Delete")
 *   async AllShippingMethod() : ShippingDetail[]  (status == 1, by Shippingmathod)
 * Same C# as ../franchise/ShippingDetail.js, but the admin DataBaseContext is Db_Affiliate => database 'affiliate'.
 */
'use strict';
const { query, procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('ShippingDetail', 'tbl_shippingtype', { shid: 0, Shippingmathod: null, url: null, image: null, status: 0 });

class ShippingDetail extends Base {
  async AddShippingDetails(shid, Shippingmathod, mode) {
    const row = await procOne(DB, 'usp_tbl_addshippingtype', { shid, shippingmathod: Shippingmathod, mode });
    const OutputResult = toStr(out(row, 'strResult'));
    return OutputResult.toString();
  }

  async ShippingMethoddelete(shid) {
    const row = await procOne(DB, 'usp_tbl_addshippingtype', { shid, shippingmathod: '', mode: 'Delete' });
    const OutputResult = toStr(out(row, 'strResult'));
    return OutputResult.toString();
  }

  async AllShippingMethod() {
    return Base.mapAll(await query(DB, 'select * from tbl_shippingtype where status=1 order by shippingmathod'));
  }
}

module.exports = ShippingDetail;
