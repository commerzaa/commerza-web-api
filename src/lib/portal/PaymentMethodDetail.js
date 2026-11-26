/** Exports: class PaymentMethodDetail (table tbl_paymentmaster; props Mathodcode, paymentlogo, paymentmathod, ptmid, status)
 *   async AllPaymentMode() : PaymentMethodDetail[]   (status == 1)
 *   async DeletePaymentMethod(int pmid) : string     (usp_paymentmathod @pmid, '', '', '', 'Delete', @strResult out)
 *   async PaymentMethodDetails(int pmid, string paymentmathod, string paymentlogo, string Mathodcode, string mode) : string  (usp_paymentmathod ..., @strResult out)
 * PORT-NOTE: procedure usp_paymentmathod is not present in the Db_Shopping schema dump; it is called by name as in C#.
 */
'use strict';
const { query, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { outValue } = require('../_http');

const PROPS = ['Mathodcode', 'paymentlogo', 'paymentmathod', 'ptmid', 'status'];

class PaymentMethodDetail {
  async AllPaymentMode() {
    return mapRows(await query('shopping', 'select * from tbl_paymentmaster where status=1'), PROPS);
  }

  async DeletePaymentMethod(pmid) {
    const row = await procOne('shopping', 'usp_paymentmathod', { pmid, mathodtype: '', mathodlogo: '', mathodcode: '', mode: 'Delete' });
    return outValue(row, 'strResult');
  }

  async PaymentMethodDetails(pmid, paymentmathod, paymentlogo, Mathodcode, mode) {
    const row = await procOne('shopping', 'usp_paymentmathod', { pmid, mathodtype: paymentmathod, mathodlogo: paymentlogo, mathodcode: Mathodcode, mode });
    return outValue(row, 'strResult');
  }
}
PaymentMethodDetail.PROPS = PROPS;
PaymentMethodDetail.TABLE = 'tbl_paymentmaster';

module.exports = PaymentMethodDetail;
