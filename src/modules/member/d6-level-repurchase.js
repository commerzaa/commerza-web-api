'use strict';
// Ported from Member\Controllers\CustomerPanel\D6_Level_Repurchase.cs (12 public actions) - database: affiliate (Db_Affiliate)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');
const DB = 'affiliate';
const P = '/member/D6_Level_Repurchase';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const NRE = () => new Error('Object reference not set to an instance of an object.');
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}

const INCOME_PROPS = ['TOTALINCOME', 'AvailableCoinWallet', 'AvailableCommissionWallet', 'ReferralIncome', 'LEVELINCOME', 'GrowthReferralIncome', 'ROI_GROWTHLEVEL', 'ROI',
  'DepositedATC', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALDIRECTINCOME', 'Available_Fund', 'CURRENTINCOME', 'WITHDRAWALAMOUNT', 'NetCommissionWallet', 'TLBV', 'TRBV',
  'TotalAvailableShoppingPoints'];
const TITLE_PROPS = ['SID', 'TITLE', 'HERF', 'Dashboardshotcut'];
const REWARD_PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS', 'ACHIVED', 'REQUIRED', 'MATCHED'];
const RMP_PROPS = ['REGNO', 'CFL', 'CFR', 'PAIDPAIR', 'PPV', 'TLPV', 'PAIDPV', 'FLUSHPV', 'CLPV', 'CRPV', 'PBV', 'TLBV', 'TRBV', 'PAIDBV', 'FLUSHBV', 'CLBV', 'CRBV', 'DIRECTINCOME', 'PAIRINCOME', 'LEVELINCOME', 'CRAMOUNT', 'DRAMOUNT', 'TDS', 'ADMINCHARGE', 'WITHDRAWALAMOUNT', 'EPINGENERATE', 'FRANCHISEREFINCOME', 'FULSHPAIRS', 'TOTALINCOME', 'CURRENTINCOME', 'CAPPINGLIMIT', 'FIRTPAIRSIDE', 'ACITVE', 'LOGINID', 'GIVEBV', 'PDAP', 'TOTAL_AGENCY', 'CURRENT_AGENCY', 'ISAGENCYACTIVE', 'GPV', 'CGPV', 'CPPV', 'PGBV', 'LISID', 'ROI', 'TEMPROI', 'RedeemedPoints', 'TASKLEVELINCOME', 'ReferralIncome', 'GrowthReferralIncome', 'DepositedATC', 'ROI_GROWTHLEVEL', 'HOLDREFERRALADMINCHARGE', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALADMINCHARGE', 'HOLDGROWTHREFERRALDIRECTINCOME', 'TotalAvailableShoppingPoints', 'Available_Fund', 'CREDITED_FUND', 'USED_FUND', 'AVAILABLE_FUND', 'NetCoinWallet', 'BinaryLevelIncome', 'Used_Coin_Wallet', 'HOLDLEVELADMINCHARGE', 'HOLDLEVELINCOME', 'HOLDGROWTHLEVELADMINCHARGE', 'HOLDGROWTHLEVELINCOME', 'AvailableCommissionWallet', 'AvailableCoinWallet', 'RollupIncome', 'STP', 'Credited_BTC', 'Used_BTC', 'Available_BTC', 'TotalDepositedBTCInBTCWalletNew'];

// ---- public non-view methods of the controller (also exposed as routes) ----
async function AllIncomeForDashBoard(req) {
  const rows = await db.proc(DB, 'USP_ALLINCOME_REPORT', { REGNO: Number(req.user.plid) });
  return mapRows(rows, INCOME_PROPS);
}
async function ReferalLinks() {
  const rows = await db.proc(DB, 'USP_REFERAL_LINK', {});
  return mapRows(rows, ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active']);
}
async function AllSubTitleWithUrl() {
  const rows = await db.proc(DB, 'USP_ALLSUBMENU_TITLEWITH_URL', {});
  return mapRows(rows, TITLE_PROPS);
}
async function GetRewardFroDashBoard(req) {
  let GetEwalletReward = [];
  try {
    const rows = await db.proc(DB, 'USP_GETEWALLET_REWARDS', {});
    GetEwalletReward = mapRows(rows, REWARD_PROPS);
    parseInt(String(outv(rows, 'TOTALCOUNT')), 10);
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'USP_GETEWALLET_REWARDS', req);
    const e = new Error('redirect'); e.redirect = '/page-not-found'; throw e; // legacy Response.Redirect("/page-not-found")
  }
  return GetEwalletReward;
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  let PROCEDURENAME = '';
  try {
    const FavoriteURL = sessionStore.get(req, 'FavoriteURL');
    if (FavoriteURL !== undefined && FavoriteURL !== null) return res.json({ redirect: String(FavoriteURL) });

    // Auto Approval Of BTC/ETH/LTC/XRP/BCH Etc For E-Wallet Topup (legacy background thread)
    const RegNo = Number(req.user.plid);
    setImmediate(() => { Promise.resolve(CoinPaymentAPI.PaymentAutoClearification(RegNo)).catch((e) => console.error(e.message)); });

    const out = {};
    out.AllincomeForDashboard = await AllIncomeForDashBoard(req);
    out.links = await ReferalLinks();
    out.AllSubTitleRecord = await AllSubTitleWithUrl();
    out.TotalReward = await GetRewardFroDashBoard(req);

    const Plid = Number(req.user.plid);
    let loginid = '';
    const row = await db.queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
    if (row != null) loginid = row.username;

    PROCEDURENAME = 'USP_GROWTH_ROICHART';
    const gm = await db.proc(DB, 'USP_GROWTH_ROICHART', {});
    const GrowthMaster = mapRows(gm, ['REGNO', 'INVEST_AMOUNT', 'MAXRETURN', 'CURRENTRETURN']);
    const Totalcount = parseInt(String(outv(gm, 'TOTALCOUNT')), 10) || 0;
    out.PackageCount = Totalcount;
    const PercentArray = [];
    for (let i = 0; i < GrowthMaster.length; i++) {
      if (!Number(GrowthMaster[i].MAXRETURN)) throw new Error('Attempted to divide by zero.');
      const Percentage = (Number(GrowthMaster[i].CURRENTRETURN) * 100) / Number(GrowthMaster[i].MAXRETURN);
      PercentArray[i] = Number(Percentage.toFixed(2));
    }
    out.Growthincome = GrowthMaster;
    out.TotalGrowthPercentage = PercentArray;

    const sa = await db.scalar(DB, 'SELECT SHOWACTIVE FROM TBL_DETAILSPAGEMASTERFORREGISTRATION WHERE TDPMFRID=4 limit 1');
    out.Sideactive = sa === null || sa === undefined ? 0 : Number(sa);
    const mi = await db.scalar(DB, 'select coalesce(sum(coalesce(TotalPayableAmount,0)),0) as TotalPayableAmount from Tbl_AllSubscriptionMaster where IsOrderCanceled=0 and RegNo=@plid', { plid: Plid });
    out.MakeInvesMentAmt = mi === null || mi === undefined ? 0 : Number(mi);
    const avalfund = await db.scalar(DB, "SELECT coalesce(TITLE,'') FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=2 limit 1");
    if (avalfund !== null && avalfund !== undefined) out.avalfund = avalfund;
    const currentfund = await db.scalar(DB, "SELECT coalesce(TITLE,'') FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=3 limit 1");
    if (currentfund !== null && currentfund !== undefined) out.currentfund = currentfund;

    out.WalletPoint = '0.00';
    out.membernews = mapRows(await db.query(DB, "select * from tbl_news where status=1 and type='Member' order by date desc limit 5"),
      ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename']);
    const GalleryImages = await db.queryOne(DB, 'select * from Tbl_FlyerManagement where Status=1 and IsActive=1 and ContentType=2 limit 1');
    if (GalleryImages != null) {
      if (GalleryImages.name === null || GalleryImages.title === null) throw NRE();
      out.FlayerImages = String(GalleryImages.name);
      out.ImageTitle = String(GalleryImages.title);
    }
    const inr = await db.scalar(DB, 'select INR from Tbl_Atc_INR_Ratio_Master limit 1');
    out.INR = inr === null || inr === undefined ? 0 : inr;

    PROCEDURENAME = 'USP_SPONSERANDACHIVELEVEL';
    const ObjSponser = mapRows(await db.proc(DB, 'USP_SPONSERANDACHIVELEVEL', { PLID: Plid }), ['Name', 'UserName', 'Mobile', 'EmailID']);

    PROCEDURENAME = 'USP_SubScriptionDetails';
    const SubscriptionDetails = mapRows(await db.proc(DB, 'USP_SubScriptionDetails', { PLID: Plid }), ['PuchaseDate', 'AllPackageName', 'TotalPaidForATCININR']);
    out.SubscriptionList = SubscriptionDetails;
    out.SubscriptionListcount = SubscriptionDetails.length;

    PROCEDURENAME = 'USP_FUND_HISTORYGet_Top5Record';
    const WalletStateMent = mapRows(await db.proc(DB, 'USP_FUND_HISTORYGet_Top5Record', { Plid }),
      ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance']);
    out.fundHistory = WalletStateMent;
    out.WalletStateMentcount = WalletStateMent.length;

    PROCEDURENAME = 'USP_GetSubMenuTittle';
    const GetTittleOfSubmenu = mapRows(await db.proc(DB, 'USP_GetSubMenuTittle', { SID: 43 }), TITLE_PROPS);
    if (GetTittleOfSubmenu.length === 0) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
    if (GetTittleOfSubmenu[0].TITLE === null || GetTittleOfSubmenu[0].HERF === null) throw NRE();
    out.GrowthBonus = String(GetTittleOfSubmenu[0].TITLE);
    const url = String(GetTittleOfSubmenu[0].HERF).split('/');
    if (url.length < 3) throw new Error('Index was outside the bounds of the array.');
    out.Url = String(url[2]);

    PROCEDURENAME = 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5';
    const DL = mapRows(await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5', { LOGINID: loginid }),
      ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV',
        'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName']);
    out.DownLineList = DL;
    out.NoofDownLineList = DL.length;
    out.ATCCoinRate = '0.00000000';
    out.ATCCoin = '0.00000000'; // both legacy branches assign "0.00000000"

    const loginids = await db.scalar(DB, 'SELECT LOGINID FROM MEMBER_MASTER WHERE USERNAME=@u limit 1', { u: loginid });
    // PORT-NOTE: T-SQL table-valued functions FUN_ALL_DOWNLINE_MEMBERLIST / FUN_ALL_DOWNLINE_MEMBERLIST_BINARY are expected as PostgreSQL set-returning functions of the same (lower-case) name.
    const TotalDirectReferral = await db.scalar(DB, 'select coalesce(count(1),0) as TotalDirectReferral from FUN_ALL_DOWNLINE_MEMBERLIST(@l,0) where SPONSERID=@l', { l: loginids });
    const TotalDownline = await db.scalar(DB, 'select coalesce(count(1),0) as TotalDownline from FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(@l,0)', { l: loginids });
    out.TotalDirectReferral = TotalDirectReferral === null ? 0 : Number(TotalDirectReferral);
    out.TotalDownline = TotalDownline === null ? 0 : Number(TotalDownline);

    PROCEDURENAME = 'Usp_ManageReferal';
    await db.proc(DB, 'Usp_ManageReferal', { PLID: parseInt(req.user.plid, 10) }); // result (Landing list) was never used by the legacy view code
    const rows = await db.queryOne(DB, 'select * from portal_login where PLID=@plid limit 1', { plid: Plid });
    if (row == null || rows == null) throw NRE();
    const UserName = row.username;
    out.ReferralID = row.username;
    const RLID = rows.defaultlandingurl === 0 || rows.defaultlandingurl === null ? 0 : rows.defaultlandingurl;
    const row1 = await db.queryOne(DB, 'select * from Referral_Link where RLID=@rlid limit 1', { rlid: RLID });
    if (row1 != null) {
      if (row1.url === null || row1.url === undefined) throw NRE();
      out.DefaultUrl = String(row1.url).replace(/\/+$/, '') + '/' + UserName;
    }
    return res.json({ Model: ObjSponser, ...out });
  } catch (ExpObj) {
    if (ExpObj.redirect) return res.json({ redirect: ExpObj.redirect });
    console.error(ExpObj.message);
    await errorInsert(ExpObj, PROCEDURENAME, req);
    return res.json({ ErrorMessage: ExpObj.message });
  }
}));

// auth (legacy read the session without a null check)
router.all(P + '/DefaultSponserSide{/:id}', auth, asyncHandler(async (req, res) => {
  const side = Number(req.p.side);
  if (req.p.side === undefined || req.p.side === null || String(req.p.side).trim() === '' || Number.isNaN(side)) {
    throw new Error("Invalid column name '" + String(req.p.side) + "'."); // legacy concatenated the raw text into SQL
  }
  const plid = Number(req.user.plid);
  // Member_Master.Get_member_details(plid): row where REGNO == plid
  const member = await db.queryOne(DB, 'select regno from member_master where regno=@plid limit 1', { plid });
  const Regno = member ? Number(member.regno) : 0;
  await db.exec(DB, 'update Member_Master set DefaultSponserSide=@side where regNo=@regno', { side, regno: Regno });
  const Ret = await db.exec(DB, 'update Portal_Login Set CommunitySide=@side where plid=@plid', { side, plid });
  res.json(Ret);
}));

// auth
router.all(P + '/Visitor_statatics_data{/:id}', auth, asyncHandler(async (req, res) => {
  let VisitorStatics = [];
  try {
    const rows = await db.proc(DB, 'USP_Visitor_Statics', { PLID: Number(req.user.plid) });
    VisitorStatics = mapRows(rows, ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth']);
    return res.json(VisitorStatics);
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'USP_Visitor_Statics', req);
    return res.json(VisitorStatics);
  }
}));

// auth
router.all(P + '/GetAllIncome{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await AllIncomeForDashBoard(req));
}));

// auth
router.all(P + '/GetAllIncomeForChart{/:id}', auth, asyncHandler(async (req, res) => {
  const r = await db.queryOne(DB, 'select * from MEMBER_PERFORMANCE where REGNO=@plid limit 1', { plid: Number(req.user.plid) });
  res.json(r ? mapRows([r], RMP_PROPS)[0] : null);
}));

// auth (legacy had no session read, but this is member-panel dashboard data)
router.all(P + '/GetTdsIncom{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GETALLINCOM', {});
  res.json(mapRows(rows, ['TITLE', 'IncomeColor', 'MenuID']));
}));

// auth
router.all(P + '/GetBinaryIncomeByRegNo{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GetMonthlyBinaryIncomeByRegNo', { REGNO: Number(req.user.plid) });
  res.json(mapRows(rows, ['REGNO', 'BINARYINCOME', 'PAYDATE']));
}));

// public (legacy had no session check)
router.all(P + '/BitcoinRate{/:id}', asyncHandler(async (req, res) => {
  const CurrencySymbol = config.app.CurrencySymbol;
  try {
    const UrlForHit = 'https://bitpay.com/api/rates/' + CurrencySymbol;
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x });
    const ObjATCRateManagement = JSON.parse(r.data);
    if (ObjATCRateManagement.rate === undefined || ObjATCRateManagement.rate === null) throw NRE();
    res.json(String(ObjATCRateManagement.rate));
  } catch (ex) {
    // PORT-NOTE: legacy serialised the exception object itself; only its message is returned here.
    res.json({ Message: ex.message });
  }
}));

// public-method helpers that return lists (exposed as routes for coverage; MVC would have rendered ToString())
// auth
router.all(P + '/AllIncomeForDashBoard{/:id}', auth, asyncHandler(async (req, res) => { res.json(await AllIncomeForDashBoard(req)); }));
// public (legacy had no session check)
router.all(P + '/ReferalLinks{/:id}', asyncHandler(async (req, res) => { res.json(await ReferalLinks()); }));
// public (legacy had no session check)
router.all(P + '/AllSubTitleWithUrl{/:id}', asyncHandler(async (req, res) => { res.json(await AllSubTitleWithUrl()); }));
// auth
router.all(P + '/GetRewardFroDashBoard{/:id}', auth, asyncHandler(async (req, res) => {
  try { res.json(await GetRewardFroDashBoard(req)); } catch (e) { if (e.redirect) return res.json({ redirect: e.redirect }); throw e; }
}));

module.exports = router;
