'use strict';
// Ported from Member\Controllers\CustomerPanel\Product_Detail.cs (Product_DetailController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, optionalAuth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Product_Detail';
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const PRODUCT = ['ROWNUMBER', 'TKPMID', 'PRODUCTNAME', 'PRODUCTIMAGE', 'PRODUCTMRP', 'PRODUCTDESCRIPTION', 'PRODUCTDISCOUNT', 'PRODUCTREVIEWSCOUNT'];
const ATTR = ['Title', 'Content'];

// route-config: p/{PrName}/{PrCode} and referral/G3pAMJ553_slash_EVT87l9productdetailcm75NKIzwKMUX4QEVT87l9cm75NKIzwKMUX4Q
// auth ([SessionExpireCheck])
router.all([
  `${P}/Index{/:id}`,
  '/member/p/:PrName/:PrCode',
  '/member/referral/G3pAMJ553_slash_EVT87l9productdetailcm75NKIzwKMUX4QEVT87l9cm75NKIzwKMUX4Q{/:id}',
], ...guard, asyncHandler(async (req, res) => {
  let pid = req.p.pid;
  if (pid === undefined || pid === null) pid = '';
  // new ProductDetails() default values
  let productDetails = { ROWNUMBER: 0, TKPMID: 0, PRODUCTNAME: null, PRODUCTIMAGE: null, PRODUCTMRP: 0, PRODUCTDESCRIPTION: null, PRODUCTDISCOUNT: 0, PRODUCTREVIEWSCOUNT: 0 };
  const ViewBag = {};
  try {
    if (pid !== '') {
      pid = await UtilityClass.Decryptword(pid);
      const rows = await db.proc(DB, 'usp_getproductdetailsbyid', { TKPMID: pid });
      productDetails = rows && rows.length ? mapRows([rows[0]], PRODUCT)[0] : null;
      if (productDetails === null || productDetails.PRODUCTDESCRIPTION === null || productDetails.PRODUCTDESCRIPTION === undefined) throw NRE();
      ViewBag.productdesc = String(productDetails.PRODUCTDESCRIPTION).split('&nbsp;').join('');
      const arows = await db.proc(DB, 'usp_getattribute', { TKPMID: pid });
      ViewBag.attr = mapRows(arows, ATTR);
    }
  } catch (ex) {
    productDetails = null;
  }
  res.json({ Model: productDetails, ViewBag });
}));

// public-with-session-message (legacy returns "Session expired!" as JSON instead of redirecting)
router.post(`${P}/AddToCart{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  let ResultOutput = '';
  let RegNo = 0;
  let prodCount = 0;
  try {
    if (req.user && req.user.plid !== undefined && req.user.plid !== null) {
      RegNo = Math.trunc(Number(req.user.plid));
    } else {
      ResultOutput = 'Session expired!';
      return res.json(ResultOutput);
    }
    const { TKPMID, Type } = req.p;
    const qty = parseInt(req.p.qty, 10);
    const rows = await db.proc(DB, 'usp_addtocartprocess', { TKPMID, REGNO: RegNo, FRID: 1, QTY: qty, MODE: Type });
    const so = outv(rows, 'stroutput');
    const sc = outv(rows, 'strcount');
    if (so === undefined || so === null) throw NRE();
    ResultOutput = String(so);
    prodCount = Math.trunc(Number(sc === undefined || sc === null ? 0 : sc));
    return res.json(ResultOutput + '^' + prodCount);
  } catch (ex) {
    return res.json(ResultOutput);
  }
}));

module.exports = router;
