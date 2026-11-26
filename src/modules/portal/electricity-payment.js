'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Electricity_Payment.cs (class Electricity_PaymentController => /portal/Electricity_Payment/...)
// Database: shopping (Db_Shopping). The C# is line-for-line identical to Dth_Payment.cs / Electricity_Payment.cs / Gas_Payment.cs except the
// values passed below, so the actions are built by _shared/batch-09-common.js buildRechargePaymentRouter().
// Actions: Index, GetOperator, GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge, ElectricityRechargeRequests,
//          MakeElectricityRecharge (out param => 500 like MVC), UpdateElectricityRechargeStatus. Static GetElectricityOperatorsList() => internal, returned in Index JSON.
const { buildRechargePaymentRouter } = require('./_shared/batch-09-common');

module.exports = buildRechargePaymentRouter({
  prefix: 'Electricity_Payment',
  view: '~/Views/Electricity_Payment/Index.cshtml',
  friendly: 'Electricity-Payment', // route-config
  service: 'ELECTRICITY',
  slug: 'electricity',
  requestsAction: 'ElectricityRechargeRequests',
  walletCheck: false,
  requestsProc: 'usp_customer_electricity_recharge_requests',
  makeAction: 'MakeElectricityRecharge',
  apiPath: '/api/Get-ELECTRICITYBill',
  detailsKey: 'ELECTRICITYBillDetail',
  updateAction: 'UpdateElectricityRechargeStatus',
  updateProc: 'usp_update_customer_electricity_recharge_response',
  operatorsListName: 'GetElectricityOperatorsList',
});
