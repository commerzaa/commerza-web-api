// Ported from ClusterofferShopingPortal\Controllers\Login_as_MobileController.cs (class Login_as_MobileController => /portal/Login_as_Mobile/...)
'use strict';
// Database: shopping (Db_Shopping).
// Login action (SESSION.md 4): Index does Session["Plid"] = ObjLogin (USP_PORTALLOGIN_M_CUSTOMER direct) => ps.issueCustomerToken.
// PORT-NOTE: legacy auto-login by CLID + DID (reads PHONE / PASSWORD of TBL_CUSTOMERLOGIN, no check at all); kept public as legacy.
//   Anyone knowing a CLID gets a customer token.
// PORT-NOTE: legacy concatenated clid / SPRID / DID into the SQL; parameterised here.
// PORT-NOTE: numeric columns arrive as JS numbers (pg type parser); decimal(18,2) values are re-formatted with 2 decimals so the cart
//   string matches the C# decimal.ToString() of the EF entity (SellMRP, DAP, BV, PV are decimal(18,2)).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { toDecimalStr, decMulInt, fmt00, dec2 } = require('./_shared/batch-10-common');
const { DB, NRE, ci, mvcStr, mvcInt32, mvcInt64, toInt32, toInt64, content, redirectJson } = require('./_shared/batch-20-common');

const router = express.Router();
const C = '/portal/Login_as_Mobile';

const cs = (v) => (v === null || v === undefined ? '' : String(v));
const firstCol = (row) => (row ? row[Object.keys(row)[0]] : null);
/** String.Trim(char) */
const trimChar = (s, ch) => { let a = 0; let b = s.length; while (a < b && s[a] === ch) a++; while (b > a && s[b - 1] === ch) b--; return s.slice(a, b); };
/** decimal(18,2) column value => C# decimal.ToString() ("" when null, as string concatenation of a null decimal?) */
const d2 = (v) => dec2(v);
/** decimal non-nullable column: null => EF materialisation error */
const d2req = (v, name) => {
  if (v === null || v === undefined) throw new Error(`The '${name}' property on 'Product_Master_Sub' could not be set to a 'null' value.`);
  return dec2(v);
};

/** Session["Plid"] DID: Nullable<int> DID = 0; if (LoginDetails != null) DID = LoginDetails.DID; */
function loginDid(req) {
  const L = ps.getCustomerLogin(req);
  if (L == null) return 0;
  return L.DID === undefined ? null : L.DID;
}

/** select isnull(DPW.BV,0) as BV,isnull(DPW.PV,0) as PV from IMS_SubProduct VP LEFT join Tbl_DISTRIBUTOR_Comm_ProductWise DPW ... */
async function distributorBvPv(SPRID, DID) {
  const row = await db.queryOne(DB, `select coalesce(dpw.bv, 0) as bv, coalesce(dpw.pv, 0) as pv
      from ims_subproduct vp left join tbl_distributor_comm_productwise dpw on dpw.sprid = vp.sprid
     where dpw.sprid = @SPRID and did = @DID and coalesce(dpw.bv, 0) > 0 and coalesce(dpw.pv, 0) > 0 limit 1`, { SPRID, DID });
  if (row == null) return { bv: '0.00', pv: '0.00' };
  return { bv: fmt00(String(row.bv)), pv: fmt00(String(row.pv)) }; // bv.ToString("0.00")
}
/** db._Product_Master_Sub.Where(b => b.SPRID == x && b.IsActive == true).FirstOrDefault() */
const productSub = (SPRID) => db.queryOne(DB, 'select * from ims_subproduct where sprid = @SPRID and isactive = true limit 1', { SPRID });

// ---------------------------------------------------------------- Index(Int64 clid, int did)
// route-config: "Login-Mobile" -> Login_as_Mobile/Index
// public (login action, see PORT-NOTE)
router.all([`${C}/Index{/:id}`, C, '/portal/Login-Mobile'], ps.portalSession, asyncHandler(async (req, res) => {
  const clid = mvcInt64(req, 'clid');
  const did = mvcInt32(req, 'did');
  const name = firstCol(await db.queryOne(DB, 'select phone from tbl_customerlogin where clid = @clid limit 1', { clid }));
  const Password = firstCol(await db.queryOne(DB, 'select password from tbl_customerlogin where clid = @clid limit 1', { clid }));
  const loginRow = await db.procOne(DB, 'usp_portallogin_m_customer', {
    username: name === undefined ? null : name, password: Password === undefined ? null : Password, ipaddress: '', did,
  });
  const ObjLogin = loginRow ? mapRow(loginRow, ps.LOGIN_PROPS) : null;
  let token;
  if (ObjLogin) token = ps.issueCustomerToken(ObjLogin, req); // Session["Plid"] = ObjLogin
  else ps.sessionRemove(req, 'Plid');
  ps.sessionSet(req, 'Cart', null);
  // ViewBag.masterpageshow is computed from Session["LoginwithMobile"] but discarded by the redirect.
  ps.sessionSet(req, 'LoginwithMobile', 'MobileLogin');
  return redirectJson(res, '/Proceed_To_CheckOut/Index', token);
}));

// ---------------------------------------------------------------- InsertProductInCart(Int64 PRID, string Type, int QTY)
// public (legacy: no session check; uses Session["Cart"] / Session["Plid"] when present)
router.all(`${C}/InsertProductInCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = mvcInt64(req, 'PRID');
  const Type = mvcStr(req, 'Type');
  mvcInt32(req, 'QTY'); // bound, unused
  let ReturnValue = 'added';
  if (ps.sessionGet(req, 'Cart') == null) ps.sessionSet(req, 'Cart', '');
  let newstringval = '';
  const val = trimChar(cs(ps.sessionGet(req, 'Cart')), '|').trim();
  const splitrecords = val.split('|');
  let i = 0;
  const cart = splitrecords.length;
  if (cart > 9) {
    ReturnValue = 'Your Cart is Full Please Place Your Order';
    return content(res, ReturnValue);
  }
  if (val !== '') {
    for (const rcrd of splitrecords) {
      const splitvales = rcrd.split('^');
      const at = (k) => { if (k >= splitvales.length) throw new Error('Index was outside the bounds of the array.'); return splitvales[k]; };
      const po = {
        SPRID: toInt64(at(0)),
        PrTitle: at(1),
        sellMRP: toDecimalStr(at(2)),
        DAP: toDecimalStr(at(3)),
        Images: at(4),
        quantity: toInt32(at(5)),
        CheckoutType: at(6),
      };
      const DID = loginDid(req);
      if (DID !== null && DID > 0) {
        const { bv, pv } = await distributorBvPv(po.SPRID, DID);
        newstringval += `${po.SPRID}^${po.PrTitle}^${po.sellMRP}^${po.DAP}^${po.Images}^${po.quantity}^${bv}^${pv}`;
      } else {
        const RowSubcat = await productSub(po.SPRID);
        if (RowSubcat == null) throw NRE();
        newstringval += `${po.SPRID}^${po.PrTitle}^${po.sellMRP}^${po.DAP}^${po.Images}^${po.quantity}^${d2(ci(RowSubcat, 'bv'))}^${d2(ci(RowSubcat, 'pv'))}`;
      }
      if (po.SPRID === PRID) i = 1;
      if (Type === 'BuyNow') newstringval += '^BuyNow^|';
      else newstringval += '^AddToCart^|';
    }
  }
  if (i === 0) {
    const RowSubcat = await productSub(PRID);
    const DID = loginDid(req);
    if (RowSubcat == null) throw NRE();
    const Row = await db.queryOne(DB, 'select * from ims_masterproduct where mprid = @MPRID limit 1', { MPRID: ci(RowSubcat, 'mprid') });
    const images = ci(RowSubcat, 'productimages');
    if (images === null || images === undefined) throw NRE();
    const splitimg = String(images).split('^');
    let splitimage = splitimg[0];
    if (splitimage === '') splitimage = 'default-product-image.png';
    if (Row == null) throw NRE();
    const SellMRP = d2req(ci(RowSubcat, 'sellmrp'), 'SellMRP');
    const DAP = d2req(ci(RowSubcat, 'dap'), 'DAP');
    if (DID !== null && DID > 0) {
      const { bv, pv } = await distributorBvPv(PRID, DID);
      newstringval += `${ci(RowSubcat, 'sprid')}^${cs(ci(Row, 'producttitle'))}^${SellMRP}^${DAP}^${splitimage}^1^${bv}^${pv}`;
    } else {
      const RowSubcat2 = await productSub(PRID);
      if (RowSubcat2 == null) throw NRE();
      newstringval += `${ci(RowSubcat, 'sprid')}^${cs(ci(Row, 'producttitle'))}^${SellMRP}^${DAP}^${splitimage}^1^${d2(ci(RowSubcat2, 'bv'))}^${d2(ci(RowSubcat2, 'pv'))}`;
    }
    if (Type === 'BuyNow') {
      ps.sessionSet(req, 'BuyNow', true);
      newstringval += '^BuyNow';
    } else {
      ps.sessionSet(req, 'BuyNow', null);
      newstringval += '^AddToCart';
    }
    newstringval += '^|';
  }
  newstringval = trimChar(newstringval.trim(), '|').trim();
  ps.sessionSet(req, 'Cart', newstringval);
  if (i !== 0) ReturnValue = 'no';
  return content(res, ReturnValue);
}));

// ---------------------------------------------------------------- NewInsertProductInCart(Int64 PRID, string Type)
// public (anonymous cart allowed: CLID 0 when no session)
router.all(`${C}/NewInsertProductInCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = mvcInt64(req, 'PRID');
  mvcStr(req, 'Type'); // bound, only used by the commented-out legacy code
  let ReturnValue = 'added';
  const i = 0;
  if (ps.sessionGet(req, 'ManageCart') == null) ps.sessionSet(req, 'ManageCart', 'SyncCart');
  const sessionId = ps.getSid(req);
  let CustCLID = 0;
  if (ps.isCustomer(req)) CustCLID = toInt32(req.user.plid);
  if (i === 0) {
    // [DBO].[USP_MANAGEADDTOCART] @MODE,@SPRID,@CLID,@QTY,@SESSIONID,@STROUTPUT OUT  (cartStatus unused)
    await db.proc(DB, 'usp_manageaddtocart', { mode: 1, sprid: PRID, clid: CustCLID, qty: 1, sessionid: sessionId });
  }
  if (i !== 0) ReturnValue = 'no';
  return content(res, ReturnValue);
}));

// ---------------------------------------------------------------- updateQty(Int64 PRID, int qty)
// public (legacy: no session check; works on Session["Cart"])
router.all(`${C}/updateQty{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = mvcInt64(req, 'PRID');
  const qty = mvcInt32(req, 'qty');
  if (ps.sessionGet(req, 'Cart') == null) ps.sessionSet(req, 'Cart', '');
  let totalAmount = '0';
  let newstringval = '';
  const val = trimChar(cs(ps.sessionGet(req, 'Cart')), '|').trim();
  const splitrecords = val.split('|');
  for (const rcrd of splitrecords) {
    const splitvales = rcrd.split('^');
    const at = (k) => { if (k >= splitvales.length) throw new Error('Index was outside the bounds of the array.'); return splitvales[k]; };
    const po = {
      SPRID: toInt64(at(0)),
      PrTitle: at(1),
      sellMRP: toDecimalStr(at(2)),
      DAP: toDecimalStr(at(3)),
      Images: at(4),
      quantity: toInt32(at(5)),
      CheckoutType: at(6),
      ProductRealAmount: toDecimalStr(at(3)),
    };
    if (po.SPRID === PRID) po.quantity = qty;
    const decqty = po.quantity;
    totalAmount = decMulInt(po.ProductRealAmount, decqty);
    const RowSubcat = await db.queryOne(DB, 'select bv, pv from ims_subproduct where isactive = true and sprid = @SPRID limit 1', { SPRID: po.SPRID });
    if (RowSubcat == null) throw NRE();
    const BV = ci(RowSubcat, 'bv'); const PV = ci(RowSubcat, 'pv');
    if (BV === null || BV === undefined || PV === null || PV === undefined) {
      throw new Error("The cast to value type 'System.Decimal' failed because the materialized value is null.");
    }
    newstringval += `${po.SPRID}^${po.PrTitle}^${po.sellMRP}^${totalAmount}^${po.Images}^${po.quantity}^${decMulInt(fmt00(String(BV)), decqty)}`
      + `^${decMulInt(fmt00(String(PV)), decqty)}^${po.ProductRealAmount}^AddToCart|`;
  }
  ps.sessionSet(req, 'Cart', newstringval);
  return res.json(`${totalAmount}|${newstringval}`);
}));

module.exports = router;
