'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Auto_PurchaseincomeController.cs (Auto_PurchaseincomeController -> controller "Auto_Purchaseincome", 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: AutoPurchaseIncome -> referral/auto-purchase-income (id optional)
 */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const C = 'Auto_Purchaseincome';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
const P_AUTOPURCHASE = ['ROWNUMBER', 'USERNAME', 'Name', 'MOBILE', 'DATE', 'ADMINCHARGE', 'TDS', 'NetIncome', 'MatchCount', 'TotalIncome'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/auto-purchase-income{/:id}'], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  SearchField = nz(SearchField); SearchValue = nz(SearchValue); fromdate = nz(fromdate); todate = nz(todate);
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  void loginid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @TOTALCOUNT / @TOTALINCOME / @TOTALNETINCOME OUT params are same-named columns of the first result row (0 when empty)
  const raw = await proc(DB, 'usp_auto_purchaseincome', {
    startrowindex: page, maxrows: MaxRows, regno: Math.trunc(Plid), searchfield: String(SearchField).trim(), searchvalue: String(SearchValue).trim(), fromdate: String(fromdate).trim(),
    todate: String(todate).trim(),
  });
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(raw);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  res.json({ Model: mapRows(raw, P_AUTOPURCHASE), ViewBag });
}));

module.exports = router;
