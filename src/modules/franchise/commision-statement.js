'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/CommisionStatement.cs (CommisionStatementController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'CommisionStatement';

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() equivalent for one table */
function getXml(ds) {
  let x = '<NewDataSet>';
  for (const name of Object.keys(ds)) {
    for (const r of ds[name]) {
      x += `<${name}>`;
      for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== undefined) x += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
      x += `</${name}>`;
    }
  }
  return x + '</NewDataSet>';
}


const PROPS = ['ROW', 'TRANSDATE', 'CR', 'DR', 'BALNACE', 'TRANSFER'];

const indexHandler = asyncHandler(async (req, res) => {
  let { TransID, fromDate, toDate, page } = req.p;
  if (TransID == null) TransID = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const did = Math.trunc(Number(req.user.did));
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_reseller_commission_wallet_statement', { startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, did });
  // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when no rows)
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField: '', SearchValue: '', fromDate, toDate, QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
    },
  });
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/Commision-Statement', auth, indexHandler);

module.exports = router;
