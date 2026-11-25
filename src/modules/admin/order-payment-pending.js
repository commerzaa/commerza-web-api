'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\OrderPaymentPending.cs (class OrderPaymentPendingController).
// Database: affiliate (Db_Affiliate).
// The C# is identical to OrderPaymentConformation.cs except for the view folder, so every action lives in
// _shared/batch11A_common.js orderPaymentRouter():
//   Index (+ route-config "AdminPanel/PaymentRequest", Type = 0), ExportReport, ApprovePaymentInBulk, UpdatePaymentStatus,
//   static GetTimestamp (helper, not routed).
const { orderPaymentRouter } = require('./_shared/batch11-a-common');

module.exports = orderPaymentRouter({
  C: 'OrderPaymentPending',
  viewDir: 'OrderPaymentPending',
  friendly: { url: 'AdminPanel/PaymentRequest', Type: 0 }, // route-config
});
