'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Credit_Debitcard_statement.cs (Credit_Debitcard_statementController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';

const STATEMENT_PROPS = ['rownumber', 'NETAMOUNT', 'Remark', 'USERNAME', 'WALLET', 'ORDERDATE', 'AMOUNT', 'CustomerName', 'EMAILID', 'PHONE', 'DistributorName', 'TYPE'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}
const xmlEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/Credit-Debitcard-statement
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/Credit_Debitcard_statement/Index{/:id}', '/franchise/franchisee/Credit-Debitcard-statement'], auth, asyncHandler(async (req, res) => {
  const ResselerName = nn(req.p.ResselerName);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  const DID = Number(req.user.did);
  const mode = 0;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = parseInt(req.p.page, 10);
  if (Number.isNaN(page)) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_netbanking_statement', {
    startrowindex: page, maxrows: 100, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate.trim(), todate: toDate.trim(),
    resselername: ResselerName, mode, resellerid: DID,
  });
  const AllEPinRequestsList = mapRows(rows, STATEMENT_PROPS);
  const TotalRecord = totalOf(rows, 'totalcount');
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, ResselerName, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
  };
  return res.json({ view: '~/Views/Credit_Debitcard_statement/Index.cshtml', Model: AllEPinRequestsList, ViewBag });
}));

// ---- ObjectserchName -----------------------------------------------------------------------------------
// auth (panel autocomplete)
router.all('/franchise/Credit_Debitcard_statement/ObjectserchName{/:id}', auth, asyncHandler(async (req, res) => {
  let SearchText = req.p.SearchText;
  if (SearchText === undefined || SearchText === null) throw new TypeError('Object reference not set to an instance of an object.');
  SearchText = String(SearchText).split('+apostopis').join("'");
  const rows = await proc(DB, 'usp_searchdistributor', { serchitem: SearchText });
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
