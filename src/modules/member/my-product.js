'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/MyProduct.cs (MyProductController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: MyProductList -> referral/cxy1VCGr5YOMslJB0cZseAMyl!st   ("!" is reserved in Express 5 path syntax => escaped)
 * No session check in legacy but Session["plid"] is read => auth.
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const C = 'MyProduct';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, n) => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const P_MYPRODUCT = ['RowNumber', 'TKPMID', 'PLID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Username', 'MRP', 'Prname', 'Code', 'Name', 'LastCreate', 'PRcode', 'TKPID'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/cxy1VCGr5YOMslJB0cZseAMyl\\!st'], auth, asyncHandler(async (req, res) => {
  let { ProductName, OutStock, fromDate, toDate } = req.p;
  let page = optInt(req.p.page);
  ProductName = nz(ProductName);
  if (page === null) page = 1;
  fromDate = nz(fromDate); toDate = nz(toDate);
  if (OutStock === 'false' || OutStock === undefined || OutStock === null) OutStock = '';
  if (OutStock === 'true') OutStock = '0';
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    const MaxRows = 50;
    // PORT-NOTE: @SpOutputCount OUT is the "spoutputcount" column of the first result row (0 when empty)
    const raw = await proc(DB, 'usp_getproductdetails', { fromdate: fromDate, todate: toDate, outstock: OutStock, productname: ProductName, startrowindex: page, maxrows: MaxRows, regno: Plid });
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = totalOf(raw, 'spoutputcount');
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    return res.json({ Model: mapRows(raw, P_MYPRODUCT), ViewBag });
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'USP_FranchisePending_BYMember');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ redirect: '/page-not-found', ViewBag });
  }
}));

module.exports = router;
