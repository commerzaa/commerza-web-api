'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\ControllersDth_Payment.cs (class Dth_PaymentController => /portal/Dth_Payment/...)
// Database: shopping (Db_Shopping). The C# is line-for-line identical to Dth_Payment.cs / Electricity_Payment.cs / Gas_Payment.cs except the
// values passed below, so the actions are built by _shared/batch-09-common.js buildRechargePaymentRouter().
// Actions: Index, GetOperator, GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge, DTHRechargeRequests,
//          MakeDTHRecharge (out param => 500 like MVC), UpdateDTHRechargeStatus. Static GetDTHOperatorsList() => internal, returned in Index JSON.
const { buildRechargePaymentRouter } = require('./_shared/batch-09-common');

module.exports = buildRechargePaymentRouter({
  prefix: 'Dth_Payment',
  view: '~/Views/Dth_Payment/Index.cshtml',
  friendly: 'Dth-Payment', // route-config
  service: 'DTH',
  slug: 'dth',
  requestsAction: 'DTHRechargeRequests',
  walletCheck: true,
  requestsProc: 'usp_customer_dth_recharge_requests',
  makeAction: 'MakeDTHRecharge',
  apiPath: '/api/Get-DTHRecharge',
  detailsKey: 'DTHRechargeDetails',
  updateAction: 'UpdateDTHRechargeStatus',
  updateProc: 'usp_update_customer_dth_recharge_response',
  operatorsListName: 'GetDTHOperatorsList',
});
