'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/PaidListing.cs. DB: 'shopping' */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

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
const g = (o, name) => { const k = Object.keys(o || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : o[k]; };

// auth
// route-config: merchant/paidlisting -> Index
router.all(['/merchant/PaidListing/Index{/:id}', '/merchant/paidlisting'], auth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/PaidListing/Index.cshtml' });
}));

// auth
router.all('/merchant/PaidListing/BindAllCity{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, `SELECT c.ctid, s.statename, c.cityname, s.sid FROM city c, state s WHERE c.sid=s.sid AND c.active=true AND c.cid IN
    (SELECT cid FROM portal_login WHERE plid=@plid) ORDER BY s.statename ASC`, { plid: req.user.plid });
  res.json(mapRows(rows, ['CTID', 'STATENAME', 'CITYNAME', 'SID']));
}));

// auth
router.all('/merchant/PaidListing/BindAllArea{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getarealistonmultiplecity', { ctid: req.p.CTID });
  res.json(mapRows(rows, ['AID', 'AREANAME', 'CITYNAME']));
}));

// auth
router.all('/merchant/PaidListing/BindAllKeyword{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_bindcatandkey', {});
  res.json(mapRows(rows, ['PRODUCTNAME', 'PRODUCTTYPE', 'PRID', 'CATID', 'KMID']));
}));

async function GetCountryIDFromPlid(Plid) {
  const v = await scalar(DB, 'SELECT cid FROM portal_login WHERE plid=@plid LIMIT 1', { plid: Plid });
  return Math.trunc(Number(v === null || v === undefined ? 0 : v));
}

// auth
router.all('/merchant/PaidListing/Get_AreaWistTotalHits{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const CID = await GetCountryIDFromPlid(Plid);
  const rows = mapRows(await proc(DB, 'usp_totalhits_ofarea_countrywise', { cid: CID }), ['CID', 'AID', 'CATID', 'KMID', 'TYPE', 'TOTALHITS']);
  let lst = "<rss version='2.0'><AreaWistTotalHits>";
  for (const r of rows) {
    lst += '<Row>';
    lst += '<CID>' + s(r.CID) + '</CID>';
    lst += '<AID>' + s(r.AID) + '</AID>';
    lst += '<CATID>' + s(r.CATID) + '</CATID>';
    lst += '<KMID>' + s(r.KMID) + '</KMID>';
    lst += '<TYPE>' + s(r.TYPE) + '</TYPE>';
    lst += '<TOTALHITS>' + s(r.TOTALHITS) + '</TOTALHITS>';
    lst += '</Row>';
  }
  lst += '</AreaWistTotalHits></rss>';
  res.json(lst);
}));

// auth
router.all('/merchant/PaidListing/Get_Keyword_Multiplier_Min_price_CountryWise{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const CID = await GetCountryIDFromPlid(Plid);
  const rows = mapRows(await proc(DB, 'usp_keyword_multiplier_min_price_countrywise', { cid: CID }), ['CATID', 'KMID', 'KEYWORD', 'TYPE', 'MULTIPLIERAMOUNT', 'MINAMOUNT']);
  let lst = "<rss version='2.0'><KeywordMultiplierMinpriceCountryWise>";
  for (const r of rows) {
    lst += '<Row>';
    lst += '<CATID>' + s(r.CATID) + '</CATID>';
    lst += '<KMID>' + s(r.KMID) + '</KMID>';
    lst += '<KEYWORD>' + r.KEYWORD.replace(/&/g, 'And') + '</KEYWORD>';
    lst += '<TYPE>' + s(r.TYPE) + '</TYPE>';
    lst += '<MULTIPLIERAMOUNT>' + s(r.MULTIPLIERAMOUNT) + '</MULTIPLIERAMOUNT>';
    lst += '<MINAMOUNT>' + s(r.MINAMOUNT) + '</MINAMOUNT>';
    lst += '</Row>';
  }
  lst += '</KeywordMultiplierMinpriceCountryWise></rss>';
  res.json(lst);
}));

// auth
router.all('/merchant/PaidListing/GetCountryIDFromPlid{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await GetCountryIDFromPlid(Number(req.p.Plid)));
}));

// auth
router.all('/merchant/PaidListing/Insert_Subscritption{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ResultOutPut = '';
  const Pmid = Number(req.user.pmid);
  if (Pmid <= 0) ResultOutPut = 'expired';
  let Ewalateamt = s(p.Ewalateamt), Ewalatetype = s(p.Ewalatetype);
  if (Ewalateamt.trim() === '') Ewalateamt = '0.00';
  if (Ewalatetype.trim() === '') Ewalatetype = '0';
  const row = await procOne(DB, 'usp_subscriptionnow', {
    pmid: Pmid, catid: p.TotalCatid, ctid: p.CityId, aid: p.AreaId, keyid: p.KeyId, totalprice: p.TotalCost, noofmonth: p.NoOfMonth, paymode: p.PayMode,
    paidamount: p.PaidAmount, remarks: p.Remark, depositdate: p.DepositDate, checkdate: p.CheckDate, checknumber: p.CheckNumber, bankname: p.BankName,
    branchname: p.BranchName, accountnumber: p.AccountNumber, checkamount: p.CheckAmount, memberid: p.MemberId, password: p.Password, couponno: p.Couponno,
    w_accountname: p.W_AccountName, w_accountno: p.W_AccountNo, w_bankname: p.W_BankName, w_transid: p.W_TransId, w_transdate: p.W_TransDate,
    w_remark: p.W_Remark, w_receipt: p.W_Receipt, filename: p.FileName, sdidforupdate: p.SDID, mode: p.Mode, ewalateamt: Ewalateamt, ewalatetype: Ewalatetype,
    loginid_subs: '', password_subs: '',
  });
  ResultOutPut = s(outVal(row, 'strresult'));
  res.json(ResultOutPut);
}));

module.exports = router;
