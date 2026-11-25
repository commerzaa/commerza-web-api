'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/TokenAchivers.cs (TokenAchiversController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
// Convert.ToInt32/ToInt64(string): null => 0, non-numeric => FormatException
const convInt = (v) => {
  if (v === undefined || v === null) return 0;
  if (!/^\s*[+-]?\d+\s*$/.test(String(v))) throw new Error('Input string was not in a correct format.');
  return parseInt(v, 10);
};
const totalOf = (rows) => { const f = rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === 'totalcount'); const n = k === undefined ? NaN : parseInt(f[k], 10); return Number.isNaN(n) ? 0 : n; };
const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');

const TOKEN_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'EMAILID', 'MOBILE', 'DOC', 'ACTIVE', 'TOKEN_NO', 'BONAZANAME', 'LEFTIDS', 'RIGHTIDS', 'Date', 'BBZMID', 'REGNO'];
const TOKENLIST_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'MOBILE', 'DOC', 'SIDE', 'DATE'];

// auth
// route-config: "referral/Pc3kYzKfgdfgdffdpqZGPu3qSgL8AuAw==" -> TokenAchivers/Index
router.all(['/member/TokenAchivers/Index{/:id}', '/member/referral/Pc3kYzKfgdfgdffdpqZGPu3qSgL8AuAw=='], auth, asyncHandler(async (req, res) => {
  try {
    let ddlcustpage = optInt(req.p.ddlcustpage);
    const SearchField = nn(req.p.SearchField);
    const SearchValue = nn(req.p.SearchValue);
    const fromdate = nn(req.p.fromdate);
    const todate = nn(req.p.todate);
    let page = optInt(req.p.page);
    let Bonzaname = optInt(req.p.Bonzaname);
    if (ddlcustpage === null) ddlcustpage = 100;
    if (Bonzaname === null) Bonzaname = 0;

    const Plid = Number(req.user.plid);
    // legacy looked up Member_Master.LOGINID into an unused local; not needed
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;

    // PORT-NOTE: the legacy SQL text lists @BONZANAME as the 9th positional argument, which lands on the proc's @TOKENNO parameter
    // (the extra @TOKENNO="0" SqlParameter is not referenced in the text). @TOTALCOUNT OUT is returned as a column ("totalcount").
    const rows = await db.proc(DB, 'usp_allbonaza_achiver', {
      startrowindex: page, maxrows: MaxRows, plid: Math.trunc(Plid), fromdate, todate, searchfiel: SearchField.trim(), searchvalue: SearchValue.trim(),
      tokenno: Bonzaname,
    });
    const ViewBag = {
      CurrentPage: page,
      GridPageSize: MaxRows,
      TotalRecord: totalOf(rows),
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField,
      SearchValue,
      fromDate: fromdate,
      toDate: todate,
      ddlcustpage,
    };
    res.json({ view: '~/Views/CustomerPanel/TokenAchivers/Index.cshtml', Model: mapRows(rows, TOKEN_PROPS), ViewBag });
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_ALLBONAZA_ACHIVER', 0, legacyPath(req)); } catch (e) { console.error(e); }
    // legacy: Response.Redirect("/page-not-found")
    res.json({ redirect: '/page-not-found' });
  }
}));

// auth
router.all('/member/TokenAchivers/TOKENLISTMEMBERACHIVE{/:id}', auth, asyncHandler(async (req, res) => {
  const { TOKENNO, PLID } = req.p;
  // PORT-NOTE: SQL Server implicitly converted the "" STARTROWINDEX/MAXROWS strings to 0.
  const plid = convInt(PLID);
  const tokenno = convInt(TOKENNO);
  const rows = await db.proc(DB, 'usp_allbonaza_achiver', {
    startrowindex: 0, maxrows: 0, plid, fromdate: '', todate: '', searchfiel: '', searchvalue: '', tokenno,
  });
  res.json(mapRows(rows, TOKENLIST_PROPS));
}));

module.exports = router;
