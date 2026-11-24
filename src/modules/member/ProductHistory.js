'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/ProductHistory.cs (ProductHistoryController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: ProductHistoryList -> referral/cxy1VCGr5YOMslJB0cZseAhisH
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
const C = 'ProductHistory';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const P_PH = ['RowNumber', 'TKPMID', 'PLID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Username', 'MRP', 'Prname', 'Code', 'Name', 'LastCreate', 'PRcode', 'TKPID', 'DATEDON', 'Emp_Name',
  'TYPE', 'QUANTITY', 'REMARK'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/cxy1VCGr5YOMslJB0cZseAhisH'], auth, asyncHandler(async (req, res) => {
  let { fromDate, toDate, ProductName, Type, PrCode } = req.p;
  let page = optInt(req.p.page);
  fromDate = nz(fromDate); toDate = nz(toDate); ProductName = nz(ProductName); PrCode = nz(PrCode); Type = nz(Type);
  if (page === null) page = 1;
  if (Type === 'InStock' || Type === 'instock') Type = 'CR';
  if (Type === 'OutStock' || Type === 'outstock') Type = 'DR';
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    const MaxRows = 10;
    // PORT-NOTE: @TOTALCOUNT OUT is the "totalcount" column of the first result row (0 when empty)
    const raw = await proc(DB, 'usp_memberstockledger', { type: Type, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows, regno: Plid, prcode: PrCode });
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = totalOf(raw);
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    return res.json({ Model: mapRows(raw, P_PH), ViewBag });
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'USP_FranchisePending_BYMember');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ redirect: '/page-not-found', ViewBag });
  }
}));

module.exports = router;
