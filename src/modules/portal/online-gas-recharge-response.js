// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers$2.cs
'use strict';
// Database: shopping (Db_Shopping). Logic shared with the other Online*RechargeResponse controllers: ./_shared/batch-11-common.js
// Actions: RechargeSuccess, RechargeFailed, RechargeInProcess, RechargeCancel (SendConfirmationMailAndMessages = static helper, not routed)
const { buildRechargeResponseRouter } = require('./_shared/batch-11-common');

module.exports = buildRechargeResponseRouter({
  controller: 'OnlineGASRechargeResponse', kind: 'GAS', validateProc: 'usp_validate_customer_gas_recharge',
  friendly: 'gas-recharge', masterpage: true, plidFirst: false, insurance: false,
  failedReturnWallet: true, cancelMode: 'paymentstatus', cancelReturnWallet: true, catchTransIdXXX: false,
});
