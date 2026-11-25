'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/Settlement_Report.cs (Settlement_ReportController)
 * Prefix: /merchant   DB: Db_Shopping => shopping
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Settlement_Report';

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


const PROPS = ['ROWNUMBER', 'DUEDATE', 'INVOICENO', 'INVOICEDATE', 'ORDERID', 'TRANSACTIONID', 'GROSSAMOUNT', 'COMMISSIONS',
  'TAXDEDUCTIONS', 'NETPAYABLE', 'STATUS', 'ACTIVE', 'CREATEDATE', 'CUSTOMERINVOICE'];

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(req, res, page, Invoiceno, Orderid, fromDate, toDate) {
  const ViewBag = {};
  const Plid = req.user.plid;
  if (page == null || page === '') page = 1;
  const rows = await proc(DB, 'usp_merchant_settlement_commission', {
    startrowindex: parseInt(page, 10), maxrows: 99999, searchfield: Invoiceno, searchvalue: Orderid, fromdate: fromDate, todate: toDate, plid: Plid,
  });
  const list = mapRows(rows, PROPS);
  try {
    if (list.length > 0) {
      const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'Merchant_settalment.xls');
      ViewBag.filepath = filepath;
      let out = '';
      out += 'S.No. \t';
      out += 'Invoice No \t';
      out += 'Due Date \t';
      out += 'Order Id \t';
      out += 'Gross Amount \t';
      out += 'Commissions \t';
      out += 'Tax Deduction \t';
      out += 'Net Payable \t';
      for (const Item of list) {
        try {
          let line = '\n';
          line += tabClean(Item.ROWNUMBER.toString()) + ' \t';
          line += tabClean(Item.INVOICENO.toString()) + ' \t';
          line += tabClean(Item.DUEDATE.toString()) + ' \t';
          line += tabClean(Item.ORDERID.toString()) + ' \t';
          line += tabClean(Item.GROSSAMOUNT.toString()) + ' \t';
          line += tabClean(Item.COMMISSIONS.toString()) + ' \t';
          line += tabClean(Item.TAXDEDUCTIONS.toString()) + ' \t';
          line += tabClean(Item.NETPAYABLE.toString()) + ' \t';
          out += line;
        } catch (e) { break; }
      }
      fs.writeFileSync(filepath, out);
      // PORT-NOTE: legacy redirected to ~/AllExcelSheets/Merchant_settalment.xls; the file content is sent directly as the download
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Merchant_settalment.xls');
      res.send(out);
      return { sent: true };
    }
    ViewBag.Message = 'There is no record in excel';
  } catch (ExpObj) {
    ViewBag.filepath = ExpObj.message;
  }
  return { sent: false, ViewBag };
}

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  let { page, Invoiceno, Orderid, fromDate, toDate, btnexel } = req.p;
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (Invoiceno == null) Invoiceno = '';
  if (Orderid == null) Orderid = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const PLID = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_merchant_settlement_commission', {
    startrowindex: page, maxrows: MaxRows, searchfield: Invoiceno, searchvalue: Orderid, fromdate: fromDate, todate: toDate, plid: PLID,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, Invoiceno, Orderid, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  const Model = mapRows(rows, PROPS);
  if (btnexel === 'Export Excel') {
    const r = await exportReport(req, res, page, Invoiceno, Orderid, fromDate, toDate);
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  res.json({ Model, ViewBag });
});
// auth
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`], auth, indexHandler);
// route-config: merchant/NIBR9XC862_plus_C_plus_65HltrZMK7aFNhG6yqL
router.all('/merchant/merchant/NIBR9XC862_plus_C_plus_65HltrZMK7aFNhG6yqL', auth, indexHandler);

// auth
router.all(`/merchant/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const { page, Invoiceno, Orderid, fromDate, toDate } = req.p;
  const r = await exportReport(req, res, page, Invoiceno, Orderid, fromDate, toDate);
  if (!r.sent) res.json({ ViewBag: r.ViewBag });
}));

module.exports = router;
