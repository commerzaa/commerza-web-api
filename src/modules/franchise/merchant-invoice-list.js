'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Merchant_Invoice_List.cs (Merchant_Invoice_ListController)
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
const C = 'Merchant_Invoice_List';

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


const INVOICE_PROPS = ['ROWNUMBER', 'TMCIID', 'TMSIID', 'MerchantName', 'MerchantEmailId', 'INVOICETYPE', 'ORDERID', 'INVOICENO', 'INVOICEDATE', 'ACTIVE', 'TOTALAMOUNT'];

// public static string Generate_Merchant_Auto_Payout()  (static => not an MVC action)
async function Generate_Merchant_Auto_Payout() {
  let Result = '';
  try {
    const o = await procOne(DB, 'usp_genereate_merchant_payouts', { payoutdate: new Date() });
    Result = s(outVal(o, 'stroutput'));
    return Result;
  } catch (ExpObj) {
    return ExpObj.message;
  }
}
// public static string Generate_Merchant_Auto_Settalment()
async function Generate_Merchant_Auto_Settalment() {
  let Result = '';
  try {
    const o = await procOne(DB, 'usp_merchantsettalment_report', {});
    Result = s(outVal(o, 'strresult'));
    return Result;
  } catch (ExpObj) {
    return ExpObj.message;
  }
}

const indexHandler = asyncHandler(async (req, res) => {
  let { ORDERID, fromDate, toDate, page, INVOICENO, INVOICETYPE, SearchBusinessType } = req.p;
  await Generate_Merchant_Auto_Payout();
  await Generate_Merchant_Auto_Settalment();
  if (SearchBusinessType == null) SearchBusinessType = '0';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (INVOICETYPE == null) INVOICETYPE = '';
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (INVOICENO == null) INVOICENO = '';
  if (ORDERID == null) ORDERID = '';
  const PLID = 0;
  const DID = parseInt(req.user.did, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_get_merchantallinvoices', {
    plid: PLID, startrowindex: page, maxrows: MaxRows, invoiceno: INVOICENO, orderid: ORDERID, invoicetype: INVOICETYPE, fromdate: fromDate, todate: toDate,
    did: DID, searchbusinesstype: SearchBusinessType,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  res.json({
    Model: mapRows(rows, INVOICE_PROPS),
    ViewBag: {
      CurrentPage: page, fromDate, toDate, INVOICENO, ORDERID, INVOICETYPE, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    },
  });
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/z8tZG_slash_e_slash_RKYsf_slash_m8EkQv95zYWYRmdC1h', auth, indexHandler);

module.exports = router;
