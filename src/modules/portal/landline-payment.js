// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Landline_Payment.cs
'use strict';
// class Landline_PaymentController => /portal/Landline_Payment/... Database: shopping (Db_Shopping; legacy DataBaseContext).
// Base actions identical to DataCard_Payment.cs (built by _shared/batch-17-common.js) plus the Landline region.
// Actions: Index, GetOperator, GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge, LandlineRechargeRequests.
// Static GetLandlineOperatorsList() is not an action: called by the view => returned as OperatorsList in the Index JSON.
// Not routed: private ValidateMobile / GetResponseMeaning.
const { buildPaymentVariantRouter, GetOperatorsList } = require('./_shared/batch-17-common');

// public static List<ProviderLists> GetLandlineOperatorsList()  (clid = "" here, "7" in the other controllers)
const GetLandlineOperatorsList = () => GetOperatorsList('LANDLINE', '', false);

const router = buildPaymentVariantRouter({
  prefix: 'Landline_Payment',
  view: '~/Views/Landline_Payment/Index.cshtml',
  friendly: ['Landline-Payment'], // route-config
  indexMasterpage: true,
  indexData: async () => ({ OperatorsList: await GetLandlineOperatorsList() }),
  requests: [{
    action: 'LandlineRechargeRequests',
    operatorType: 'LANDLINE',
    proc: 'usp_customer_landline_recharge_requests',
    // legacy copy/paste kept: the Landline request sends the ELECTRICITY gateway return URLs
    slug: 'electricity-recharge',
    resellerCheck: false, // no TBL_DISTRIBUTOR_PREPAID_SETTING check in this action
    walletCheck: true,
    fixedPmid: 1, // int PMID = 1; (not CompanySettings.PMID)
  }],
});
router.internals.GetLandlineOperatorsList = GetLandlineOperatorsList;
module.exports = router;
