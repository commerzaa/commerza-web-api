'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Payout_Summary.cs (Payout_SummaryController) - 2 actions: Index, ExportReport
 * DB: Db_Shopping => 'shopping'
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Payout_Summary';
const PROPS = ['ROWNUMBER', 'COMPANYNAME', 'EMAILID', 'ACCOUNTHOLDERNAME', 'PAYDATE', 'PAYOUTAMOUNT', 'ACCOUNTNO', 'TRANS_ID', 'DATE', 'STATUS', 'BANKNAME', 'IFSCCODE', 'BRANCHNAME'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const sp = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).replace(/\t/g, '    ') + ' \t'; };

/** ExportReport body. Returns true when the xls was sent. */
async function exportReport(req, res, a) {
  const Plid = Number(req.user.plid);
  const page = a.page == null ? 1 : a.page;
  const rows = await proc(DB, 'usp_merchant_payoutreport', {
    startrowindex: page, maxrows: 999999, searchfield: a.SearchField, searchvalue: a.SearchValue, fromdate: a.fromDate, todate: a.toDate, plid: Plid,
  });
  const list = mapRows(rows, PROPS);
  try {
    if (list.length > 0) {
      let out = '';
      ['S.No. ', 'A/C Holder Name ', 'Bank Name ', 'Branch Name ', 'Account No ', 'IFSC Code ', 'Pay Date ', 'Amount ', 'Transaction Id ',
        'Transaction Date ', 'Status '].forEach((h) => { out += h + '\t'; });
      for (const item of list) {
        try {
          out += '\n';
          out += sp(item.ROWNUMBER) + sp(item.ACCOUNTHOLDERNAME) + sp(item.BANKNAME) + sp(item.BRANCHNAME) + sp(item.ACCOUNTNO) + sp(item.IFSCCODE)
            + sp(item.PAYDATE) + sp(item.PAYOUTAMOUNT) + sp(item.TRANS_ID) + sp(item.DATE) + sp(item.STATUS);
        } catch (ExpObj) {
          break; // legacy: wr.Close() inside catch
        }
      }
      const dir = path.join(config.uploadDir || path.join(process.cwd(), 'uploads'), 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Payoutsummary.xls'), out);
      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Disposition', 'attachment; filename=Payoutsummary.xls');
      res.send(out);
      return true;
    }
    return false; // ViewBag.Message = "There is no record in excel"
  } catch (ExpObj) {
    return false; // ViewBag.filepath = ExpObj.Message
  }
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/Etk9W_plus_mFOp_slash_vJJrG69BwLw==
// auth (legacy had no [SessionExpireCheck] but reads Session["Plid"])
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/Etk9W_plus_mFOp_slash_vJJrG69BwLw==', '/merchant/merchant/Etk9W_plus_mFOp_slash_vJJrG69BwLw=='], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate, MerchantName, btnexel, Status } = req.p;
  let page = req.p.page;
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (MerchantName == null) MerchantName = '';
  if (Status == null) Status = '';
  const PLID = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_merchant_payoutreport', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate, plid: PLID, status: Status,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  if (btnexel === 'Export Excel') {
    const sent = await exportReport(req, res, { page, SearchField, SearchValue, fromDate, toDate, MerchantName });
    if (sent) return;
  }
  res.json({
    view: '~/Views/Payout_Summary/Index.cshtml',
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, SearchField, SearchValue, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    },
  });
}));

// ---- ExportReport (public void action) -----------------------------------------------------------------
// auth
router.all(`/merchant/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const sent = await exportReport(req, res, {
    page: p.page ? parseInt(p.page, 10) : null, SearchField: p.SearchField, SearchValue: p.SearchValue, fromDate: p.fromDate, toDate: p.toDate, MerchantName: p.MerchantName,
  });
  if (!sent) res.json({ Message: 'There is no record in excel' });
}));

module.exports = router;
