// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Wallet.cs (WalletController => /portal/Wallet/...)
'use strict';
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const CS = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, NRE, s, outCol, outInt, optInt, bindInt, bindDecimal, cvtDecimal, view } = require('./_shared/batch-24-common');

const CompanySettings = CS.CompanySettings || CS;
const router = express.Router();
const P = '/portal/Wallet';
/** class GetWalletHistory */
const GET_WALLET_HISTORY = ['Rownumber', 'WDID', 'PLID', 'CRDRTYPE', 'WITHDRAWAMOUNT', 'ADMINCHARGE', 'TDS', 'WITHDRAWLPOINTS', 'PAYBLEAMOUNT', 'DATE',
  'REMARKS', 'STATUS', 'Trans_Id', 'ACCOUNTNO', 'Paid_status', 'PAID_MODE', 'ADMIN_REMARK', 'INT_PAID_ACID', 'TDS_SECTION_ID',
  'TDS_PERForAdsPoints', 'ADMINCHARGE_PERForAdsPoints', 'TDS_SECTION_ID_ForAdsPoints', 'BinaryAndDirectWithdrawal', 'AdsPointsWithdrawal',
  'WithDrawlPointsForAdsPoints', 'TDSForBinaryAndDirect', 'TDSForAdsPoints'];
const str = (v) => (v === undefined || v === '' ? null : v); // MVC string binding

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: referral/wallet -> Wallet/Index
router.all([`${P}/Index{/:id}`, P, '/portal/referral/wallet{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  let SearchField = str(req.p.SearchField); let SearchValue = str(req.p.SearchValue);
  let fromdate = str(req.p.fromdate); let todate = str(req.p.todate);
  let page = optInt(req.p.page); let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  const Plid = Number(req.user.plid);
  const MaxRows = ddlcustpage;
  if (page == null) page = 1;
  // @plid is VARCHAR(100) in the procedure (the C# double was converted by SQL Server)
  const rows = await db.proc(DB, 'usp_wallet_history', {
    plid: String(Plid), StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    fromDate: fromdate.trim(), ToDate: todate.trim(),
  });
  const AllFreeEpinList = mapRows(rows, GET_WALLET_HISTORY);
  const TotalRecord = outInt(rows, 'totalcount');
  const bag = {};
  bag.CurrentPage = page;
  bag.GridPageSize = MaxRows;
  bag.TotalRecord = TotalRecord;
  bag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  bag.SearchField = SearchField;
  bag.SearchValue = SearchValue;
  bag.fromDate = fromdate;
  bag.toDate = todate;
  bag.ddlcustpage = ddlcustpage;
  return view(res, '~/Views/CustomerPanel/Wallet/Index.cshtml', AllFreeEpinList, bag);
}));

// ---------------------------------------------------------------- ConvertYHOO(decimal amount, string fromCurrency, string toCurrency)
// public (legacy: no session check)
// PORT-NOTE: the Yahoo finance CSV endpoint no longer exists; the request fails like the legacy WebClient did (HTTP 500).
router.all(`${P}/ConvertYHOO{/:id}`, asyncHandler(async (req, res) => {
  const amount = bindDecimal(req.p.amount, 'amount');
  const fromCurrency = str(req.p.fromCurrency); const toCurrency = str(req.p.toCurrency);
  if (fromCurrency === null || toCurrency === null) throw NRE();
  const url = `http://finance.yahoo.com/d/quotes.csv?e=.csv&f=sl1d1t1&s=${fromCurrency.toUpperCase()}${toCurrency.toUpperCase()}=X`;
  const r = await axios.get(url, { responseType: 'text', transformResponse: (d) => d });
  const response = String(r.data);
  const values = response.split(',');
  if (values.length < 2) throw new RangeError('Index was outside the bounds of the array.');
  const rate = cvtDecimal(values[1]);
  res.json(rate * amount);
}));

// ---------------------------------------------------------------- request_wallet(decimal amount, string remark, string adspoint)
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`${P}/request_wallet{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const amount = bindDecimal(req.p.amount, 'amount');
  const remark = str(req.p.remark); const adspoint = str(req.p.adspoint);
  const Plid = Number(req.user.plid);
  let result = '';
  // PORT-NOTE: @POINTS is BIGINT; SQL Server truncated the decimal value, Math.trunc keeps that.
  const r = await db.procOne(DB, 'usp_withdrawal_request', { PLID: Plid, POINTS: Math.trunc(amount), ADSPOINT: adspoint, REMARK: remark });
  result = s(outCol(r, 'strresult'));
  if (result === 'success') {
    const Obj = await db.queryOne(DB, "SELECT coalesce(phone, '') AS phone, emailid, username FROM portal_login WHERE plid::text = @Plid LIMIT 1",
      { Plid: String(Plid) });
    const Message = 'Your withdrawal request is sent to Admin for approval.\r\n For more details visit ' + s(CompanySettings.CompanyDomain) + '.\r\n '
      + s(CompanySettings.CompanyName) + ' Support Team.';
    if (Obj == null) throw NRE(); // Obj.Phone
    if (Obj.phone != null && Obj.phone !== '') {
      await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
    }
    if (Obj.emailid != null && Obj.emailid !== '') {
      await SendMailWithdrawal(Obj.emailid, Obj.username);
    }
  }
  res.json(result);
}));

/** protected void SendMailWithdrawal(string ToEmail, string Username) - not an action */
async function SendMailWithdrawal(ToEmail, Username) { // eslint-disable-line no-unused-vars
  const subject = ''; const mailtxt = '';
  const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt); // eslint-disable-line no-unused-vars
}

// ---------------------------------------------------------------- check_kyc(string idfroof)
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`${P}/check_kyc{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const idfroof = str(req.p.idfroof);
  const rows = await db.proc(DB, '_kyc_status_refer_dashborad', { REGNO: Plid, TITLE: idfroof });
  // member_kyc = SqlQuery<Kyc>(...).FirstOrDefault() (unused); result = @INT_STATUS OUT .ToString()
  // PORT-NOTE: a row-returning PG function cannot return the OUT value without rows => "" (legacy returned the computed status).
  const result = s(outCol(rows, 'int_status'));
  res.json(result);
}));

// ---------------------------------------------------------------- WithdrawalList(Int64 wdid)
// auth  PORT-NOTE: legacy had no session check (bank details of any withdrawal by id); it reads a member's bank account data, so
// a customer token is now required. Query and response unchanged.
router.all(`${P}/WithdrawalList{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const wdid = bindInt(req.p.wdid, 'wdid', 'System.Int64');
  let result = '';
  // db._Wallet_history ([Table("DBO.WITHDRAWAL_HISTORY")]).Where(a => a.WDID == wdid).FirstOrDefault()
  const row = await db.queryOne(DB, 'SELECT accountholdername, accountno, bankname, branchname, ifsc FROM withdrawal_history WHERE wdid = @wdid LIMIT 1', { wdid });
  if (row != null) {
    const holdername = s(row.accountholdername);
    const accountno = s(row.accountno);
    const bankname = s(row.bankname);
    const branchname = s(row.branchname);
    const ifsc = s(row.ifsc);
    result = holdername + '^' + accountno + '^' + bankname + '^' + branchname + '^' + ifsc;
  }
  res.json(result);
}));

module.exports = router;
