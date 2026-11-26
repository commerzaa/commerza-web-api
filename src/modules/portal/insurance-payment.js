// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Insurance_Payment.cs
'use strict';
// class Insurance_PaymentController => /portal/Insurance_Payment/... Database: shopping (Db_Shopping; legacy DataBaseContext).
// Same shape as Dth_Payment.cs, but InsuranceRechargeRequests takes reqDOB (=> @CUSTOMERDOB, Session["RechDOB"]), has no customer
// wallet check, and MakeInsuranceRecharge posts DOB; built by _shared/batch-17-common.js.
// Actions: Index, GetOperator, GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge,
//          InsuranceRechargeRequests, MakeInsuranceRecharge (out param => 500 like MVC), UpdateInsuranceRechargeStatus.
// Static GetInsuranceOperatorsList() is not an action: called by the view => returned as OperatorsList in the Index JSON.
// Not routed: private ValidateMobile / GetResponseMeaning.
const { buildPaymentVariantRouter, GetOperatorsList } = require('./_shared/batch-17-common');

// public static List<ProviderLists> GetInsuranceOperatorsList()
const GetInsuranceOperatorsList = () => GetOperatorsList('INSURANCE', '7', false);

const router = buildPaymentVariantRouter({
  prefix: 'Insurance_Payment',
  view: '~/Views/Insurance_Payment/Index.cshtml',
  friendly: ['Insurance-Payment'], // route-config
  indexMasterpage: true,
  indexData: async () => ({ OperatorsList: await GetInsuranceOperatorsList() }),
  requests: [{
    action: 'InsuranceRechargeRequests',
    operatorType: 'INSURANCE',
    // PORT-NOTE: USP_CUSTOMER_INSURANCE_RECHARGE_REQUESTS is not in dbshopping.sql (the call fails => "Error^Some error occured", as it would have in legacy).
    proc: 'usp_customer_insurance_recharge_requests',
    slug: 'insurance-recharge',
    resellerCheck: true,
    walletCheck: false,
    dob: true,
  }],
  makeActions: [{ action: 'MakeInsuranceRecharge', kind: 'INSURANCE' }],
  updateActions: [{ action: 'UpdateInsuranceRechargeStatus', kind: 'INSURANCE' }],
});
router.internals.GetInsuranceOperatorsList = GetInsuranceOperatorsList;
module.exports = router;
