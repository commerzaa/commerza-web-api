/** Exports: class ShippingDetail (table tbl_shippingtype; props image, shid, Shippingmathod, status, url)
 *   async AddShippingDetails(int shid, string Shippingmathod, string mode) : string   (usp_tbl_Addshippingtype, @strResult out)
 *   async AllShippingMethod() : ShippingDetail[]  (status == 1, by Shippingmathod) ; async ShippingMethoddelete(int shid) : string  (mode "Delete")
 */
'use strict';
const { query, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { outValue } = require('../_http');

class ShippingDetail {
  async AddShippingDetails(shid, Shippingmathod, mode) {
    const row = await procOne('shopping', 'usp_tbl_addshippingtype', { shid, shippingmathod: Shippingmathod, mode });
    return outValue(row, 'strResult');
  }

  async AllShippingMethod() {
    return mapRows(await query('shopping', 'select * from tbl_shippingtype where status::int=1 order by shippingmathod'), ['image', 'shid', 'Shippingmathod', 'status', 'url']);
  }

  async ShippingMethoddelete(shid) {
    const row = await procOne('shopping', 'usp_tbl_addshippingtype', { shid, shippingmathod: '', mode: 'Delete' });
    return outValue(row, 'strResult');
  }
}

module.exports = ShippingDetail;
