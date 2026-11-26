'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\EVouchersDetails.cs (class EVouchersDetailsController => /portal/EVouchersDetails/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CompanySettingsMod = require('../../lib/portal/CompanySettings');
const { DB, NRE, col, isNull, csInt32, csDecimal } = require('./_shared/batch-09-common');

const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;
const { CompanyMasterSettings } = CompanySettingsMod;
const router = express.Router();

const ALLVOCHER_PROPS = ['ROWNUMBER', 'VMID', 'VCTID', 'BRANDNAME', 'IMAGE', 'DESCRIPTION', 'TERMOFUSE', 'INSTRUCTION', 'ACTIVE', 'STATUS'];
const DENOM_PROPS = ['Denomination', 'DenominationDetails', 'PRODUCTCODE', 'PGUID', 'DMID', 'VMID', 'Brand', 'BV', 'RedeemCash', 'ReceivableCashBack'];

/** decimal * int keeping the decimal's scale, like C# (e.g. 100.00000000 * 2 = "200.00000000"). */
function decTimes(dec, qty) {
  const s = String(dec);
  const scale = s.includes('.') ? s.split('.')[1].length : 0;
  return (Number(s) * qty).toFixed(scale);
}

// ---------------------------------------------------------------- Index(string vmid)
// route-config: "evouchers-details" -> EVouchersDetails/Index
// public
router.all(['/portal/EVouchersDetails/Index{/:id}', '/portal/EVouchersDetails', '/portal/evouchers-details'], ps.portalSession, asyncHandler(async (req, res) => {
  let vmid = req.p.vmid === undefined ? null : req.p.vmid;
  if (vmid === null) vmid = '0';
  else vmid = await UtilityClass.Decryptword(vmid);
  // @VMID is passed as the (decrypted) string, @VCMID = 0
  const AllVOUCHERLIST = mapRows(await db.proc(DB, 'usp_allvochermaster', { vmid, vcmid: csInt32('0') }), ALLVOCHER_PROPS);
  return res.json({ view: '~/Views/EVouchersDetails/Index.cshtml', Model: AllVOUCHERLIST });
}));

// ---------------------------------------------------------------- [HttpPost] OrderVoucher(string vmid, string dmid, decimal denomination, Int32 Qty)
// auth
router.post('/portal/EVouchersDetails/OrderVoucher{/:id}', ...ps.customerOr('Either Your Session Expired Or Login Require !'), asyncHandler(async (req, res) => {
  const dmid = isNull(req.p.dmid) ? null : req.p.dmid;
  // non-nullable value-type parameters: MVC throws when they are missing
  if (isNull(req.p.denomination) || req.p.denomination === '') throw new Error("The parameters dictionary contains a null entry for parameter 'denomination' of non-nullable type 'System.Decimal'.");
  if (isNull(req.p.Qty) || req.p.Qty === '') throw new Error("The parameters dictionary contains a null entry for parameter 'Qty' of non-nullable type 'System.Int32'.");
  const denomination = csDecimal(req.p.denomination);
  const Qty = csInt32(req.p.Qty);
  if (Qty > 3) return res.json('Voucher Quantity should be less than 4 !');

  // "... WHERE DMID=" + dmid  (parameterised)
  const objAllvocherDenomination = mapRow(await db.queryOne(DB,
    `SELECT dmid, denomination, date, active, status, denominationdetails, pguid, productcode, vmid, brand, bv, redeemcash, receivablecashback
       FROM tbl_denomination_master WHERE dmid = @dmid LIMIT 1`, { dmid }), DENOM_PROPS);
  let ret = 'ok';
  let successurl = ''; let failureurl = ''; let inprocessurl = ''; let canceledurl = '';
  try {
    let PMID = CompanySettings.PMID;
    // eslint-disable-next-line no-unused-vars
    let LoginId = '';
    if (ps.sessionGet(req, 'LoginId') !== null) LoginId = String(ps.sessionGet(req, 'LoginId'));
    if (PMID === 0) {
      await CompanyMasterSettings.GetResellerData();
      PMID = CompanySettings.PMID;
    }
    // (reseller wallet check is commented out in the C#)
    const Loginid = req.user.loginid;
    const PLID = req.user.plid;
    const oblCL = await db.queryOne(DB, 'SELECT clid, fname, lname, phone, emailid FROM tbl_customerlogin WHERE clid = @clid LIMIT 1', { clid: PLID });
    if (oblCL) {
      // eslint-disable-next-line no-unused-vars
      const oblCADD = await db.queryOne(DB,
        'SELECT * FROM ims_customeraddress WHERE tousertype = @t AND touserid = @uid AND isdefault = true LIMIT 1', { t: 'Customer', uid: PLID });
    }
    if (denomination < 0) return res.json('Denomination Can Not Be Less Than Zero.');
    if (Qty === 0) return res.json('Denomination Qty Can Not Zero.');

    // Nullable<int> DID = 0; var DistributorDetails = (Login)Session["PLID"];
    let DID = 0;
    if (DID === 0) {
      await CompanyMasterSettings.GetResellerData();
      if (isNull(config.app.DID)) throw NRE();
      DID = csInt32(String(config.app.DID));
    }
    if (isNull(config.app.DID)) throw NRE();
    DID = csInt32(String(config.app.DID));

    if (!objAllvocherDenomination || !oblCL) throw NRE();
    const amount = decTimes(objAllvocherDenomination.Denomination ?? 0, Qty);
    const out = await db.procOne(DB, 'usp_customer_make_voucher_order', {
      loginid: Loginid, denominantion: objAllvocherDenomination.Denomination, pguid: objAllvocherDenomination.PGUID,
      productcode: objAllvocherDenomination.PRODUCTCODE, vmid: objAllvocherDenomination.VMID, dmid: objAllvocherDenomination.DMID,
      orderamount: amount, orderqty: Qty, fname: oblCL.fname, lname: oblCL.lname, mobile: oblCL.phone, emailid: oblCL.emailid,
      address: '', pincode: '', bv: objAllvocherDenomination.BV, redeemcashback: objAllvocherDenomination.RedeemCash,
      receivablecashback: objAllvocherDenomination.ReceivableCashBack,
    });
    const STRRESULT = col(out, 'strresult');
    const ORDERID = col(out, 'orderid');
    ret = String(STRRESULT ?? '');
    if (ret === 'success') {
      const orderId = String(ORDERID ?? '');
      if (orderId !== '') {
        const op = {
          name: (oblCL.fname ?? '') + '  ' + (oblCL.lname ?? ''),
          Payamount: amount,
          Product: 'EVoucher',
          Email: oblCL.emailid,
          mobile: oblCL.phone,
          OrderId: orderId,
          Regno: PLID,
        };
        ps.sessionSet(req, 'PaymentForOrder', op);
        const Id = await UtilityClass.Encryptword(orderId.trim());
        ps.tempDataSet(req, 'TransIDOut', Id);
        const BASEURL = CompanySettings.CompanyREDIRECT;
        successurl = BASEURL + '/secure-order-payment/payment-success';
        failureurl = BASEURL + '/secure-order-payment/payment-failed';
        inprocessurl = BASEURL + '/secure-order-payment/payment-inprocess';
        canceledurl = BASEURL + '/secure-order-payment/payment-cancel';

        const paySource = 'EVoucher';
        const tempCheckOutOrderId = await UtilityClass.Decryptword(String(Id));
        const checkOutOrderId = tempCheckOutOrderId;
        const pr = await db.procOne(DB, 'usp_orderonlinerequests', {
          clid: PLID, amount, orderid: checkOutOrderId, source: paySource, successurl, failureurl, inprocessurl, cancelledurl: canceledurl,
        });
        const paymentoutputResult = String(col(pr, 'stroutput') ?? '');
        const paymenttransactionID = String(col(pr, 'transactionid') ?? '');
        if (paymentoutputResult.toUpperCase() === 'SUCCESS' && paymenttransactionID !== '' && successurl !== '' && failureurl !== ''
          && inprocessurl !== '' && canceledurl !== '') {
          const BaseURL = config.app.PaymentURL;
          if (isNull(BaseURL)) throw NRE();
          const E = (s) => UtilityClass.Encryptword(s);
          const Url = BaseURL + 'Home?refrenceid=' + await E(paymenttransactionID) + '&successurl=' + await E(successurl) + '&failureurl='
            + await E(failureurl) + '&inprocessurl=' + await E(inprocessurl) + '&canceledurl=' + await E(canceledurl) + '&source='
            + await E(paySource) + '&PMID=' + await E(String(PMID)) + '';
          return res.json(ret + '^' + Url);
        }
        const Url = '/page-not-found';
        return res.json('success^' + Url);
      }
    }
  } catch (ex) {
    await UtilityClass.TrackError(String(ex.message));
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

module.exports = router;
