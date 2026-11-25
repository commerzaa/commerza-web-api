'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Paymode.cs (PaymodeController)
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
const C = 'Paymode';

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


const PAYMODE_PROPS = ['PMID', 'Pm_Code', 'DID', 'Percentage', 'Active', 'MDPID'];
const LIST_PROPS = ['ROWNUMBER', 'DID', 'NAME', 'Total_Member', 'Email_Id', 'Contact', 'Address', 'DB_NAME', 'URL', 'REGISTRATIONDATE', 'MDPID', 'PMID', 'MDistributorID', 'Percentage'];

const indexHandler = asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromdate, todate, page, ddlcustpage } = req.p;
  const Regno = Number(req.user.did);
  if (ddlcustpage == null || ddlcustpage === '') ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  const MaxRows = 100;
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_managedistributorlist', {
    startrowindex: page, maxrows: MaxRows, fromdate, todate, searchfiel: SearchField.trim(), searchvalue: SearchValue.trim(), plid: Regno,
  });
  // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  const sqlPay = 'select pm.pmid,pm_code,mdp.did,mdp.percentage,mdp.active,mdp.mdpid from pay_mode pm inner join tbl_map_distributor_paymode mdp on mdp.pmid=pm.pmid where mdp.did=@regno and mdp.active=1 order by pm.pmid asc';
  const PayList = mapRows(await query(DB, sqlPay, { regno: String(Regno) }), PAYMODE_PROPS);
  const PayList1 = mapRows(await query(DB, sqlPay, { regno: String(Regno) }), PAYMODE_PROPS);
  res.json({
    Model: mapRows(rows, LIST_PROPS),
    ViewBag: {
      QUALIFICATIONlis: '', CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField: '', SearchValue: '', PayList, PayList1,
    },
  });
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/Paymode', auth, indexHandler);

module.exports = router;
