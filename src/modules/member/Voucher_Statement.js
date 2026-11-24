'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Voucher_Statement.cs (Voucher_StatementController, 2 actions: Index, UpgradeRank)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: Voucher Statement -> referral/9P1ssmoPPRyjgEK9tT3AzE_plus__slash_xZ9qgVcovou
 */
const express = require('express');
const { queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const ATCAPI = require('../../lib/member/ATCAPI');

const router = express.Router();
const DB = 'affiliate';
const C = 'Voucher_Statement';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const P_VOUCHER = ['ROWNUMBER', 'REGNO', 'TYPE', 'AMOUNT', 'VOUCHERNO', 'CREDITDEBIT', 'REMARK', 'DATE', 'ISHOLD', 'LEVEL', 'VOUCHERTYPRE', 'ACTIVE', 'STATUS'];
const NAMES = { 1: 'GIFT YOUR VOUCHER', 2: 'UPGRADE TO BRONZE', 3: 'UPGRADE TO SILVER', 4: 'UPGRADE TO GOLD', 5: 'UPGRADE TO PLATIUM', 6: 'UPGRADE TO DIAMOND' };

// ---- Index ------------------------------------------------------------------------------------------------------
// auth (SessionExpireCheck)
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/9P1ssmoPPRyjgEK9tT3AzE_plus__slash_xZ9qgVcovou'], auth, asyncHandler(async (req, res) => {
  let { fromDate, toDate, CrDrType, TrType, SearchField, SearchValue } = req.p;
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  let Status = optInt(req.p.Status);
  if (ddlcustpage === null) ddlcustpage = 100;
  fromDate = nz(fromDate); toDate = nz(toDate); CrDrType = nz(CrDrType);
  if (TrType === undefined || TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (Status === null) Status = 0;
  SearchField = nz(SearchField); SearchValue = nz(SearchValue);
  const Plid = Number(req.user.plid);

  // Auto approval of BTC for E-Wallet topup (background thread)
  Promise.resolve().then(() => ATCAPI.BTCPaymentClearification(Plid)).catch(() => {});

  const ViewBag = {};
  let Obj = [];
  try {
    ViewBag.value = Number((await scalar(DB, 'SELECT coalesce(rankid,0) FROM member_master WHERE regno=@plid limit 1', { plid: Plid })) || 0);
    const sum = async (cond) => Number((await scalar(DB, `SELECT coalesce(SUM(amount),0) FROM tbl_voucher_statement WHERE ${cond} AND active=1 AND regno=@plid`, { plid: Plid })) || 0);
    ViewBag.total = await sum("type='Cr'");
    ViewBag.used = await sum('ishold=3');
    ViewBag.totalbalance = await sum('ishold=0');
    ViewBag.block = await sum('ishold=2');
    ViewBag.hold = await sum('ishold=1');
    ViewBag.balance = ViewBag.totalbalance - ViewBag.used;
    ViewBag.value = ViewBag.value + 1;
    if (NAMES[ViewBag.value] !== undefined) ViewBag.Name = NAMES[ViewBag.value];

    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    ViewBag.PLID = Plid;
    // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when empty)
    const raw = await proc(DB, 'usp_voucher_statement', {
      startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate, plid: Plid, orderbydate: 'Desc', status: Status,
    });
    Obj = mapRows(raw, P_VOUCHER);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = totalOf(raw);
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'USP_Fund_History');
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ Model: Obj, ViewBag });
}));

// ---- UpgradeRank ---------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/UpgradeRank{/:id}`, auth, asyncHandler(async (req, res) => {
  const Rank = parseInt(req.p.Rank, 10);
  if (Number.isNaN(Rank)) throw new Error("The parameters dictionary contains a null entry for parameter 'Rank' of non-nullable type 'System.Int32'.");
  let Upgrade = '';
  if (Rank === 1) Upgrade = 'ACSSOCIATE';
  // legacy: the following chain is a new if-statement, so Rank 1 ends up as "ASSOCIATE"
  if (Rank === 2) Upgrade = 'BRONZE';
  else if (Rank === 3) Upgrade = 'SILVER';
  else if (Rank === 4) Upgrade = 'GOLD';
  else if (Rank === 5) Upgrade = 'PLATIUM';
  else if (Rank === 6) Upgrade = 'DIAMOND';
  else Upgrade = 'ASSOCIATE';

  let ReturnOutput = 'success';
  const PLID = Number(req.user.plid);
  const procs = { 1: 'usp_firstlevelincome', 2: 'usp_secondlevelincome', 3: 'usp_thirdlevelincome', 4: 'usp_fourthlevelincome', 5: 'usp_fifthlevelincome', 6: 'usp_sixthlevelincome' };
  if (procs[Rank]) {
    // PORT-NOTE: @stroutput OUT is read from the "stroutput" column of the result row
    const out = await proc(DB, procs[Rank], { regno: PLID, rankid: Rank });
    const r = out[0] || {};
    const k = Object.keys(r).find((x) => x.toLowerCase() === 'stroutput');
    ReturnOutput = k === undefined ? s(r[Object.keys(r)[0]]) : s(r[k]);
  }
  const PLDetails = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: PLID });
  if (PLDetails) {
    if (ReturnOutput === 'ok') {
      let abc = 'A';
      if (Upgrade !== 'ASSOCIATE') abc = 'AN';
      Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(PLDetails.mobile, 'CONGRATULATIONS FOR BEING PROMOTED AS ' + abc + ' ' + Upgrade, '1')).catch(() => {});
    }
  }
  return res.json(ReturnOutput);
}));

module.exports = router;
