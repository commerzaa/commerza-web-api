'use strict';
/** Port of Franchise/Controllers/CustomerPanel/DaillyCommisionReport.cs. DB: 'shopping' */
const express = require('express');
const { query, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pint = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, name = 'totalcount') => { const f = rows && rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === name); return k === undefined ? 0 : (parseInt(f[k], 10) || 0); };
const PROPS = ['ROWNUMBER', 'DID', 'DATE', 'SHOPPINGCOMISSION', 'UTILITYCOMMISSION', 'TOTALAMOUNT'];

// route-config: franchisee/DaillyCommision-Report is commented out in RouteConfig.cs (only the conventional route exists)
// auth
router.all('/franchise/DaillyCommisionReport/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const InvoiceNo = p.InvoiceNo == null ? '' : s(p.InvoiceNo);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  const ddlType = p.ddlType == null ? '' : s(p.ddlType);
  let page = pint(p.page);
  const did = Math.trunc(Number(req.user.did));
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_daily_reseller_commission', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, did, servicetype: ddlType,
  });
  const CommisionReport = mapRows(rows, PROPS);
  const TotalRecord = totalOf(rows);
  const Pmid = Number(req.user.pmid);
  const v = await scalar(DB, 'select coalesce(cast(bvrate as decimal(18,2)),0) as bvrate from tbl_companysettings where pmid=@pmid LIMIT 1', { pmid: Pmid });
  const BVRate = v === null || v === undefined ? 0 : v;
  const ViewBag = {
    BVRate, QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField: '', SearchValue: '', fromDate, toDate, QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
  };
  res.json({ Model: CommisionReport, ViewBag });
}));

module.exports = router;
