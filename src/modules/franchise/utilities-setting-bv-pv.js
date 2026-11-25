'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };

// Port of Franchise\Controllers\CustomerPanel\Utilities_Setting_BV_PV.cs (4 actions)
// route-config: franchisee/Utilities-Bv-Pv -> Index
const PROPS = ['ROWNUMBER', 'TVRCSID', 'OperatorName', 'COMMISSION', 'BV', 'PV'];
// auth
router.all(['/franchise/Utilities_Setting_BV_PV/Index{/:id}', '/franchise/franchisee/Utilities-Bv-Pv'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const DID = parseInt(req.user.did, 10);
  const rows = await db.proc('shopping', 'usp_get_utilitieswise_bv_pv_setting', { STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate, DID });
  const TotalRecord = parseInt(outv(rows, 'TOTALCOUNT'), 10) || 0;
  res.json({
    Model: mapRows(rows, PROPS),
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate,
    toDate,
  });
}));

// auth
router.all('/franchise/Utilities_Setting_BV_PV/AddUtilitiesdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const { Operatorid, commision, bv, pv } = req.p;
  const DID = parseInt(req.user.did, 10);
  const r = await db.procOne('shopping', 'usp_addutilitiesbv_pv', { TVRCSID: Operatorid, COMISSION: commision, BV: bv, PV: pv, DID });
  res.json(r && r.result !== undefined && r.result !== null ? String(r.result) : '');
}));

// auth
router.all('/franchise/Utilities_Setting_BV_PV/changbvstatus{/:id}', auth, asyncHandler(async (req, res) => {
  const chkbvvalue = parseInt(req.p.chkbvvalue, 10);
  const Did = req.user.did;
  const Row = await db.exec('shopping', 'UPDATE TBL_COMPANYSETTINGS SET UTILITYBV=@v WHERE PMID=@did', { v: chkbvvalue, did: Did });
  res.json(Row);
}));

// auth
router.all('/franchise/Utilities_Setting_BV_PV/changPvstatus{/:id}', auth, asyncHandler(async (req, res) => {
  const chkpvvalue = parseInt(req.p.chkpvvalue, 10);
  const Did = req.user.did;
  const Row = await db.exec('shopping', 'UPDATE TBL_COMPANYSETTINGS SET UTILITYPV=@v WHERE PMID=@did', { v: chkpvvalue, did: Did });
  res.json(Row);
}));

module.exports = router;
