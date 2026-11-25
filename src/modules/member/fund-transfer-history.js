'use strict';
// Ported from Member\Controllers\CustomerPanel\Fund_Transfer_History.cs (Fund_Transfer_HistoryController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Fund_Transfer_History';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const PROPS = ['RowNumber', 'FromPlid', 'ToPlid', 'FromUsername', 'ToUsername', 'ToEmail', 'ToFullName', 'Amount', 'Date', 'Remark', 'Type', 'CreditType'];

// route-config: referral/jncL6ed1F1tdnElcfQttRmImitjHyXW6
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/jncL6ed1F1tdnElcfQttRmImitjHyXW6'], ...guard, asyncHandler(async (req, res) => {
  let { fromDate, toDate, Username, Type, typeofcrdr } = req.p;
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : parseInt(req.p.page, 10);
  if (fromDate === undefined || fromDate === null) fromDate = '';
  if (toDate === undefined || toDate === null) toDate = '';
  if (Username === undefined || Username === null) Username = '';
  if (Type === undefined || Type === null) Type = '0';
  if (typeofcrdr === undefined || typeofcrdr === null) typeofcrdr = '0';
  const Plid = Number(req.user.plid);
  const ViewBag = { Plid };
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_transferfundtouser', {
    Mode: '3', TMFTHID: '0', PLID: Plid, ToPlid: '0', Amount: '0', Remark: Username, FromDate: fromDate, ToDate: toDate,
    StartRowIndex: page, MaxRows, SearchUsername: '', TYPEOFCRDR: typeofcrdr,
  });
  // PORT-NOTE: OUT parameters @TotalCount / @StrResult are read from columns of the first result row
  const tc = outv(rows, 'totalcount');
  if (tc === undefined || tc === null) throw new TypeError('Object reference not set to an instance of an object.');
  const TotalRecord = parseInt(tc, 10);
  const sr = outv(rows, 'strresult');
  if (sr === undefined || sr === null) throw new TypeError('Object reference not set to an instance of an object.');
  const Arr = String(sr).split('^');
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
  ViewBag.TotalCountamt = null; // legacy put the (unused) @Totalamount SqlParameter object in the ViewBag
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
}));

module.exports = router;
