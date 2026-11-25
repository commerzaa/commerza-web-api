'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\ControllersGas_Payment.cs (class Gas_PaymentController => /portal/Gas_Payment/...)
// Database: shopping (Db_Shopping). The C# is line-for-line identical to Dth_Payment.cs / Electricity_Payment.cs / Gas_Payment.cs except the
// values passed below, so the actions are built by _shared/batch-09-common.js buildRechargePaymentRouter().
// Actions: Index, GetOperator, GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge, GASRechargeRequests,
//          MakeGASRecharge (out param => 500 like MVC), UpdateGASRechargeStatus. Static GetGASOperatorsList() => internal, returned in Index JSON.
const { buildRechargePaymentRouter } = require('./_shared/batch-09-common');

module.exports = buildRechargePaymentRouter({
  prefix: 'Gas_Payment',
  view: '~/Views/Gas_Payment/Index.cshtml',
  friendly: 'Gas-Payment', // route-config
  service: 'GAS',
  slug: 'gas',
  requestsAction: 'GASRechargeRequests',
  walletCheck: false,
  requestsProc: 'usp_customer_gas_recharge_requests',
  makeAction: 'MakeGASRecharge',
  apiPath: '/api/Get-GasBill',
  detailsKey: 'GASBillDetail',
  updateAction: 'UpdateGASRechargeStatus',
  updateProc: 'usp_update_customer_gas_recharge_response',
  operatorsListName: 'GetGASOperatorsList',
});
