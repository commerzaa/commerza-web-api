'use strict';
// Port of Member\Common\Controllers\CustomerPanel\IWallet.cs (IWalletController)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const Security_Key = require('../../lib/member/Security_Key');
const ATCAPI = require('../../lib/member/ATCAPI');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const intParse = (v) => {
  if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  const n = parseInt(String(v), 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
const trimmed = (v) => (v === undefined || v === null ? '' : String(v)).trim();
const orEmpty = (v) => (v === undefined || v === null ? '' : String(v));

const GetWalletHistory = ['Rownumber', 'WDID', 'PLID', 'CRDRTYPE', 'WITHDRAWAMOUNT', 'ADMINCHARGE', 'TDS', 'WITHDRAWLPOINTS', 'PAYBLEAMOUNT', 'DATE', 'REMARKS', 'STATUS', 'Trans_Id', 'ACCOUNTNO', 'Paid_status', 'PAID_MODE', 'ADMIN_REMARK', 'INT_PAID_ACID', 'TDS_SECTION_ID', 'TDS_PERForAdsPoints', 'ADMINCHARGE_PERForAdsPoints', 'TDS_SECTION_ID_ForAdsPoints', 'BinaryAndDirectWithdrawal', 'AdsPointsWithdrawal', 'WithDrawlPointsForAdsPoints', 'TDSForBinaryAndDirect', 'TDSForAdsPoints'];

// route-config: referral/i-wallet -> IWallet/Index
// auth
router.all(['/member/IWallet/Index{/:id}', '/member/referral/i-wallet'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ddlcustpage = p.ddlcustpage === undefined || p.ddlcustpage === '' ? 100 : parseInt(p.ddlcustpage, 10);
  const SearchField = orEmpty(p.SearchField);
  const SearchValue = orEmpty(p.SearchValue);
  const fromdate = orEmpty(p.fromdate);
  const todate = orEmpty(p.todate);
  const Plid = Number(req.user.plid);
  const MaxRows = ddlcustpage;
  const page = p.page === undefined || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await db.proc(DB, 'usp_wallet_history', {
    plid: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(),
  });
  const AllFreeEpinList = mapRows(rows, GetWalletHistory);
  const TotalRecord = intParse(outv(rows, 'totalcount'));
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
  };
  res.json({ Model: AllFreeEpinList, ...ViewBag });
}));

// auth
router.all('/member/IWallet/ConvertYHOO{/:id}', auth, asyncHandler(async (req, res) => {
  const amount = Number(req.p.amount);
  const url = `https://finance.yahoo.com/d/quotes.csv?e=.csv&f=sl1d1t1&s=${String(req.p.fromCurrency).toUpperCase()}${String(req.p.toCurrency).toUpperCase()}=X`;
  const r = await axios.get(url, { responseType: 'text', transformResponse: (x) => x });
  const values = String(r.data).split(',');
  const rate = Number(values[1]);
  if (Number.isNaN(rate)) throw new Error('Input string was not in a correct format.');
  res.json(rate * amount);
}));

// auth
router.all('/member/IWallet/request_wallet{/:id}', auth, asyncHandler(async (req, res) => {
  const amount = Number(req.p.amount);
  const Plid = Number(req.user.plid);
  const objs = await new Security_Key().Get_Security_Key(Plid);
  if (objs) {
    if (!(await objs.Check_GaKey(Plid, req.p.GAKEY))) {
      return res.json('Error^Please enter valid GA key !');
    }
  }
  const rows = await db.proc(DB, 'usp_withdrawal_request', { plid: Plid, points: amount, adspoint: req.p.adspoint, remark: req.p.remark });
  const result = String(outv(rows, 'strresult') === null ? '' : outv(rows, 'strresult'));
  if (result === 'success') {
    // legacy loads the member contact row (Obj) and does not use it further
    await db.queryOne(DB, "Select coalesce(Phone,'') As Phone,EmailID,UserName From Portal_Login where plid = @plid limit 1", { plid: Plid });
  }
  res.json(result);
}));

// auth
router.all('/member/IWallet/check_kyc{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, '_kyc_status_refer_dashborad', { regno: Plid, title: req.p.idfroof });
  const result = String(outv(rows, 'int_status') === null ? '' : outv(rows, 'int_status'));
  res.json(result);
}));

// auth
router.all('/member/IWallet/Generate_Atc_Wallet{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const APIResponse = await ATCAPI.ATCRegistration();
  const RegistrationResponse = APIResponse.substring(2, 2 + (APIResponse.length - 4)).split('\\').join('');
  const ObjJArray = JSON.parse(RegistrationResponse);
  const ATCAddress = String(ObjJArray[0].Address);
  const AtcUserId = String(ObjJArray[0].UserID);
  if (ATCAddress !== '' && AtcUserId !== '') {
    const rows = await db.proc(DB, 'usp_generateatcwalletaddress', { plid: Plid, atcwalletaddress: ATCAddress.trim(), userid: AtcUserId.trim() });
    const out = outv(rows, 'intresult');
    return res.json((out === null ? '' : out) + '^' + ATCAddress);
  }
  return res.json('Server Not Responding Try After Some Time.');
}));

// auth
router.all('/member/IWallet/WithdrawalList{/:id}', auth, asyncHandler(async (req, res) => {
  const wdid = parseInt(req.p.wdid, 10);
  let result = '';
  const row = await db.queryOne(DB, 'select * from withdrawal_history where wdid=@wdid limit 1', { wdid });
  if (row !== null) {
    result = orEmpty(row.accountholdername) + '^' + orEmpty(row.accountno) + '^' + orEmpty(row.bankname) + '^' + orEmpty(row.branchname) + '^' + orEmpty(row.ifsc);
  }
  res.json(result);
}));

void trimmed;
module.exports = router;
