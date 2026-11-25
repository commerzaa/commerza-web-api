'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Order_Transaction.cs. DB: 'shopping' */
const express = require('express');
const { proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const f = Object.keys(row)[0];
  return f === undefined ? null : row[f];
}
const PROPS = ['ROWNUMBER', 'TMORID', 'MerchantName', 'MerchantEmailId', 'INVOICENO', 'INVOICEDATE', 'ORDERID', 'DISPATCHDATE', 'DELIVERYDATE', 'DUEDATE', 'INVOICEAMOUNT', 'STATUS'];

async function Generate_Merchant_Auto_Payout() {
  try {
    const row = await procOne(DB, 'usp_genereate_merchant_payouts', { payoutdate: new Date() });
    return s(outVal(row, 'stroutput'));
  } catch (ExpObj) { return ExpObj.message; }
}
async function Generate_Merchant_Auto_Settalment() {
  try {
    const row = await procOne(DB, 'usp_merchantsettalment_report', {});
    return s(outVal(row, 'strresult'));
  } catch (ExpObj) { return ExpObj.message; }
}

async function ExportReport(res, fromDate, toDate, page, btnexel, Orderid, Invoiceno) {
  const Plid = 0;
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

// route-config: franchisee/brFU_plus_BhR02IRwyLuOp8fsBBOvx0WDpUF
// auth
router.all(['/franchise/Order_Transaction/Index{/:id}', '/franchise/franchisee/brFU_plus_BhR02IRwyLuOp8fsBBOvx0WDpUF'], auth, asyncHandler(async (req, res) => {
  await Generate_Merchant_Auto_Payout();
  await Generate_Merchant_Auto_Settalment();
  const p = req.p;
  let SearchBusinessType = p.SearchBusinessType == null ? '0' : s(p.SearchBusinessType);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  const Orderid = p.Orderid == null ? '' : s(p.Orderid);
  const Invoiceno = p.Invoiceno == null ? '' : s(p.Invoiceno);
  const Status = p.Status == null ? '' : s(p.Status);
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const btnexel = p.btnexel;
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  const ViewBag = { BranchId };
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_merchant_ordertransactions', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate.trim(), todate: toDate.trim(), mode: 1, orderid: Orderid, invoiceno: Invoiceno,
    plid: BranchId, status: Status, did: DID, searchbusinesstype: SearchBusinessType,
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

module.exports = router;
