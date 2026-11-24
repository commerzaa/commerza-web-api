'use strict';
// Port of Member\Common\Controllers\CustomerPanel\ShoppingCard.cs (ShoppingCardController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const ShoppingProducts = ['ROWNUMBER', 'TKPMID', 'PRODNAME', 'PRODIMAGE', 'PRODCOLOR', 'PRODSIZE', 'PRODSELLAR', 'PRODMRP', 'PRODDISCOUNT', 'CARTCOUNT', 'QTYCOUNT', 'PRODDELIVERYCHARGES', 'GSTPERCENTAGE', 'FRID', 'DP', 'BV', 'QUANTITY', 'TotalPrice', 'TotalGST', 'TOTALBV'];
const regNoOf = (req) => (req.user && req.user.plid !== undefined && req.user.plid !== null ? parseInt(req.user.plid, 10) : 0);

// route-config: referral/Shopping-Cart -> ShoppingCard/Index
// auth
router.all(['/member/ShoppingCard/Index{/:id}', '/member/referral/Shopping-Cart'], auth, asyncHandler(async (req, res) => {
  const RegNo = regNoOf(req);
  let shoppingProducts = [];
  const ViewBag = {};
  try {
    shoppingProducts = mapRows(await db.proc(DB, 'usp_getusershoppingcartproducts', { regno: RegNo }), ShoppingProducts);
    const sb = await db.scalar(DB, "SELECT CAST(ACTIVE AS INT) FROM SETTINGS WHERE CAPTION='BV IN CART' limit 1", {});
    ViewBag.ShowHideBV = sb === null || sb === undefined ? 0 : sb;
    const pc = await db.scalar(DB, 'SELECT coalesce(COUNT(1),0) FROM TBL_ADDTOCART WHERE STATUS=1 AND REGNO=@r', { r: RegNo });
    ViewBag.ProdCount = pc === null || pc === undefined ? 0 : pc;
    return res.json({ Model: shoppingProducts, ...ViewBag });
  } catch (ex) {
    return res.json({ Model: shoppingProducts, ...ViewBag });
  }
}));

// auth
router.post('/member/ShoppingCard/RemoveProductFromCartByProdId{/:id}', auth, asyncHandler(async (req, res) => {
  const productId = parseInt(req.p.productId, 10);
  const FRID = parseInt(req.p.FRID, 10);
  const RegNo = regNoOf(req);
  let intResult = 0;
  try {
    intResult = await db.exec(DB, 'UPDATE TBL_ADDTOCART SET STATUS=0 WHERE TKPMID=@p AND STATUS=1 AND REGNO=@r And Frid=@f', { p: productId, r: RegNo, f: FRID });
    const count = await db.scalar(DB, 'SELECT coalesce(COUNT(1),0) FROM TBL_ADDTOCART WHERE STATUS=1 AND REGNO=@r', { r: RegNo });
    if (Number(count) === 0) {
      await db.exec(DB, 'UPDATE PACKAGEADD SET STATUS=0 WHERE ACTIVE=0 AND STATUS=1 AND REGNO=@r', { r: RegNo });
    }
    return res.json(intResult);
  } catch (ex) {
    return res.json(intResult);
  }
}));

// auth
router.post('/member/ShoppingCard/MinusProductByProdId{/:id}', auth, asyncHandler(async (req, res) => {
  const productId = parseInt(req.p.productId, 10);
  const FRID = parseInt(req.p.FRID, 10);
  const RegNo = regNoOf(req);
  const intResult = 0; // SqlQuery<int>(UPDATE ...).FirstOrDefault() yields no rows => 0
  try {
    await db.exec(DB, 'UPDATE TBL_ADDTOCART SET QTY=(coalesce(QTY,0)-1) WHERE TKPMID=@p AND STATUS=1 AND REGNO=@r And Frid=@f', { p: productId, r: RegNo, f: FRID });
    return res.json(intResult);
  } catch (ex) {
    return res.json(intResult);
  }
}));

// auth
router.post('/member/ShoppingCard/PlusProductByProdId{/:id}', auth, asyncHandler(async (req, res) => {
  const productId = parseInt(req.p.productId, 10);
  const FRID = parseInt(req.p.FRID, 10);
  const RegNo = regNoOf(req);
  const intResult = 0;
  try {
    const a = await db.scalar(DB, 'select AVAILABLE from TBL_FRANCHISESTOCKMASTER where TKPID=@p AND STATUS=1 and FRID=@f limit 1', { p: productId, f: FRID });
    const q = await db.scalar(DB, 'select QTY from TBL_ADDTOCART WHERE TKPMID=@p AND STATUS=1 and FRID=@f AND REGNO=@r limit 1', { p: productId, f: FRID, r: RegNo });
    const AVAILABLE = a === null || a === undefined ? 0 : Number(a);
    const QTY = q === null || q === undefined ? 0 : Number(q);
    if (QTY >= AVAILABLE) {
      return res.json('Out Of Stock.');
    }
    await db.exec(DB, 'UPDATE TBL_ADDTOCART SET QTY=(coalesce(QTY,0)+1) WHERE TKPMID=@p AND STATUS=1 AND REGNO=@r', { p: productId, r: RegNo });
    return res.json(intResult);
  } catch (ex) {
    return res.json(intResult);
  }
}));

// auth
router.post('/member/ShoppingCard/PlaceOrder{/:id}', auth, asyncHandler(async (req, res) => {
  const RegNo = regNoOf(req);
  let intResult = '';
  try {
    const rows = await db.proc(DB, 'usp_placeorderfromcart', { regno: RegNo });
    const o = outv(rows, 'stroutput');
    intResult = String(o === null ? '' : o).toLowerCase();
    return res.json(intResult);
  } catch (ex) {
    return res.json(intResult);
  }
}));

module.exports = router;
