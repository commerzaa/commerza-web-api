'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/GenerateCoupon.cs (GenerateCouponController)
// Actions: Index, GenerateCouponFunction (2)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, outOf, csStr } = require('./_shared/batch-04-common');

const router = express.Router();

/** Convert.ToDouble(string): null => 0, invalid => FormatException */
function toDouble(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  const n = Number(s);
  if (s === '' || !Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

// public (legacy had no session check; view only). route-config: "referral/generatecoupon" is commented out.
router.all(['/portal/GenerateCoupon/Index{/:id}', '/portal/GenerateCoupon'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/GenerateCoupon/Index.cshtml' });
});

// auth (legacy cast (Login)Session["Plid"] without a null check)
router.all('/portal/GenerateCoupon/GenerateCouponFunction{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const CouponAmount = mvcStr(req.p.CouponAmount);
  const Quantity = mvcStr(req.p.Quantity);
  const CommentOrRemark = mvcStr(req.p.CommentOrRemark);
  let ReturnOutput = '';
  const PLID = Number(req.user.plid);
  const TOTALAMOUNT = toDouble(toDouble(CouponAmount) * toDouble(Quantity));
  // SP_GENERATECOUPON_NEW @QTY,@AMOUNT,@TOTALAMOUNT,@PLID,@STRRESULT Out,@CommentOrRemark
  const rows = await db.proc(DB, 'sp_generatecoupon_new', {
    qty: Quantity, amount: CouponAmount, totalamount: TOTALAMOUNT, plid: PLID, commentorremark: CommentOrRemark,
  });
  ReturnOutput = csStr(outOf(rows, 'strresult'));
  res.json(ReturnOutput);
}));

module.exports = router;
