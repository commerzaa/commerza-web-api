'use strict';
/** Port of Franchise/Controllers/CustomerPanel/WalletSetting.cs. DB: 'shopping' */
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
const PROPS = ['ROW_NUMBER', 'MAXUSEPER', 'RWTID', 'DATE', 'WALLETNAME', 'ISRETURN'];
function outVal(row, name) { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name); return k !== undefined ? row[k] : row[Object.keys(row)[0]]; }

// route-config: franchisee/Wallet-Setting
// auth
router.all(['/franchise/WalletSetting/Index{/:id}', '/franchise/franchisee/Wallet-Setting'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const WALLETNAME = p.WALLETNAME == null ? '' : s(p.WALLETNAME);
  const fromDate = p.fromDate == null ? '' : s(p.fromDate);
  const toDate = p.toDate == null ? '' : s(p.toDate);
  let page = pint(p.page);
  const Pmid = Number(req.user.pmid);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_getdetails_reseller_wallettype', {
    startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, walletname: WALLETNAME, pmid: Math.trunc(Pmid),
  });
  const WalletSetting = mapRows(rows, PROPS);
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE: '', GridPageSize: MaxRows, TotalRecord: totalOf(rows), NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField: '', SearchValue: '', fromDate, toDate, QUALIFICATION: '', userid: '', ORDERBY: '', Isdownload: '',
  };
  res.json({ Model: WalletSetting, ViewBag });
}));

// auth
router.all('/franchise/WalletSetting/SaveWallet{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const walletName = p.walletName;
  const maxused = Number(p.maxused);
  let Ret = '0';
  const Pmid = Number(req.user.pmid);
  if (walletName === '' || walletName == null) {
    Ret = 'PLEASE FILL THE WALLETNAME.';
    return res.json(Ret);
  }
  if (maxused > 100) {
    Ret = 'MAX.USED PERCENTAGE CAN NOT BE GRATHER THEN  100.';
    return res.json(Ret);
  }
  const row = await procOne(DB, 'usp_create_new_reseller_wallettype', {
    rwtid: parseInt(p.RWTID, 10), walletname: walletName, maxused, isreturn: parseInt(p.isreturn, 10), pmid: Math.trunc(Pmid),
  });
  Ret = s(outVal(row, 'strresult'));
  return res.json(Ret);
}));

// auth
router.all('/franchise/WalletSetting/GetDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_get_reseller_wallettype', { rwtid: parseInt(req.p.RWTID, 10) });
  res.json(mapRows(rows, PROPS));
}));

module.exports = router;
