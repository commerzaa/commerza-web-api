// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\DataCard_Payment.cs
'use strict';
// class DataCard_PaymentController => /portal/DataCard_Payment/... Database: shopping (Db_Shopping; legacy DataBaseContext).
// The C# is line-for-line the first 567 lines of Dth_Payment.cs (no DTH recharge region), built by _shared/batch-17-common.js.
// Actions: Index, GetOperator, GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge.
// Not routed: private ValidateMobile / GetResponseMeaning (unused helpers).
const { buildPaymentVariantRouter } = require('./_shared/batch-17-common');

module.exports = buildPaymentVariantRouter({
  prefix: 'DataCard_Payment',
  view: '~/Views/DataCard_Payment/Index.cshtml',
  friendly: ['DataCard-Payment'], // route-config
  indexMasterpage: true,
});
