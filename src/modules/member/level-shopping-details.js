'use strict';
/** Port of Member/Controllers/CustomerPanel/LevelShoppingDetails.cs (LevelShoppingDetailsController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ROWNUMBER', 'LOGINID', 'SPONSERID', 'ROOTID', 'EMPLEVEL', 'NAME', 'MOBILE', 'CITYNAME', 'REGDATE', 'STATUS', 'EMAILID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV',
  'PAIDBV', 'USERNAME', 'SIDE', 'SPOUNSER_USERNAME', 'ACTIVE', 'KITPRICE', 'REGNO', 'root_username', 'TITLE', 'STATENAME', 'PARENTID', 'RANKNAME', 'RANKID', 'ORDERAMOUNT',
  'BV', 'PV', 'CashBack', 'ORDERNO', 'ORDERDATE'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const convInt = (v) => {
  if (v === undefined || v === null) return 0;
  if (!/^\s*[+-]?\d+\s*$/.test(String(v))) throw new Error('Input string was not in a correct format.');
  return parseInt(v, 10);
};
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const totalOf = (rows, name) => { const n = parseInt(outCol(rows, name), 10); return Number.isNaN(n) ? 0 : n; };
const decOf = (rows, name) => { const n = parseFloat(outCol(rows, name)); return Number.isNaN(n) ? 0 : n; };

// route-config: referral/99iRNiQW1t15cd8CtBtuA67aFNhG6yqLRtyyyyy -> Index
// auth
router.all(['/member/LevelShoppingDetails/Index{/:id}', '/member/referral/99iRNiQW1t15cd8CtBtuA67aFNhG6yqLRtyyyyy'], auth, asyncHandler(async (req, res) => {
  let dynamicpagging = optInt(req.p.dynamicpagging);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const orderbydate = nn(req.p.orderbydate);
  let btnexel = nn(req.p.btnexel); // eslint-disable-line no-unused-vars
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const Username = nn(req.p.Username);
  const EmailID = nn(req.p.EmailID);
  const SponserID = nn(req.p.SponserID);
  let page = optInt(req.p.page);
  const Name = nn(req.p.Name);
  let Side = optInt(req.p.Side);
  let Level = req.p.Level;
  let ActivationStatus = req.p.ActivationStatus;
  let LEVENUMBERto = optInt(req.p.LEVENUMBERto);
  let RANKID = optInt(req.p.RANKID);
  let MainSearch = nn(req.p.MainSearch); // eslint-disable-line no-unused-vars

  if (LEVENUMBERto === null) LEVENUMBERto = 0;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (Side === null) Side = 0;
  if (Level === undefined || Level === null || Level === '') Level = '0'; // MVC binds an empty string to null
  if (RANKID === null) RANKID = 0;
  if (ActivationStatus === undefined || ActivationStatus === null || ActivationStatus === '') ActivationStatus = '0';
  const ViewBag = { isactive: 0, isedit: 0 };

  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'SELECT username FROM member_master WHERE regno=@plid LIMIT 1', { plid: Plid });
  if (row) loginid = row.username;
  const MaxRows = dynamicpagging;
  if (page === null) page = 1;

  // PORT-NOTE: @TotalCount / @TotalLRBV / @TOTALLRINCOME / @TOTALORDERAMOUNT / @TOTALBV OUT params are returned as columns of the result row.
  const rows = await proc(DB, 'usp_shoppingleveldownline', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromdate.trim(), todate: todate.trim(),
    levenumberfrom: convInt(Level), side: Side, name: Name.trim(), username: Username.trim(), emailid: EmailID.trim(), sponserid: SponserID.trim(),
    checkadminside: 0, activationstatus: convInt(ActivationStatus), levenumberto: LEVENUMBERto, orderbydate, rankid: RANKID,
  });
  const LRMember = mapRows(rows, PROPS);
  ViewBag.TOTORDERAMOUNT = decOf(rows, 'totalorderamount');
  ViewBag.TOTBV = decOf(rows, 'totalbv');
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = totalOf(rows, 'totalcount');
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.LEVENUMBERto = LEVENUMBERto;
  ViewBag.Name = Name;
  ViewBag.Username = Username;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  // (Export Excel branch is commented out in the legacy code)
  res.json({ view: '~/Views/CustomerPanel/LevelShoppingDetails/Index.cshtml', Model: LRMember, ViewBag });
}));

module.exports = router;
