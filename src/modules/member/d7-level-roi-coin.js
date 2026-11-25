'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\D7_Level_ROI_Coin.cs (D7_Level_ROI_CoinController) */
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');
const Member_Master = require('../../lib/member/Member_Master');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/D7_Level_ROI_Coin';

const str = (v) => (v === null || v === undefined ? '' : String(v));
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}

const P_GROWTH = ['REGNO', 'INVEST_AMOUNT', 'MAXRETURN', 'CURRENTRETURN'];
const P_SPONSER = ['Name', 'UserName', 'Mobile', 'EmailID'];
const P_SUBS = ['PuchaseDate', 'AllPackageName', 'TotalPaidForATCININR'];
const P_WALLET5 = ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance'];
const P_SUBMENU = ['SID', 'TITLE', 'HERF', 'Dashboardshotcut'];
const P_DOWN5 = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName'];
const P_INCOME = ['TOTALINCOME', 'AvailableCoinWallet', 'AvailableCommissionWallet', 'ReferralIncome', 'LEVELINCOME', 'GrowthReferralIncome', 'ROI_GROWTHLEVEL', 'ROI', 'DepositedATC', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALDIRECTINCOME', 'Available_Fund', 'CURRENTINCOME', 'WITHDRAWALAMOUNT', 'NetCommissionWallet', 'TLBV', 'TRBV', 'TotalAvailableShoppingPoints'];
const P_VISITOR = ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth'];
const P_GETALLINCOME = ['TITLE', 'IncomeColor', 'MenuID'];
const P_BINARY = ['REGNO', 'BINARYINCOME', 'PAYDATE'];
const P_REFLINKS = ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active'];
const P_REWARDS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS', 'ACHIVED', 'REQUIRED', 'MATCHED'];
const P_NEWS = ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename'];
const P_PERF = ['REGNO', 'CFL', 'CFR', 'PAIDPAIR', 'PPV', 'TLPV', 'PAIDPV', 'FLUSHPV', 'CLPV', 'CRPV', 'PBV', 'TLBV', 'TRBV', 'PAIDBV', 'FLUSHBV', 'CLBV', 'CRBV', 'DIRECTINCOME', 'PAIRINCOME', 'LEVELINCOME', 'CRAMOUNT', 'DRAMOUNT', 'TDS', 'ADMINCHARGE', 'WITHDRAWALAMOUNT', 'EPINGENERATE', 'FRANCHISEREFINCOME', 'FULSHPAIRS', 'TOTALINCOME', 'CURRENTINCOME', 'CAPPINGLIMIT', 'FIRTPAIRSIDE', 'ACITVE', 'LOGINID', 'GIVEBV', 'PDAP', 'TOTAL_AGENCY', 'CURRENT_AGENCY', 'ISAGENCYACTIVE', 'GPV', 'CGPV', 'CPPV', 'PGBV', 'LISID', 'ROI', 'TEMPROI', 'RedeemedPoints', 'TASKLEVELINCOME', 'ReferralIncome', 'GrowthReferralIncome', 'DepositedATC', 'ROI_GROWTHLEVEL', 'HOLDREFERRALADMINCHARGE', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALADMINCHARGE', 'HOLDGROWTHREFERRALDIRECTINCOME', 'TotalAvailableShoppingPoints', 'Available_Fund', 'CREDITED_FUND', 'USED_FUND', 'AVAILABLE_FUND', 'NetCoinWallet', 'BinaryLevelIncome', 'Used_Coin_Wallet', 'HOLDLEVELADMINCHARGE', 'HOLDLEVELINCOME', 'HOLDGROWTHLEVELADMINCHARGE', 'HOLDGROWTHLEVELINCOME', 'AvailableCommissionWallet', 'AvailableCoinWallet', 'RollupIncome', 'STP', 'Credited_BTC', 'Used_BTC', 'Available_BTC', 'TotalDepositedBTCInBTCWalletNew'];

// ---- helper (public non-action) methods of the C# controller ----
async function AllIncomeForDashBoard(req) {
  return mapRows(await proc(DB, 'usp_allincome_report', { regno: Number(req.user.plid) }), P_INCOME);
}
async function ReferalLinks() {
  return mapRows(await proc(DB, 'usp_referal_link', {}), P_REFLINKS);
}
async function AllSubTitleWithUrl() {
  return mapRows(await proc(DB, 'usp_allsubmenu_titlewith_url', {}), P_SUBMENU);
}
// returns { redirect } when the legacy code did Response.Redirect("/page-not-found")
async function GetRewardFroDashBoard(req) {
  try {
    // PORT-NOTE: @TOTALCOUNT OUT (BigInt) is not needed by callers; proc returns the reward rows.
    return { rows: mapRows(await proc(DB, 'usp_getewallet_rewards', {}), P_REWARDS) };
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'USP_GETEWALLET_REWARDS', req);
    return { redirect: '/page-not-found' };
  }
}

// route-config: referral/mefol8A7MRc07OvxG9zn3hBOvx0WDpUF
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/mefol8A7MRc07OvxG9zn3hBOvx0WDpUF'], auth, asyncHandler(async (req, res) => {
  let PROCEDURENAME = '';
  const ViewBag = {};
  try {
    const fav = sessionStore.get(req, 'FavoriteURL');
    if (fav !== undefined && fav !== null) return res.json({ redirect: String(fav) });

    // Auto approval of BTC/ETH/LTC/XRP/BCH etc. for E-Wallet topup (background thread in legacy)
    Promise.resolve().then(() => CoinPaymentAPI.PaymentAutoClearification(Number(req.user.plid))).catch(() => {});

    ViewBag.AllincomeForDashboard = await AllIncomeForDashBoard(req);
    ViewBag.links = await ReferalLinks();
    ViewBag.AllSubTitleRecord = await AllSubTitleWithUrl();
    const rw = await GetRewardFroDashBoard(req);
    if (rw.redirect) return res.json({ redirect: rw.redirect });
    ViewBag.TotalReward = rw.rows;

    const Plid = Number(req.user.plid);
    let loginid = '';
    const row = await queryOne(DB, 'select * from member_master where regno = @p limit 1', { p: Plid });
    if (row) loginid = row.username;

    PROCEDURENAME = 'USP_GROWTH_ROICHART';
    // PORT-NOTE: @TOTALCOUNT/@RESULT OUT params are read from the proc's result columns (totalcount) when present, otherwise the row count.
    const gmRows = await proc(DB, 'usp_growth_roichart', {});
    const GrowthMaster = mapRows(gmRows, P_GROWTH);
    const Totalcount = gmRows.length && gmRows[0].totalcount !== undefined && gmRows[0].totalcount !== null ? parseInt(gmRows[0].totalcount, 10) : gmRows.length;
    ViewBag.PackageCount = Totalcount;
    const PercentArray = [];
    for (let i = 0; i < GrowthMaster.length; i++) {
      if (Number(GrowthMaster[i].MAXRETURN) === 0) throw new Error('Attempted to divide by zero.');
      const Percentage = Number(GrowthMaster[i].CURRENTRETURN) * 100 / Number(GrowthMaster[i].MAXRETURN);
      PercentArray[i] = Number(Percentage.toFixed(2));
    }
    ViewBag.Growthincome = GrowthMaster;
    ViewBag.TotalGrowthPercentage = PercentArray;

    const Sideactive = Number(await scalar(DB, 'SELECT SHOWACTIVE FROM TBL_DETAILSPAGEMASTERFORREGISTRATION WHERE TDPMFRID=4 limit 1')) || 0;
    ViewBag.Sideactive = Sideactive;
    const MakeInvesMentAmt = Number(await scalar(DB, 'select coalesce(sum(coalesce(TotalPayableAmount,0)),0) as TotalPayableAmount from Tbl_AllSubscriptionMaster where IsOrderCanceled=false and RegNo=@p', { p: Plid })) || 0;
    ViewBag.MakeInvesMentAmt = MakeInvesMentAmt;
    const avalfund = await scalar(DB, "SELECT coalesce(TITLE,'') FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=2 limit 1");
    if (avalfund !== null && avalfund !== undefined) ViewBag.avalfund = avalfund;
    const currentfund = await scalar(DB, "SELECT coalesce(TITLE,'') FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=3 limit 1");
    if (currentfund !== null && currentfund !== undefined) ViewBag.currentfund = currentfund;

    ViewBag.WalletPoint = '0.00';
    ViewBag.membernews = mapRows(await query(DB, "select * from tbl_news where status = 1 and type = 'Member' order by date desc limit 5"), P_NEWS);

    const GalleryImages = await queryOne(DB, 'select * from tbl_flyermanagement where status = 1 and isactive = 1 and contenttype = 2 limit 1');
    if (GalleryImages) {
      ViewBag.FlayerImages = str(GalleryImages.name);
      ViewBag.ImageTitle = str(GalleryImages.title);
    }

    const AtcINR = await scalar(DB, 'select inr from Tbl_Atc_INR_Ratio_Master limit 1');
    ViewBag.INR = AtcINR === null || AtcINR === undefined ? 0 : AtcINR;

    PROCEDURENAME = 'USP_SPONSERANDACHIVELEVEL';
    const ObjSponser = mapRows(await proc(DB, 'usp_sponserandachivelevel', { plid: Plid }), P_SPONSER);

    PROCEDURENAME = 'USP_SubScriptionDetails';
    const SubscriptionDetails = mapRows(await proc(DB, 'usp_subscriptiondetails', { plid: Plid }), P_SUBS);
    ViewBag.SubscriptionList = SubscriptionDetails;
    ViewBag.SubscriptionListcount = SubscriptionDetails.length;

    PROCEDURENAME = 'USP_FUND_HISTORYGet_Top5Record';
    const WalletStateMent = mapRows(await proc(DB, 'usp_fund_historyget_top5record', { plid: Plid }), P_WALLET5);
    ViewBag.fundHistory = WalletStateMent;
    ViewBag.WalletStateMentcount = WalletStateMent.length;

    PROCEDURENAME = 'USP_GetSubMenuTittle';
    const GetTittleOfSubmenu = mapRows(await proc(DB, 'usp_getsubmenutittle', { sid: 43 }), P_SUBMENU);
    if (!GetTittleOfSubmenu.length) throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.');
    ViewBag.GrowthBonus = str(GetTittleOfSubmenu[0].TITLE);
    const Url = str(GetTittleOfSubmenu[0].HERF);
    const url = Url.split('/');
    if (url.length < 3) throw new RangeError('Index was outside the bounds of the array.');
    ViewBag.Url = url[2];

    PROCEDURENAME = 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5';
    const AllDownlineMemberLeftRightTop5 = mapRows(await proc(DB, 'usp_new_member_get_member_downlinelist_side_wise_top5', { loginid }), P_DOWN5);
    ViewBag.DownLineList = AllDownlineMemberLeftRightTop5;
    ViewBag.NoofDownLineList = AllDownlineMemberLeftRightTop5.length;
    ViewBag.ATCCoinRate = '0.00000000';
    // ATCUserId / Atc_WalletAddress are empty strings in legacy => both branches set "0.00000000"
    ViewBag.ATCCoin = '0.00000000';

    const loginids = await scalar(DB, 'SELECT LOGINID FROM MEMBER_MASTER WHERE USERNAME=@u limit 1', { u: loginid });
    const TotalDirectReferral = Number(await scalar(DB, 'SELECT coalesce(count(1),0) as TotalDirectReferral FROM FUN_ALL_DOWNLINE_MEMBERLIST(@l,0) where SPONSERID=@l', { l: loginids })) || 0;
    const TotalDownline = Number(await scalar(DB, 'select coalesce(count(1),0) as TotalDownline From FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(@l,0)', { l: loginids })) || 0;
    ViewBag.TotalDirectReferral = TotalDirectReferral;
    ViewBag.TotalDownline = TotalDownline;

    PROCEDURENAME = 'Usp_ManageReferal';
    await proc(DB, 'usp_managereferal', { plid: Math.trunc(Number(req.user.plid)) }); // ObjLanding (unused by the controller)
    const rows = await queryOne(DB, 'select * from portal_login where plid = @p limit 1', { p: Plid });
    if (!row || !rows) throw new TypeError('Object reference not set to an instance of an object.');
    const UserName = row.username;
    ViewBag.ReferralID = row.username;
    const RLID = rows.defaultlandingurl ? rows.defaultlandingurl : 0;
    const row1 = await queryOne(DB, 'select * from referral_link where rlid = @r limit 1', { r: RLID });
    if (row1) ViewBag.DefaultUrl = str(row1.url).replace(/\/+$/, '') + '/' + UserName;

    return res.json({ Model: ObjSponser, ViewBag });
  } catch (ExpObj) {
    ViewBag.ErrorMessage = ExpObj.message;
    await ErrorInsert(ExpObj, PROCEDURENAME, req);
    return res.json({ ViewBag: { ErrorMessage: ExpObj.message } });
  }
}));

// auth
router.all(`${P}/DefaultSponserSide{/:id}`, auth, asyncHandler(async (req, res) => {
  const side = parseInt(req.p.side, 10);
  let Regno = 0; let plid = 0;
  plid = Number(req.user.plid);
  const member_details = await new Member_Master().Get_member_details(plid);
  if (member_details) Regno = member_details.REGNO;
  if (Number.isNaN(side)) throw new Error("Incorrect syntax near ''.");
  let Ret = await exec(DB, 'update Member_Master set DefaultSponserSide=@s where regNo=@r', { s: side, r: Regno });
  Ret = await exec(DB, 'update Portal_Login Set CommunitySide=@s where plid=@p', { s: side, p: plid });
  res.json(Ret);
}));

// auth
router.all(`${P}/Visitor_statatics_data{/:id}`, auth, asyncHandler(async (req, res) => {
  let VisitorStatics = [];
  try {
    VisitorStatics = mapRows(await proc(DB, 'usp_visitor_statics', { plid: Number(req.user.plid) }), P_VISITOR);
    return res.json(VisitorStatics);
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'USP_Visitor_Statics', req);
    return res.json(VisitorStatics);
  }
}));

// auth
router.all(`${P}/GetAllIncome{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await AllIncomeForDashBoard(req));
}));

// auth
router.all(`${P}/GetAllIncomeForChart{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = await queryOne(DB, 'select * from member_performance where regno = @p limit 1', { p: Number(req.user.plid) });
  res.json(mapRow(r, P_PERF));
}));

// auth
router.all(`${P}/GetTdsIncom{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getallincom', {}), P_GETALLINCOME));
}));

// auth
router.all(`${P}/GetBinaryIncomeByRegNo{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getmonthlybinaryincomebyregno', { regno: Number(req.user.plid) }), P_BINARY));
}));

// auth
router.all(`${P}/BitcoinRate{/:id}`, auth, asyncHandler(async (req, res) => {
  const CurrencySymbol = config.app.CurrencySymbol;
  try {
    const UrlForHit = 'https://bitpay.com/api/rates/' + CurrencySymbol;
    const r = await axios.get(UrlForHit, { transformResponse: [(d) => d], responseType: 'text' });
    const Obj = JSON.parse(r.data);
    const abc = str(Obj.rate);
    return res.json(abc);
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'BitcoinRate', req);
    // PORT-NOTE: legacy serialised the Exception object itself; the message is returned instead.
    return res.json({ Message: ExpObj.message });
  }
}));

// public non-action helpers of the legacy controller (public methods returning List<T>) - exposed as JSON
// auth
router.all(`${P}/AllIncomeForDashBoard{/:id}`, auth, asyncHandler(async (req, res) => { res.json(await AllIncomeForDashBoard(req)); }));
// auth
router.all(`${P}/ReferalLinks{/:id}`, auth, asyncHandler(async (req, res) => { res.json(await ReferalLinks()); }));
// auth
router.all(`${P}/AllSubTitleWithUrl{/:id}`, auth, asyncHandler(async (req, res) => { res.json(await AllSubTitleWithUrl()); }));
// auth
router.all(`${P}/GetRewardFroDashBoard{/:id}`, auth, asyncHandler(async (req, res) => {
  const rw = await GetRewardFroDashBoard(req);
  res.json(rw.redirect ? { redirect: rw.redirect } : rw.rows);
}));

module.exports = router;
