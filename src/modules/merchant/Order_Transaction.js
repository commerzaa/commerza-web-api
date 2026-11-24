'use strict';
const DB = 'shopping';
/** Port of Merchant Panel Controllers/CustomerPanel/Order_Transaction.cs. DB: 'shopping' (Db_Shopping) */
const express = require('express');
const { proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const s = (v) => (v === null || v === undefined ? '' : String(v));
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const f = Object.keys(row)[0];
  return f === undefined ? null : row[f];
}
const PROPS = ['ROWNUMBER', 'TMORID', 'INVOICENO', 'INVOICEDATE', 'ORDERID', 'DISPATCHDATE', 'DELIVERYDATE', 'DUEDATE', 'INVOICEAMOUNT', 'STATUS'];

async function ExportReport(res, fromDate, toDate, page, btnexel, Orderid, Invoiceno) {
  const Plid = Number(res.req.user.plid);
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_merchant_ordertransactions', {
    startrowindex: page, maxrows: 999999, fromdate: fromDate.trim(), todate: toDate.trim(), mode: 1, orderid: Orderid, invoiceno: Invoiceno, plid: Plid,
  });
  const list = mapRows(rows, PROPS);
  try {
    if (list.length > 0) {
      const t = (v) => {
        if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
        return String(v).replace(/\t/g, '    ') + ' \t';
      };
      let out = 'S.No  \tInvoice No \tInvoice Date \tOrder Id \tDispatch Date \tDelivery Date \tDue Date \tInvoice Amount \tStatus \t';
      for (const Item of list) {
        try {
          out += '\n' + t(Item.ROWNUMBER) + t(Item.INVOICENO) + t(Item.INVOICEDATE) + t(Item.ORDERID) + t(Item.DISPATCHDATE) + t(Item.DELIVERYDATE) +
            t(Item.DUEDATE) + t(Item.INVOICEAMOUNT) + t(Item.STATUS);
        } catch (e) { break; }
      }
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=ORDERTRANSACTIONS.xls');
      res.send(out);
      return true;
    }
  } catch (e) { /* ViewBag.filepath = ExpObj.Message */ }
  return false;
}

// route-config: merchant/brFU_plus_BhR02IRwyLuOp8fsBBOvx0WDpUF
// auth
router.all(['/merchant/Order_Transaction/Index{/:id}', '/merchant/merchant/brFU_plus_BhR02IRwyLuOp8fsBBOvx0WDpUF'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  const Orderid = p.Orderid == null ? '' : s(p.Orderid);
  const Invoiceno = p.Invoiceno == null ? '' : s(p.Invoiceno);
  const Status = p.Status == null ? '' : s(p.Status);
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const btnexel = p.btnexel;
  const BranchId = Number(req.user.plid);
  const ViewBag = { BranchId };
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_merchant_ordertransactions', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate.trim(), todate: toDate.trim(), mode: 1, orderid: Orderid, invoiceno: Invoiceno,
    plid: BranchId, status: Status,
  });
  const objORDERTRANSACTIONS = mapRows(rows, PROPS);
  const f = rows && rows[0];
  const tcKey = f && Object.keys(f).find((x) => x.toLowerCase() === 'totalcount');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.BranchId = BranchId;
  ViewBag.TotalRecord = tcKey ? (parseInt(f[tcKey], 10) || 0) : 0;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const done = await ExportReport(res, fromDate, toDate, page, btnexel, Orderid, Invoiceno);
    if (done) return undefined;
    ViewBag.Message = 'There is no record in excel';
  }
  return res.json({ Model: objORDERTRANSACTIONS, ViewBag });
}));

// auth (public void ExportReport action: download or nothing)
router.all('/merchant/Order_Transaction/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  // legacy: .Trim() on null fromDate/toDate throws NullReferenceException
  if (p.fromDate == null || p.toDate == null) throw new TypeError('Object reference not set to an instance of an object.');
  const page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const done = await ExportReport(res, s(p.fromDate), s(p.toDate), page, p.btnexel, s(p.Orderid), s(p.Invoiceno));
  if (!done) res.status(200).end();
}));

module.exports = router;
