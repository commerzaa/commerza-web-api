'use strict';
// Ported from Member\Controllers\CustomerPanel\ATC_Topup_Request_List.cs (1 action) - database: affiliate
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const nz = (v) => (v === undefined || v === null ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}

// auth
// route-config: referral/xN7ZZCwoYQ5rxh4YU0RZ8Hh3rupfJtpcnNhZhGZ0LWE= -> Index
router.all(['/member/ATC_Topup_Request_List/Index{/:id}', '/member/referral/xN7ZZCwoYQ5rxh4YU0RZ8Hh3rupfJtpcnNhZhGZ0LWE='], auth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize();
  let page = intOrNull(req.p.page);
  if (page === null) page = 1;
  const fromDate = nz(req.p.fromDate); const toDate = nz(req.p.toDate);
  let Model = [];
  const out = {};
  try {
    const Plid = Number(req.user.plid);
    const RegNo = Number(await db.scalar(DB, 'select regno from member_master where regno=@plid limit 1', { plid: Plid })) || 0;
    const rows = await db.proc(DB, 'Usp_ATC_Fund_Request', {
      Mode: '2', RegNo, Type: 'Cr', ATC: '0', AmountInINR: '0', Remark: '', PaymentMode: '0', PaymentModeName: '', ChallanImage: '', BankName: '',
      BranchName: '', ReferenceNumber: '', ReferenceDate: '', FromDate: fromDate, ToDate: toDate, StartRowIndex: page, MaxRows,
    });
    Model = mapRows(rows, ['RowNumber', 'TFHID', 'RegNo', 'Type', 'ATC', 'AmountInInr', 'Date', 'ByUser', 'Remark', 'Status', 'Username', 'EmailId', 'FullName',
      'ByUserFullName', 'ByUsername', 'GeneratedBy', 'PaymentMode', 'PaymentModeName', 'ChallanImage', 'BankName', 'BranchName', 'ReferenceNumber',
      'ReferenceDate', 'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin']);
    const TotalRecord = parseInt(String(outv(rows, 'TotalCount')), 10);
    if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
    Object.assign(out, { fromDate, toDate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() });
  } catch (Exp) {
    console.error(Exp.message);
    await errorInsert(Exp, 'Usp_ATC_Fund_Request', req);
    return res.json({ redirect: '/page-not-found' }); // legacy Response.Redirect("/page-not-found")
  }
  return res.json({ Model, ...out });
}));

module.exports = router;
