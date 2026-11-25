/** Exports: class PaymentMethodDetail (table tbl_paymentmaster; props Mathodcode, paymentlogo, paymentmathod, ptmid, status)
 *   async AllPaymentMode() : PaymentMethodDetail[]  (status == 1)
 *   async DeletePaymentMethod(int pmid) : string  (proc usp_paymentmathod @pmid,"","","",mode "Delete",@strResult out)
 *   async PaymentMethodDetails(int pmid, string paymentmathod, string paymentlogo, string Mathodcode, string mode) : string  (proc usp_paymentmathod)
 */
'use strict';
const { query, procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('PaymentMethodDetail', 'tbl_paymentmaster', { Mathodcode: null, paymentlogo: null, paymentmathod: null, ptmid: 0, status: 0 });

class PaymentMethodDetail extends Base {
  async AllPaymentMode() {
    return Base.mapAll(await query(DB, 'select * from tbl_paymentmaster where status=1'));
  }

  async DeletePaymentMethod(pmid) {
    const row = await procOne(DB, 'usp_paymentmathod', { pmid, mathodtype: '', mathodlogo: '', mathodcode: '', mode: 'Delete' });
    const OutputResult = toStr(out(row, 'strResult'));
    return OutputResult.toString();
  }

  async PaymentMethodDetails(pmid, paymentmathod, paymentlogo, Mathodcode, mode) {
    const row = await procOne(DB, 'usp_paymentmathod', { pmid, mathodtype: paymentmathod, mathodlogo: paymentlogo, mathodcode: Mathodcode, mode });
    const OutputResult = toStr(out(row, 'strResult'));
    return OutputResult.toString();
  }
}

module.exports = PaymentMethodDetail;
