'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\Courierchallan.cs (CourierchallanController) */
const express = require('express');
const { scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Courierchallan';

// auth (null session => RedirectToAction("Index","Home")) // route-config: franchisee/1ah_plus_8ZlvFs6vFIZAF9aQiQ==
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/1ah_plus_8ZlvFs6vFIZAF9aQiQ==', '/franchise/franchisee/1ah_plus_8ZlvFs6vFIZAF9aQiQ%3D%3D'], auth, asyncHandler(async (req, res) => {
  let DocketNo = ''; let InvoiceNo = ''; let Orderid = '';
  let Invoiceno = await UtilityClass.Decryptword(req.p.Invoiceno);
  Invoiceno = String(Invoiceno).replace(/^,+|,+$/g, '');
  const rows = await proc('shopping', 'USP_COURIERCHALLAN', { invoiceno: Invoiceno });
  const Chllanlist = mapRows(rows, ['INVOICENO', 'ORDERID', 'CHALLANNO', 'CHALLANDATE', 'DOCKETNO', 'CUSTOMERNAME', 'ADDRESS', 'CITY', 'COUNTRY', 'STATE',
    'PINCODE', 'MOBILE', 'SHIPPEDBY', 'COMPANYNAME', 'PICK_ADDRESS', 'PICK_LANDMARK', 'PICK_STATE', 'PICK_COUNTRY', 'PICK_CITY', 'PICK_AREA',
    'PICK_PINCODE', 'PAYMODE', 'SUBCATNAME', 'MAINCATNAME', 'GSTNO', 'CINNO']);
  for (const row of Chllanlist) { DocketNo = row.DOCKETNO; InvoiceNo = row.INVOICENO; Orderid = row.ORDERID; }
  const v = await scalar('shopping',
    'SELECT SUM(coalesce(TOTAL_PURCHASE_COST,0)) FROM TBL_PRODUCT_ORDER_MASTER WHERE INVOICENO = @i and OrderId = @o', { i: InvoiceNo, o: Orderid });
  res.json({ Model: Chllanlist, TOTALCODAMOUNT: v === null || v === undefined ? 0 : v });
}));

module.exports = router;
