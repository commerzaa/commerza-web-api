'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel$1.cs (PayUMoney_StatementController)
 * Actions: Index, ObjectserchName (2)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const STATEMENT_PROPS = ['rownumber', 'NETAMOUNT', 'Remark', 'USERNAME', 'WALLET', 'ORDERDATE', 'AMOUNT', 'CustomerName', 'EMAILID', 'PHONE', 'DistributorName', 'TYPE'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const xmlEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// route-config: franchisee/PayUMoney-Statement
// auth
router.all(['/franchise/PayUMoney_Statement/Index{/:id}', '/franchise/franchisee/PayUMoney-Statement'], auth, asyncHandler(async (req, res) => {
  const ResselerName = nn(req.p.ResselerName);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  const DID = Number(req.user.did);
  const mode = 3;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = parseInt(req.p.page, 10);
  if (Number.isNaN(page)) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await db.proc(DB, 'usp_netbanking_statement', {
    StartRowIndex: page, MaxRows: 100, SearchField, SearchValue, fromDate: fromDate.trim(), ToDate: toDate.trim(), ResselerName, mode, ResellerId: DID,
  });
  const f = rows && rows[0];
  const TotalRecord = parseInt(f ? f.totalcount : 0, 10) || 0;
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, ResselerName, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate, toDate,
  };
  res.json({ Model: mapRows(rows, STATEMENT_PROPS), ViewBag });
}));

// auth
router.all('/franchise/PayUMoney_Statement/ObjectserchName{/:id}', auth, asyncHandler(async (req, res) => {
  let SearchText = req.p.SearchText;
  if (SearchText === undefined || SearchText === null) throw new TypeError('Object reference not set to an instance of an object.');
  SearchText = String(SearchText).split('+apostopis').join("'");
  const rows = await db.proc(DB, 'usp_searchdistributor', { serchItem: SearchText });
  // DataSet.GetXml(): <NewDataSet><dsData><col>v</col>...</dsData>...</NewDataSet> (NULL columns omitted)
  let xml = '<NewDataSet>';
  for (const r of rows) {
    xml += '\r\n  <dsData>';
    for (const k of Object.keys(r)) {
      if (r[k] === null || r[k] === undefined) continue;
      const v = r[k] instanceof Date ? r[k].toISOString() : r[k];
      xml += `\r\n    <${k}>${xmlEsc(v)}</${k}>`;
    }
    xml += '\r\n  </dsData>';
  }
  xml += '\r\n</NewDataSet>';
  return res.json(xml);
}));

module.exports = router;
