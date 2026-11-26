// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\servicejewariaController.cs
'use strict';
// class servicejewariaController => /portal/servicejewaria/... + RouteConfig "service-eblaa", "mobile-recharge" (-> Index).
// Database: shopping (Db_Shopping; legacy DataBaseContext). Lines 1-560 are identical to servicejewaria_MobileController.cs (except the
// attributes); everything is built by _shared/batch-17-common.js buildPaymentVariantRouter().
// Actions: Index, GetOperator, GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge (ambiguous => 500),
//          TestAPI, PostpaidRechargeRequests, UpdatePostpaidRechargeStatus, PrepaidRechargeRequests, MakePrepaidRecharge (out param => 500),
//          UpdatePrepaidRechargeStatus.
// Static non-actions called by the view (returned in the Index JSON): GetPrepaidOperatorsList (OperatorsList), GetPostpaidOperatorsList
// (PostpaidOperatorsList), getCustomerPreviousPrepaidRecharges (prepaidRechargesHistory), getCustomerPreviousPostpaidRecharges
// (postpaidRechargesHistory). Not routed: private ValidateMobile / GetResponseMeaning.
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { buildPaymentVariantRouter, GetOperatorsList, getCustomerPreviousRecharges, makeRecharge } = require('./_shared/batch-17-common');

const C = 'servicejewaria';

// public static List<ProviderLists> GetPostpaidOperatorsList()
const GetPostpaidOperatorsList = () => GetOperatorsList('POSTPAID', '7', false);
// public static List<ProviderLists> GetPrepaidOperatorsList()  (removes the single "Aircel Express" entry; Single() failure => null)
const GetPrepaidOperatorsList = () => GetOperatorsList('MOBILE', '7', true);
// public static List<CustomerPreviousRechargeHistory> getCustomerPreviousPostpaidRecharges() / getCustomerPreviousPrepaidRecharges()
const getCustomerPreviousPostpaidRecharges = (req) => getCustomerPreviousRecharges(req, 'POSTPAID');
const getCustomerPreviousPrepaidRecharges = (req) => getCustomerPreviousRecharges(req, 'MOBILE');

const router = buildPaymentVariantRouter({
  prefix: C,
  view: '~/Views/servicejewaria/Index.cshtml',
  friendly: ['service-eblaa', 'mobile-recharge'], // route-config ("service-jewria" is commented out)
  indexMasterpage: false, // this Index does not set ViewBag.masterpageshow
  indexData: async (req) => ({
    OperatorsList: await GetPrepaidOperatorsList(),
    PostpaidOperatorsList: await GetPostpaidOperatorsList(),
    prepaidRechargesHistory: await getCustomerPreviousPrepaidRecharges(req),
    postpaidRechargesHistory: await getCustomerPreviousPostpaidRecharges(req),
  }),
  ambiguousMakePostpaid: true,
  requests: [
    {
      action: 'PostpaidRechargeRequests', operatorType: 'POSTPAID', proc: 'usp_customer_postpaid_recharge_requests',
      slug: 'recharge', resellerCheck: true, walletCheck: false,
    },
    {
      action: 'PrepaidRechargeRequests', operatorType: 'PREPAID', proc: 'usp_customer_prepaid_recharge_requests',
      slug: 'prepaid-recharge', resellerCheck: true, walletCheck: false,
    },
  ],
  makeActions: [{ action: 'MakePrepaidRecharge', kind: 'PREPAID' }],
  updateActions: [
    { action: 'UpdatePostpaidRechargeStatus', kind: 'POSTPAID' },
    { action: 'UpdatePrepaidRechargeStatus', kind: 'PREPAID' },
  ],
});

// ---------------------------------------------------------------- TestAPI()  { GetPostpaidOperatorsList(); return View(); }
// public (no session check in legacy)
router.all(`/portal/${C}/TestAPI{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  await GetPostpaidOperatorsList();
  return res.json({ view: '~/Views/servicejewaria/TestAPI.cshtml' });
}));

Object.assign(router.internals, {
  GetPostpaidOperatorsList, GetPrepaidOperatorsList, getCustomerPreviousPostpaidRecharges, getCustomerPreviousPrepaidRecharges,
  // string MakePostpaidRecharge(MobileNo, CLID, RechOpCode, RechOpName, RechOpService, RechAmount, TransactionId, out APITransactionId)
  MakePostpaidRechargeService: (...a) => makeRecharge('POSTPAID', ...a),
});
module.exports = router;
