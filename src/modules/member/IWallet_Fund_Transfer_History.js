'use strict';
/** Port of Member/Controllers/CustomerPanel/IWallet_Fund_Transfer_History.cs (IWallet_Fund_Transfer_HistoryController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['RowNumber', 'FromPlid', 'ToPlid', 'FromUsername', 'ToUsername', 'ToEmail', 'ToFullName', 'Amount', 'Date', 'Remark', 'Type', 'CreditType'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };

// route-config: referral/i-wallet-fund-transfer-history -> Index
// auth ([SessionExpireCheck])
router.all(['/member/IWallet_Fund_Transfer_History/Index{/:id}', '/member/referral/i-wallet-fund-transfer-history'], auth, asyncHandler(async (req, res) => {
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  let page = optInt(req.p.page);
  const Username = nn(req.p.Username);
  let Type = req.p.Type;
  let typeofcrdr = req.p.typeofcrdr;
  if (Type === undefined || Type === null || Type === '') Type = '0'; // MVC binds an empty string to null
  if (typeofcrdr === undefined || typeofcrdr === null || typeofcrdr === '') typeofcrdr = '0';
  try {
    const Plid = Number(req.user.plid);
    const ViewBag = { Plid };
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    // PORT-NOTE: @StrResult / @TotalCount OUT params are returned as columns of the result row.
    const rows = await proc(DB, 'usp_transferfundtouser', {
      mode: '5', tmfthid: '0', plid: Plid, toplid: '0', amount: '0', remark: Username, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
      searchusername: '', typeofcrdr,
    });
    const Data = mapRows(rows, PROPS);
    const tc = parseInt(outCol(rows, 'totalcount'), 10);
    const TotalRecord = Number.isNaN(tc) ? 0 : tc;
    const Arr = outCol(rows, 'strresult').split('^');
    ViewBag.TotalCr = '0';
    ViewBag.TotalDr = '0';
    if (Arr.length > 2) {
      ViewBag.TotalCr = Arr[1];
      ViewBag.TotalDr = Arr[2];
    }
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.Username = Username;
    ViewBag.Type = Type;
    ViewBag.typeofcrdr = typeofcrdr;
    // PORT-NOTE: legacy put the (never populated) @Totalamount SqlParameter object into ViewBag.TotalCountamt; no value to serialise.
    ViewBag.TotalCountamt = null;
    return res.json({ view: '~/Views/CustomerPanel/IWallet_Fund_Transfer_History/Index.cshtml', Model: Data, ViewBag });
  } catch (ExpObj) {
    await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_TransferFundToUser', 0, req.originalUrl.split('?')[0]);
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
}));

module.exports = router;
