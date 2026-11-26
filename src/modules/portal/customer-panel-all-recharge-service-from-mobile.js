// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\All_RechargeService_from_mobileController.cs (class All_RechargeService_from_mobileController => /portal/All_RechargeService_from_mobile/...)
'use strict';
// Database: shopping (Db_Shopping). The five actions are line-for-line identical C# except for the values in ACTIONS below
// (request proc, operator type, gateway URL segment, and the customer-wallet check that only DTH and GAS perform).
// Login actions (SESSION.md 4): Session["Plid"] = ObjLogin => ps.issueCustomerToken; `token` added to every { redirect } response
// sent after a successful login.
// PORT-NOTE: legacy auto-login by Clid + PMID (Login_Check(phone, stored password, ip, PMID)); the Android app calls these without a
//   token, kept `// public` as legacy (the authentication check is hard-coded / absent). Anyone knowing a CLID can start a recharge
//   request for that customer.
// PORT-NOTE: legacy concatenated the reseller id into the TBL_DISTRIBUTOR_PREPAID_SETTING SELECT; parameterised here.
// PORT-NOTE: SqlQuery<decimal>(...).FirstOrDefault() on a NULL AVAILABLE_WALLET is impossible (ISNULL), no row => 0 (same as legacy).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const GetIP = require('../../lib/portal/GetIP');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const { toDecimalStr } = require('./_shared/batch-10-common');
const {
  DB, NRE, ci, mvcStr, mvcInt32, toInt32, toInt64, toDecimalNum, appStrict, redirectJson, loginSession, customerByClid,
} = require('./_shared/batch-20-common');

const router = express.Router();
const C = '/portal/All_RechargeService_from_mobile';

/** private bool ValidateMobile(string mobileNumber) (not an action) */
function ValidateMobile(mobileNumber) {
  if (mobileNumber === null || mobileNumber === undefined) throw new Error('Value cannot be null.\r\nParameter name: input');
  return /^[-+]?[0-9]*\.?[0-9]+$/.test(mobileNumber);
}

/** SqlParameter OUT .Value.ToString() (DBNull => "") */
function outStr(row, name) {
  const v = ci(row, name);
  return v === null || v === undefined ? '' : String(v);
}
const isNullOrEmpty = (v) => v === null || v === undefined || v === '';

const ACTIONS = [
  { action: 'PrepaidRechargeService', friendly: 'PrepaidRechargeServic-ForAnroid', proc: 'usp_customer_prepaid_recharge_requests', type: 'PREPAID',
    seg: 'prepaid-recharge', walletCheck: false },
  { action: 'PostpaidRechargeRequests', friendly: 'PostpaidRechargeRequests-ForAnroid', proc: 'usp_customer_postpaid_recharge_requests',
    type: 'POSTPAID', seg: 'recharge', walletCheck: false },
  { action: 'DTHRechargeRequests', friendly: 'DTHRechargeRequests-ForAnroid', proc: 'usp_customer_dth_recharge_requests', type: 'DTH',
    seg: 'dth-recharge', walletCheck: true },
  { action: 'GASRechargeRequests', friendly: 'GASRechargeRequests-ForAnroid', proc: 'usp_customer_gas_recharge_requests', type: 'GAS',
    seg: 'gas-recharge', walletCheck: true },
  { action: 'ElectricityRechargeRequests', friendly: 'ElectricityRechargeRequests-ForAnroid', proc: 'usp_customer_electricity_recharge_requests',
    type: 'ELECTRICITY', seg: 'electricity-recharge', walletCheck: false },
];

/** ActionResult <Action>(int PMID, int Clid, string MobileNo = "", string RechOpCode = "", string RechOpName = "", string RechOpService = "", string RechAmount = "") */
function rechargeAction(cfg) {
  return asyncHandler(async (req, res) => {
    // MVC binding (before the action body)
    const PMID = mvcInt32(req, 'PMID');
    const Clid = mvcInt32(req, 'Clid');
    const MobileNo = mvcStr(req, 'MobileNo', '');
    const RechOpCode = mvcStr(req, 'RechOpCode', '');
    const RechOpName = mvcStr(req, 'RechOpName', '');
    const RechOpService = mvcStr(req, 'RechOpService', '');
    const RechAmount = mvcStr(req, 'RechAmount', '');
    let result = '';
    // outside the try: missing CompanyDomain => NullReferenceException (HTTP 500)
    const softwareURL = appStrict('CompanyDomain');
    const failUrl = `${softwareURL}all-Payment-failureurl`;
    let token;
    const fail = () => redirectJson(res, failUrl, token);
    try {
      const v = await customerByClid(Clid);
      if (v == null) throw NRE();
      const username = v.PHONE;
      const password = v.PASSWORD;
      const ip = await GetIP.GetLocalIP(req);
      const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(username, password, ip, PMID);
      token = loginSession(req, ObjLogin); // Session["Plid"] = ObjLogin

      if (ObjLogin == null) {
        ps.sessionSet(req, 'errormessagemobile', 'Please login first');
        result = cfg.type === 'PREPAID' ? 'Error^Please login first' : 'Please login first';
        return fail();
      }
      let ResellerWallet = 0;
      const ResellerId = toInt64(ObjLogin.DID);
      const w = await db.queryOne(DB,
        'select coalesce(available_wallet, 0) as available_wallet from tbl_distributor_prepaid_setting where pmid = @ResellerId limit 1',
        { ResellerId });
      ResellerWallet = w ? Number(w.available_wallet) : 0;
      if (ResellerWallet < toDecimalNum(RechAmount)) {
        ps.sessionSet(req, 'errormessagemobile', 'Insufficient fund in reseller wallet');
        return fail();
      }

      const Plid = Number(ObjLogin.Plid);
      if (!isNullOrEmpty(MobileNo) && !isNullOrEmpty(RechOpCode) && !isNullOrEmpty(RechOpName) && !isNullOrEmpty(RechOpService)
        && !isNullOrEmpty(RechAmount)) {
        if (!ValidateMobile(MobileNo)) {
          result = 'Invalid mobile no';
          ps.sessionSet(req, 'errormessagemobile', result);
          return fail();
        }
        const reqAmountStr = toDecimalStr(RechAmount); // Convert.ToDecimal(RechAmount)
        const reqAmount = Number(reqAmountStr);
        if (reqAmount <= 0) {
          result = 'Invalid recharge amount';
          ps.sessionSet(req, 'errormessagemobile', result);
          return fail();
        }
        if (cfg.walletCheck) {
          const walletAmount = Number(await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid)));
          if (walletAmount < reqAmount) {
            result = 'Insufficient amount in wallet';
            ps.sessionSet(req, 'errormessagemobile', result);
            return fail();
          }
        }

        // Start Payment Gateway parameters
        const requestedURL = appStrict('CompanyDomain');
        const successurl = `${requestedURL}/secure-eblaa-payment-gateway/${cfg.seg}-success`;
        const failureurl = `${requestedURL}/secure-eblaa-payment-gateway/${cfg.seg}-failed`;
        const inprocessurl = `${requestedURL}/secure-eblaa-payment-gateway/${cfg.seg}-inprocess`;
        const canceledurl = `${requestedURL}/secure-eblaa-payment-gateway/${cfg.seg}-cancel`;

        // Track Recharge Request, generate transaction Id (@TRANSACTIONID out, @STROUTPUT out => result columns)
        const out = await db.procOne(DB, cfg.proc, {
          clid: Plid, mobileno: MobileNo, operatortype: cfg.type, operatorname: RechOpName, operatorcode: RechOpCode,
          operatorservice: RechOpService, rechargeamount: reqAmountStr, successurl, failureurl, inprocessurl, cancelledurl: canceledurl,
        });
        const StrOutput = outStr(out, 'stroutput');
        const StrTransactionId = outStr(out, 'transactionid');
        if (StrOutput.toLowerCase() === 'success' && StrTransactionId !== '') {
          ps.sessionSet(req, 'MobileNo', MobileNo);
          ps.sessionSet(req, 'RechOpCode', RechOpCode);
          ps.sessionSet(req, 'RechOpName', RechOpName);
          ps.sessionSet(req, 'RechOpService', RechOpService);
          ps.sessionSet(req, 'RechAmount', RechAmount);
          ps.sessionSet(req, 'StrTransactionId', StrTransactionId);

          const BaseURL = appStrict('PaymentURL');
          const E = (x) => UtilityClass.Encryptword(x);
          const Url = `${BaseURL}Home?refrenceid=${await E(StrTransactionId)}&successurl=${await E(successurl)}&failureurl=${await E(failureurl)}`
            + `&inprocessurl=${await E(inprocessurl)}&canceledurl=${await E(canceledurl)}&source=${await E('Recharge')}`
            + `&PMID=${await E(String(PMID))}`;

          const spOutput = await db.procOne(DB, 'usp_update_refferenceid_behalf_service_mobile', { transactionid: StrTransactionId, type: cfg.type });
          const ResValue = outStr(spOutput, 'intresult');
          if (ResValue === 'success') return redirectJson(res, Url, token);
          return fail();
        }
        // End Track Recharge Requests
      } else {
        result = 'Invalid Request';
        ps.sessionSet(req, 'errormessagemobile', result);
        return fail();
      }
    } catch (ex) {
      result = 'Some error occured';
      ps.sessionSet(req, 'errormessagemobile', result);
      return fail();
    }
    return fail();
  });
}

for (const cfg of ACTIONS) {
  // route-config: <friendly> -> All_RechargeService_from_mobile/<action>
  // public (Android auto-login by Clid + PMID, see PORT-NOTE)
  router.all([`${C}/${cfg.action}{/:id}`, `/portal/${cfg.friendly}`], ps.portalSession, rechargeAction(cfg));
}

module.exports = router;
