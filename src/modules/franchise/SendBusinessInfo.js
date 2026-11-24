'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/SendBusinessInfo.cs (SendBusinessInfoController)
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
const C = 'SendBusinessInfo';

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


const axios = require('axios');

// ---- Index (returns the view only) ---------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  res.json({});
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/Send-Business-Info', auth, indexHandler);

// ---- BusinessInfo --------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/BusinessInfo{/:id}`, auth, asyncHandler(async (req, res) => {
  let { Username, OrderID, TransactionID, Status, Orderdate, Conformationdate } = req.p;
  let Amount = req.p.Amount, BV = req.p.BV;
  if (Username == null) Username = '';
  if (Amount == null || Amount === '') Amount = 0; else Amount = Number(Amount);
  if (BV == null || BV === '') BV = 0; else BV = Number(BV);
  if (OrderID == null) OrderID = '';
  if (Orderdate == null) Orderdate = '';
  if (Conformationdate == null) Conformationdate = '';
  if (TransactionID == null) TransactionID = '';
  const DID = Number(req.user.pmid);
  let url = '';
  const userinfo = { TransactionID: null, USERNAME: null, Remarks: null, Remark: null, Balance: 0, Message: null };
  if (DID !== 0) {
    url = await scalar(DB, 'select apiurl from tbl_companysettings where pmid=@did LIMIT 1', { did: DID });
  }
  if (url === '' || url === null || url === undefined) {
    userinfo.Remarks = "APIURL doesn't found.";
    return res.json(userinfo);
  }
  const OBjSendReceive = {
    Username, Amount, OrderID, BV, TransactionID, OrderStatus: Status === undefined ? null : Status, OrderDate: Orderdate, ConformationDate: Conformationdate,
  };
  const r = await axios.post(url + '/api/UserBussinessDetails', JSON.stringify(OBjSendReceive), {
    headers: { 'Content-Type': 'application/json' }, transformResponse: (x) => x, timeout: 100000,
  });
  const ObjProductDetails = JSON.parse(String(r.data));
  const Flag = ObjProductDetails.Flag; // legacy reads and ignores
  if (ObjProductDetails.Message === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  userinfo.Remarks = ObjProductDetails.Message === null ? '' : String(ObjProductDetails.Message);
  res.json(userinfo);
}));

module.exports = router;
