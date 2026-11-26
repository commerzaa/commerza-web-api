'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/PaidListing.cs
// (class PaidListingController => /portal/PaidListing/...). Database: shopping (Db_Shopping).
// Fork of the Merchant Panel PaidListing.cs (only the view path differs); compared line by line.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view, outVal, firstCol, s, str, content, toInt32 } = require('./_shared/batch-06-common');

const router = express.Router();
const C = 'PaidListing';
const nz = (v) => (v === undefined ? null : v);

/** GetCountryIDFromPlid(double Plid) : int (public method => also an MVC action, see below) */
async function GetCountryIDFromPlid(Plid) {
  const row = await db.queryOne(DB, 'SELECT cid FROM portal_login WHERE plid = @Plid LIMIT 1', { Plid });
  const v = firstCol(row);
  return toInt32(v === null || v === undefined ? 0 : v);
}

// ---------------------------------------------------------------- Index()
// public (no session check). route-config: "merchant/paidlisting" -> PaidListing/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/merchant/paidlisting{/:id}'], asyncHandler(async (req, res) => {
  view(res, '~/Views/CustomerPanel/PaidListing/Index.cshtml');
}));

// ---------------------------------------------------------------- BindAllCity() : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`/portal/${C}/BindAllCity{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `SELECT c.ctid, s.statename, c.cityname, s.sid FROM city c, state s WHERE c.sid = s.sid AND c.active = true AND c.cid IN
    (SELECT cid FROM portal_login WHERE plid = @plid) ORDER BY s.statename ASC`, { plid: req.user.plid });
  res.json(mapRows(rows, ['CTID', 'STATENAME', 'CITYNAME', 'SID']));
}));

// ---------------------------------------------------------------- BindAllArea(string CTID) : JsonResult
// public (no session check)
router.all(`/portal/${C}/BindAllArea{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getarealistonmultiplecity', { CTID: nz(req.p.CTID) });
  res.json(mapRows(rows, ['AID', 'AREANAME', 'CITYNAME']));
}));

// ---------------------------------------------------------------- BindAllKeyword() : JsonResult
// public (no session check)
router.all(`/portal/${C}/BindAllKeyword{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_bindcatandkey', {});
  res.json(mapRows(rows, ['PRODUCTNAME', 'PRODUCTTYPE', 'PRID', 'CATID', 'KMID']));
}));

// ---------------------------------------------------------------- Get_AreaWistTotalHits() : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`/portal/${C}/Get_AreaWistTotalHits{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const CID = await GetCountryIDFromPlid(Plid);
  const rows = mapRows(await db.proc(DB, 'usp_totalhits_ofarea_countrywise', { CID }), ['CID', 'AID', 'CATID', 'KMID', 'TYPE', 'TOTALHITS']);
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

// ---------------------------------------------------------------- Get_Keyword_Multiplier_Min_price_CountryWise() : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`/portal/${C}/Get_Keyword_Multiplier_Min_price_CountryWise{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const CID = await GetCountryIDFromPlid(Plid);
  const rows = mapRows(await db.proc(DB, 'usp_keyword_multiplier_min_price_countrywise', { CID }),
    ['CATID', 'KMID', 'KEYWORD', 'TYPE', 'MULTIPLIERAMOUNT', 'MINAMOUNT']);
  let lst = "<rss version='2.0'><KeywordMultiplierMinpriceCountryWise>";
  for (const r of rows) {
    lst += '<Row>';
    lst += '<CATID>' + s(r.CATID) + '</CATID>';
    lst += '<KMID>' + s(r.KMID) + '</KMID>';
    lst += '<KEYWORD>' + str(r.KEYWORD).split('&').join('And') + '</KEYWORD>';
    lst += '<TYPE>' + s(r.TYPE) + '</TYPE>';
    lst += '<MULTIPLIERAMOUNT>' + s(r.MULTIPLIERAMOUNT) + '</MULTIPLIERAMOUNT>';
    lst += '<MINAMOUNT>' + s(r.MINAMOUNT) + '</MINAMOUNT>';
    lst += '</Row>';
  }
  lst += '</KeywordMultiplierMinpriceCountryWise></rss>';
  res.json(lst);
}));

// ---------------------------------------------------------------- GetCountryIDFromPlid(double Plid) : int
// public (no session check). Non-ActionResult public method => MVC ContentResult with the number as text.
// A missing/invalid Plid made MVC throw (non-nullable parameter) => error.
router.all(`/portal/${C}/GetCountryIDFromPlid{/:id}`, asyncHandler(async (req, res) => {
  const v = req.p.Plid;
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) {
    throw new Error("The parameters dictionary contains a null entry for parameter 'Plid' of non-nullable type 'System.Double'.");
  }
  content(res, String(await GetCountryIDFromPlid(Number(v))));
}));

// ---------------------------------------------------------------- Insert_Subscritption(...32 strings) : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`/portal/${C}/Insert_Subscritption{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ResultOutPut = '';
  const Pmid = Number(req.user.pmid || 0);
  if (Pmid <= 0) ResultOutPut = 'expired';
  let Ewalateamt = nz(p.Ewalateamt);
  let Ewalatetype = nz(p.Ewalatetype);
  if (str(Ewalateamt).trim() === '') Ewalateamt = '0.00';
  if (str(Ewalatetype).trim() === '') Ewalatetype = '0';
  // GetFileByteCode is bound but never used by the legacy action
  const row = await db.procOne(DB, 'usp_subscriptionnow', {
    PMID: Pmid, CATID: nz(p.TotalCatid), CTID: nz(p.CityId), AID: nz(p.AreaId), KEYID: nz(p.KeyId), TOTALPRICE: nz(p.TotalCost),
    NOOFMONTH: nz(p.NoOfMonth), PAYMODE: nz(p.PayMode), PAIDAMOUNT: nz(p.PaidAmount), REMARKS: nz(p.Remark), DEPOSITDATE: nz(p.DepositDate),
    CHECKDATE: nz(p.CheckDate), CHECKNUMBER: nz(p.CheckNumber), BANKNAME: nz(p.BankName), BRANCHNAME: nz(p.BranchName),
    ACCOUNTNUMBER: nz(p.AccountNumber), CHECKAMOUNT: nz(p.CheckAmount), MEMBERID: nz(p.MemberId), PASSWORD: nz(p.Password),
    COUPONNO: nz(p.Couponno), W_ACCOUNTNAME: nz(p.W_AccountName), W_ACCOUNTNO: nz(p.W_AccountNo), W_BANKNAME: nz(p.W_BankName),
    W_TRANSID: nz(p.W_TransId), W_TRANSDATE: nz(p.W_TransDate), W_REMARK: nz(p.W_Remark), W_RECEIPT: nz(p.W_Receipt), FileName: nz(p.FileName),
    SDIDFORUPDATE: nz(p.SDID), MODE: nz(p.Mode), EWALATEAMT: Ewalateamt, EWALATETYPE: Ewalatetype, LOGINID_SUBS: '', PASSWORD_SUBS: '',
  });
  ResultOutPut = s(outVal(row, 'strresult')); // Convert.ToString(DBNull) => ""
  res.json(ResultOutPut);
}));

module.exports = router;
