'use strict';
// Ported from Member\Controllers\CustomerPanel\BinaryPayoutController.cs (Common.Controllers.CustomerPanel.BinaryPayoutController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/BinaryPayout';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
// PORT-NOTE: OUT parameters (@TotalCount, @TOTALBINARYINCOME) are read from columns of the first result row (0 when absent / NULL)
const numOut = (rows, name) => { const v = outv(rows, name); return v === undefined || v === null || v === '' ? 0 : Number(v); };
const PROPS = ['ROWNUMBER', 'PAYDATE', 'MPID', 'LOGINID', 'PAYFROM', 'PAYTO', 'BINARYINCOME', 'GROUPBONUS', 'ACTIVE', 'PAYID', 'USERNAME', 'NAME', 'OLBV', 'ORBV', 'CRBV', 'CLBV', 'TLBV', 'TRBV', 'MATCHBV', 'PAIDBV', 'FLUSHBV', 'CFLBV', 'CFRBV', 'Mobile', 'EmailID', 'TDS', 'ADMINCHARGE'];

// route-config: referral/ePvwNBzxRC_plus_wv_plus_oMfQmHtQ==
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/ePvwNBzxRC_plus_wv_plus_oMfQmHtQ=='], ...guard, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate } = req.p;
  let payid = req.p.payid === undefined || req.p.payid === null || req.p.payid === '' ? null : parseInt(req.p.payid, 10);
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : parseInt(req.p.page, 10);
  if (payid === null) payid = 0;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (toDate === undefined || toDate === null) toDate = '';
  if (fromDate === undefined || fromDate === null) fromDate = '';
  const Plid = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  let loginid = '';
  const row = await db.queryOne(DB, 'select loginid from member_master where regno = @r limit 1', { r: Plid });
  if (row) loginid = row.loginid;
  const rows = await db.proc(DB, 'uspgetmemberpayoutreport', {
    StartRowIndex: page, MaxRows, PayID: payid, REGNO: Plid, SearchField: '', SearchValue: '', fromDate, ToDate: toDate, LoginId: loginid, Mode: 0,
  });
  const TotalRecord = numOut(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    payid,
  };
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
}));

module.exports = router;
