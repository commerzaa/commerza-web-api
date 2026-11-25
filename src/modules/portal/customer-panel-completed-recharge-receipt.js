'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Completed_Recharge_ReceiptController.cs (Completed_Recharge_ReceiptController)
// Actions: Index (1)
const express = require('express');
const db = require('../../db');
const { mapRow } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { CompanyMasterSettings } = require('../../lib/portal/CompanySettings');
const { DB } = require('./_shared/batch-04-common');

const router = express.Router();

const RechargeReceipt = ['ID', 'CLID', 'NAME', 'MOBILENO', 'OPERATORTYPE', 'OPERATORNAME', 'OPERATORSERVICE', 'AMOUNT', 'STATUS', 'TRANSACTIONID',
  'RECHARGEDATE', 'ISANDROIDORWEB', 'MLMWALLET', 'CUSTOMERWALLET', 'PAYUMONEY', 'REMARKS', 'BILLNO', 'BILLDATE', 'LOGINID', 'RECHARGEAMOUNT'];
/** new RechargeReceipt() (C# defaults) */
const emptyReceipt = () => ({
  ID: 0, CLID: 0, NAME: null, MOBILENO: null, OPERATORTYPE: null, OPERATORNAME: null, OPERATORSERVICE: null, AMOUNT: 0, STATUS: null,
  TRANSACTIONID: null, RECHARGEDATE: '0001-01-01T00:00:00', ISANDROIDORWEB: 0, MLMWALLET: 0, CUSTOMERWALLET: 0, PAYUMONEY: 0, REMARKS: null,
  BILLNO: null, BILLDATE: '0001-01-01T00:00:00', LOGINID: null, RECHARGEAMOUNT: 0,
});

// public (legacy had no session check: receipt addressed by the encrypted order id)
// route-config: customer/O0obeCTpYiNBlRDMchzx1CtY0A== -> Completed_Recharge_Receipt/Index
router.all(['/portal/Completed_Recharge_Receipt/Index{/:id}', '/portal/Completed_Recharge_Receipt', '/portal/customer/O0obeCTpYiNBlRDMchzx1CtY0A=='],
  asyncHandler(async (req, res) => {
    let objRechargeReceipt = emptyReceipt();
    try {
      await CompanyMasterSettings.GetResellerData();
      const orderId = await UtilityClass.Decryptword(req.p.orderId === undefined ? null : req.p.orderId);
      const orderType = await UtilityClass.Decryptword(req.p.orderType === undefined ? null : req.p.orderType);
      // Convert.ToInt64(orderId)
      const s = orderId === null || orderId === undefined ? '0' : String(orderId).trim();
      if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
      // DBO.usp_GetRechargeReceiptDetails @Id,@Type  (.FirstOrDefault())
      const rows = await db.proc(DB, 'usp_getrechargereceiptdetails', { id: parseInt(s, 10), type: orderType });
      objRechargeReceipt = rows.length ? mapRow(rows[0], RechargeReceipt) : null;
    } catch (ex) {
      // catch (Exception ex) { }  (swallowed)
    }
    res.json({ view: '~/Views/CustomerPanel/Completed_Recharge_Receipt/Index.cshtml', Model: objRechargeReceipt });
  }));

module.exports = router;
