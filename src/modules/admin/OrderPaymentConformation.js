'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\OrderPaymentConformation.cs (class OrderPaymentConformationController).
// Database: affiliate (Db_Affiliate).
// The C# is identical to OrderPaymentPending.cs except for the view folder, so every action lives in
// _shared/batch11A_common.js orderPaymentRouter():
//   Index (+ route-config "AdminPanel/PaymentConfirmation", Type = 2), ExportReport, ApprovePaymentInBulk, UpdatePaymentStatus,
//   static GetTimestamp (helper, not routed). Model class OrderPaymentConformation => ORDER_PAYMENT_CONFORMATION_PROPS.
// (route-config "AdminPanel/PaymentRevised" (Type = 1) is commented out in RouteConfig.cs => not registered.)
const { orderPaymentRouter } = require('./_shared/batch11A_common');

module.exports = orderPaymentRouter({
  C: 'OrderPaymentConformation',
  viewDir: 'OrderPaymentConformation',
  friendly: { url: 'AdminPanel/PaymentConfirmation', Type: 2 }, // route-config
});
