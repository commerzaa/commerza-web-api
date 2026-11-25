'use strict';
const DB = 'shopping';
/** Ported from Merchant Panel Controllers/CustomerPanel/Courierchallan.cs (CourierchallanController) */
const express = require('express');
const { scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const P = '/merchant/Courierchallan';

// auth (null session => RedirectToAction("Index","Home")) // route-config: merchant/1ah_plus_8ZlvFs6vFIZAF9aQiQ==
router.all([`${P}/Index{/:id}`, '/merchant/merchant/1ah_plus_8ZlvFs6vFIZAF9aQiQ==', '/merchant/merchant/1ah_plus_8ZlvFs6vFIZAF9aQiQ%3D%3D'], auth, asyncHandler(async (req, res) => {
  let DocketNo = ''; let InvoiceNo = ''; let Orderid = '';
  let Invoiceno = await UtilityClass.Decryptword(req.p.Invoiceno);
  Invoiceno = String(Invoiceno).replace(/^,+|,+$/g, '');
  const rows = await proc(DB, 'USP_COURIERCHALLAN', { invoiceno: Invoiceno });
  const Chllanlist = mapRows(rows, ['INVOICENO', 'ORDERID', 'CHALLANNO', 'CHALLANDATE', 'DOCKETNO', 'CUSTOMERNAME', 'ADDRESS', 'CITY',
    'PINCODE', 'MOBILE', 'SHIPPEDBY', 'COMPANYNAME', 'PICK_ADDRESS', 'PICK_LANDMARK', 'PICK_STATE', 'PICK_CITY', 'PICK_AREA',
    'PICK_PINCODE', 'PAYMODE', 'SUBCATNAME', 'MAINCATNAME', 'GSTNO']);
  for (const row of Chllanlist) { DocketNo = row.DOCKETNO; InvoiceNo = row.INVOICENO; Orderid = row.ORDERID; }
  const v = await scalar(DB,
    'SELECT SUM(coalesce(TOTAL_PURCHASE_COST,0)) FROM TBL_PRODUCT_ORDER_MASTER WHERE INVOICENO = @i and OrderId = @o', { i: InvoiceNo, o: Orderid });
  res.json({ Model: Chllanlist, TOTALCODAMOUNT: v === null || v === undefined ? 0 : v });
}));

module.exports = router;
