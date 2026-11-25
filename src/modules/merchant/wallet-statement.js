'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/Wallet_Statement.cs (Wallet_StatementController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
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
const C = 'Wallet_Statement';

const PROPS = ['ROWNUMBER', 'TMWSID', 'PARTICULAR', 'CRDRTYPE', 'AMOUNT', 'BALANCE', 'ACTIVE', 'CREATEDATE'];
const tabClean = (v) => String(v === null || v === undefined ? '' : v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(req, res, page, Invoiceno, Orderid, fromDate, toDate) {
  const ViewBag = {};
  const Plid = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  const rows = await proc(DB, 'usp_merchant_wallet_statements', {
    startrowindex: parseInt(page, 10), maxrows: MaxRows, searchfield: Invoiceno, searchvalue: Orderid, fromdate: fromDate, todate: toDate, plid: Plid,
  });
  const list = mapRows(rows, PROPS);
  try {
    if (list.length > 0) {
      const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'Merchant_Wallet_settalment.xls');
      ViewBag.filepath = filepath;
      let out = '';
      out += 'S.No. \t';
      out += 'Transaction Date \t';
      out += 'Particular \t';
      out += 'Debit \t';
      out += 'Credit \t';
      out += 'Balance \t';
      for (const item of list) {
        try {
          let line = '\n';
          line += tabClean(item.ROWNUMBER.toString()) + ' \t';
          line += tabClean(item.CREATEDATE.toString()) + ' \t';
          line += tabClean(item.PARTICULAR.toString()) + ' \t';
          if (item.CRDRTYPE === 'DR') line += tabClean(item.AMOUNT.toString()) + ' \t';
          else line += tabClean('0') + ' \t';
          if (item.CRDRTYPE === 'CR') line += tabClean(item.AMOUNT.toString()) + ' \t';
          else line += tabClean('0') + ' \t';
          line += tabClean(item.BALANCE.toString()) + ' \t';
          out += line;
        } catch (e) { break; }
      }
      fs.writeFileSync(filepath, out);
      // PORT-NOTE: legacy redirected to ~/AllExcelSheets/Merchant_Wallet_settalment.xls; the file content is sent directly as the download
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Merchant_Wallet_settalment.xls');
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
  if (Number.isNaN(page)) throw new Error('The parameters dictionary contains an invalid entry for parameter \'page\'.');
  if (Invoiceno == null) Invoiceno = '';
  if (Orderid == null) Orderid = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const PLID = Math.trunc(Number(req.user.plid));
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_merchant_wallet_statements', {
    startrowindex: page, maxrows: MaxRows, searchfield: Invoiceno, searchvalue: Orderid, fromdate: fromDate, todate: toDate, plid: PLID,
  });
  // PORT-NOTE: @TotalCount / @TotalBalnace OUT values are read from the "totalcount" / "totalbalnace" columns of the first result row
  const TotalRecord = totalOf(rows);
  const tb = rows.length ? pick(rows[0], 'totalbalnace') : undefined;
  const Totalbalnace = tb === undefined || tb === null ? '' : String(tb);
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, Invoiceno, Orderid, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), Totalbalnace,
  };
  const Model = mapRows(rows, PROPS);
  if (btnexel === 'Export Excel') {
    const r = await exportReport(req, res, page, Invoiceno, Orderid, fromDate, toDate);
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  res.json({ view: '~/Views/Wallet_Statement/Index.cshtml', Model, ViewBag });
});

// auth ([SessionExpireCheck])
// route-config: merchant/jmeuLNssuUvwL_plus_dMRgACbJzYWYRmdC1h
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/jmeuLNssuUvwL_plus_dMRgACbJzYWYRmdC1h'], auth, indexHandler);

// auth
router.all(`/merchant/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const { page, Invoiceno, Orderid, fromDate, toDate } = req.p;
  const r = await exportReport(req, res, page, Invoiceno == null ? '' : Invoiceno, Orderid == null ? '' : Orderid, fromDate == null ? '' : fromDate, toDate == null ? '' : toDate);
  if (!r.sent) res.json({ ViewBag: r.ViewBag });
}));

module.exports = router;
