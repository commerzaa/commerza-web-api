// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Purchased_Voucher_ReceiptController.cs (Purchased_Voucher_ReceiptController)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { CompanyMasterSettings } = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, view } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/Purchased_Voucher_Receipt';
/** class PurchasedVoucherReceipt */
const PURCHASED_VOUCHER_RECEIPT = ['ROWNUMBER', 'OrderDateTime', 'OrderAmount', 'OrderId', 'USERNAME', 'BRANDNAME', 'BILLNO', 'BILLDATE', 'LOGINID',
  'CASHWALLETUSED', 'CASHBACKWALLETUSED', 'VOUCHERWALLETUSED', 'AMOUNT'];
/** new PurchasedVoucherReceipt() (CLR defaults) */
const emptyReceipt = () => ({
  ROWNUMBER: 0, OrderDateTime: '0001-01-01T00:00:00', OrderAmount: 0, OrderId: null, USERNAME: null, BRANDNAME: null, BILLNO: null,
  BILLDATE: '0001-01-01T00:00:00', LOGINID: null, CASHWALLETUSED: 0, CASHBACKWALLETUSED: 0, VOUCHERWALLETUSED: 0, AMOUNT: null,
});

// ---------------------------------------------------------------- Index(string orderId)
// public (legacy: no session check)
// route-config: customer/O0obeCTpYiNBlRDMchzx1CtA== -> Purchased_Voucher_Receipt/Index
router.all([`${P}/Index{/:id}`, P, '/portal/customer/O0obeCTpYiNBlRDMchzx1CtA=='], ps.portalSession, asyncHandler(async (req, res) => {
  let orderId = req.p.orderId === undefined || req.p.orderId === '' ? null : req.p.orderId;
  let objPurchasedVoucherReceipt = emptyReceipt();
  try {
    await CompanyMasterSettings.GetResellerData();
    orderId = await UtilityClass.Decryptword(orderId);
    // PORT-NOTE: usp_GetGiftVoucherReceiptDetails is not in the Db_Shopping schema dump; called by its legacy name/parameter.
    const row = await db.procOne(DB, 'usp_getgiftvoucherreceiptdetails', { OrderId: orderId });
    objPurchasedVoucherReceipt = mapRow(row, PURCHASED_VOUCHER_RECEIPT);
  } catch (ex) { /* swallowed as legacy */ }
  return view(res, '~/Views/CustomerPanel/Purchased_Voucher_Receipt/Index.cshtml', objPurchasedVoucherReceipt);
}));

module.exports = router;
