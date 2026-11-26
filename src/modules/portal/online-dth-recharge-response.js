// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\OnlineDTHRechargeResponseController.cs
'use strict';
// class OnlineDTHRechargeResponseController => /portal/OnlineDTHRechargeResponse/... + RouteConfig secure-eblaa-payment-gateway/dth-recharge-*.
// Database: shopping (Db_Shopping). Built by _shared/batch-17-common.js buildDthResponseRouter() (differs from batch-11's builder:
// kind DTH, refrenceid decrypted in RechargeFailed but not in RechargeCancel, catch keeps TransactionId = refrenceid).
// Actions: RechargeSuccess, RechargeFailed, RechargeInProcess, RechargeCancel.
// Not routed: static SendConfirmationMailAndMessages (identical to the other Online*RechargeResponse controllers => batch-11-common).
// MakeDTHRecharge (Dth_PaymentController) => batch-17-common makeRecharge('DTH', ...).
const { buildDthResponseRouter } = require('./_shared/batch-17-common');

module.exports = buildDthResponseRouter();
