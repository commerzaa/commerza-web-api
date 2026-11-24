'use strict';
// Port of Member\Common\Controllers\CustomerPanel\D4_Level_ROI_Coin_Binary.cs (D4_Level_ROI_Coin_BinaryController)
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const config = require('../../config');
const DataUtility = require('../../lib/member/DataUtility');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');
const Member_Master = require('../../lib/member/Member_Master');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const errorInsert = async (e, procName, req) => {
  try { await new DataUtility().ErrorInsert(0, e && e.message, procName, 0, req.path); } catch (_) { /* ignore */ }
};
class RedirectSignal extends Error { constructor(url) { super('redirect'); this.url = url; } }

const P = {
  SponserDatails: ['Name', 'UserName', 'Mobile', 'EmailID'],
  SubScriptionDetails: ['PuchaseDate', 'AllPackageName', 'TotalPaidForATCININR'],
  INR_Wallet_StatementTop5: ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance'],
  GetTittleOfSubmenu: ['SID', 'TITLE', 'HERF', 'Dashboardshotcut'],
  AllDownlineMemberLeftRightTop5: ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName'],
  Visitor_Statics: ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth'],
  MemberPerformanceDashboardIncome: ['TOTALINCOME', 'AvailableCoinWallet', 'AvailableCommissionWallet', 'ReferralIncome', 'LEVELINCOME', 'GrowthReferralIncome', 'ROI_GROWTHLEVEL', 'ROI', 'DepositedATC', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALDIRECTINCOME', 'Available_Fund', 'CURRENTINCOME', 'WITHDRAWALAMOUNT', 'NetCommissionWallet', 'TLBV', 'TRBV', 'TotalAvailableShoppingPoints'],
  BinaryIncomePayout: ['REGNO', 'BINARYINCOME', 'PAYDATE'],
  Referral_LinksOnDashboard: ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active'],
  GetEwalletRewards: ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS', 'ACHIVED', 'REQUIRED', 'MATCHED'],
  GrowthMaster: ['REGNO', 'INVEST_AMOUNT', 'MAXRETURN', 'CURRENTRETURN'],
  GetAllIncome: ['TITLE', 'IncomeColor', 'MenuID'],
  MemberPerformance: ['REGNO', 'CFL', 'CFR', 'PAIDPAIR', 'PPV', 'TLPV', 'PAIDPV', 'FLUSHPV', 'CLPV', 'CRPV', 'PBV', 'TLBV', 'TRBV', 'PAIDBV', 'FLUSHBV', 'CLBV', 'CRBV', 'DIRECTINCOME', 'PAIRINCOME', 'LEVELINCOME', 'CRAMOUNT', 'DRAMOUNT', 'TDS', 'ADMINCHARGE', 'WITHDRAWALAMOUNT', 'EPINGENERATE', 'FRANCHISEREFINCOME', 'FULSHPAIRS', 'TOTALINCOME', 'CURRENTINCOME', 'CAPPINGLIMIT', 'FIRTPAIRSIDE', 'ACITVE', 'LOGINID', 'GIVEBV', 'PDAP', 'TOTAL_AGENCY', 'CURRENT_AGENCY', 'ISAGENCYACTIVE', 'GPV', 'CGPV', 'CPPV', 'PGBV', 'LISID', 'ROI', 'TEMPROI', 'RedeemedPoints', 'TASKLEVELINCOME', 'ReferralIncome', 'GrowthReferralIncome', 'DepositedATC', 'ROI_GROWTHLEVEL', 'HOLDREFERRALADMINCHARGE', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALADMINCHARGE', 'HOLDGROWTHREFERRALDIRECTINCOME', 'TotalAvailableShoppingPoints', 'Available_Fund', 'CREDITED_FUND', 'USED_FUND', 'AVAILABLE_FUND', 'NetCoinWallet', 'BinaryLevelIncome', 'Used_Coin_Wallet', 'HOLDLEVELADMINCHARGE', 'HOLDLEVELINCOME', 'HOLDGROWTHLEVELADMINCHARGE', 'HOLDGROWTHLEVELINCOME', 'AvailableCommissionWallet', 'AvailableCoinWallet', 'RollupIncome', 'STP', 'Credited_BTC', 'Used_BTC', 'Available_BTC', 'TotalDepositedBTCInBTCWalletNew'],
};

// ---- non-action helpers (public non-ActionResult methods of the controller) ----
async function AllIncomeForDashBoard(plid) {
  const rows = await db.proc(DB, 'usp_allincome_report', { regno: plid });
  return mapRows(rows, P.MemberPerformanceDashboardIncome);
}
async function ReferalLinks() {
  return mapRows(await db.proc(DB, 'usp_referal_link', {}), P.Referral_LinksOnDashboard);
}
async function AllSubTitleWithUrl() {
  return mapRows(await db.proc(DB, 'usp_allsubmenu_titlewith_url', {}), P.GetTittleOfSubmenu);
}
async function GetRewardFroDashBoard(req) {
  let list = [];
  try {
    const rows = await db.proc(DB, 'usp_getewallet_rewards', {});
    list = mapRows(rows, P.GetEwalletRewards);
  } catch (e) {
    await errorInsert(e, 'USP_GETEWALLET_REWARDS', req);
    throw new RedirectSignal('/page-not-found'); // Response.Redirect("/page-not-found")
  }
  return list;
}

// route-config: referral/IB3q6lm_plus_qQc07OvxG9zn3p0tdFmFv1wUnNhZhGZ0LWE= -> D4_Level_ROI_Coin_Binary/Index
// auth
router.all(['/member/D4_Level_ROI_Coin_Binary/Index{/:id}', '/member/referral/IB3q6lm_plus_qQc07OvxG9zn3p0tdFmFv1wUnNhZhGZ0LWE='], auth, asyncHandler(async (req, res) => {
  let PROCEDURENAME = '';
  const page = req.p.page === undefined || req.p.page === '' ? 0 : parseInt(req.p.page, 10) || 0;
  const ActivationStatus = req.p.ActivationStatus === undefined || req.p.ActivationStatus === '' ? 0 : parseInt(req.p.ActivationStatus, 10) || 0;
  const ViewBag = {};
  try {
    const favUrl = sessionStore.get(req, 'FavoriteURL');
    if (favUrl !== undefined && favUrl !== null) return res.json({ redirect: String(favUrl) });

    const Plid = Number(req.user.plid);
    // Auto approval of BTC/ETH/LTC/XRP/BCH etc. for e-wallet topup (fire and forget background thread)
    Promise.resolve().then(() => CoinPaymentAPI.PaymentAutoClearification(Plid)).catch(() => {});

    ViewBag.AllincomeForDashboard = await AllIncomeForDashBoard(Plid);
    ViewBag.links = await ReferalLinks();
    ViewBag.AllSubTitleRecord = await AllSubTitleWithUrl();
    ViewBag.TotalReward = await GetRewardFroDashBoard(req);

    let loginid = '';
    const row = await db.queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
    if (row !== null) loginid = row.username;

    // USP_GROWTH_ROICHART @TOTALCOUNT OUT, @RESULT OUT
    PROCEDURENAME = 'USP_GROWTH_ROICHART';
    const growthRows = await db.proc(DB, 'usp_growth_roichart', {});
    const GrowthMaster = mapRows(growthRows, P.GrowthMaster);
    const Totalcount = parseInt(String(outv(growthRows, 'totalcount') === null ? 0 : outv(growthRows, 'totalcount')), 10);
    ViewBag.PackageCount = Totalcount;
    const PercentArray = [];
    for (let i = 0; i < GrowthMaster.length; i++) {
      const Percentage = Number(GrowthMaster[i].CURRENTRETURN) * 100 / Number(GrowthMaster[i].MAXRETURN);
      PercentArray[i] = Number(Percentage.toFixed(2));
    }
    ViewBag.Growthincome = GrowthMaster;
    ViewBag.TotalGrowthPercentage = PercentArray;

    const Sideactive = await db.scalar(DB, 'SELECT SHOWACTIVE FROM TBL_DETAILSPAGEMASTERFORREGISTRATION WHERE TDPMFRID=4 limit 1', {});
    ViewBag.Sideactive = Sideactive === null || Sideactive === undefined ? 0 : Sideactive;

    const MakeInvesMentAmt = await db.scalar(DB, 'select coalesce(sum(coalesce(TotalPayableAmount,0)),0) as TotalPayableAmount from Tbl_AllSubscriptionMaster where IsOrderCanceled=0 and RegNo=@plid', { plid: Plid });
    ViewBag.MakeInvesMentAmt = MakeInvesMentAmt === null || MakeInvesMentAmt === undefined ? 0 : MakeInvesMentAmt;
    const avalfund = await db.scalar(DB, "SELECT coalesce(TITLE,'') FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=2 limit 1", {});
    if (avalfund !== null && avalfund !== undefined) ViewBag.avalfund = avalfund;
    const currentfund = await db.scalar(DB, "SELECT coalesce(TITLE,'') FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=3 limit 1", {});
    if (currentfund !== null && currentfund !== undefined) ViewBag.currentfund = currentfund;

    ViewBag.WalletPoint = '0.00';
    ViewBag.membernews = mapRows(await db.query(DB, "select nid,title,type,descriptions,date,status,imagename from eventnews where status=1 and type='Member' order by date desc limit 5", {}), ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename']);

    const GalleryImages = await db.queryOne(DB, 'select * from tbl_flyermanagement where status=1 and isactive=1 and contenttype=2 limit 1', {});
    if (GalleryImages !== null) {
      ViewBag.FlayerImages = String(GalleryImages.name);
      ViewBag.ImageTitle = String(GalleryImages.title);
      ViewBag.Type = String(GalleryImages.type);
    }

    ViewBag.INR = await db.scalar(DB, 'select inr from Tbl_Atc_INR_Ratio_Master limit 1', {});

    PROCEDURENAME = 'USP_SPONSERANDACHIVELEVEL';
    const ObjSponser = mapRows(await db.proc(DB, 'usp_sponserandachivelevel', { plid: Plid }), P.SponserDatails);

    PROCEDURENAME = 'USP_SubScriptionDetails';
    const SubscriptionDetails = mapRows(await db.proc(DB, 'usp_subscriptiondetails', { plid: Plid }), P.SubScriptionDetails);
    ViewBag.SubscriptionList = SubscriptionDetails;
    ViewBag.SubscriptionListcount = SubscriptionDetails.length;

    PROCEDURENAME = 'USP_FUND_HISTORYGet_Top5Record';
    const WalletStateMent = mapRows(await db.proc(DB, 'usp_fund_historyget_top5record', { plid: Plid }), P.INR_Wallet_StatementTop5);
    ViewBag.fundHistory = WalletStateMent;
    ViewBag.WalletStateMentcount = WalletStateMent.length;

    PROCEDURENAME = 'USP_GetSubMenuTittle';
    const GetTittleOfSubmenu = mapRows(await db.proc(DB, 'usp_getsubmenutittle', { sid: 43 }), P.GetTittleOfSubmenu);
    ViewBag.GrowthBonus = String(GetTittleOfSubmenu[0].TITLE);
    const Url = String(GetTittleOfSubmenu[0].HERF);
    const url = Url.split('/');
    ViewBag.Url = String(url[2]);

    PROCEDURENAME = 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5';
    const AllDownlineMemberLeftRightTop5 = mapRows(await db.proc(DB, 'usp_new_member_get_member_downlinelist_side_wise_top5', { loginid }), P.AllDownlineMemberLeftRightTop5);
    ViewBag.DownLineList = AllDownlineMemberLeftRightTop5;
    ViewBag.NoofDownLineList = AllDownlineMemberLeftRightTop5.length;
    ViewBag.ATCCoinRate = '0.00000000';

    ViewBag.ATCCoin = '0.00000000';

    const loginids = await db.scalar(DB, 'SELECT LOGINID FROM MEMBER_MASTER WHERE USERNAME=@u limit 1', { u: loginid });
    const TotalDirectReferral = await db.scalar(DB, 'SELECT coalesce(count(1),0) as TotalDirectReferral FROM FUN_ALL_DOWNLINE_MEMBERLIST(@l,0) where SPONSERID=@l', { l: loginids });
    const TotalDownline = await db.scalar(DB, 'select coalesce(count(1),0) as TotalDownline From FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(@l,0)', { l: loginids });
    ViewBag.TotalDirectReferral = TotalDirectReferral === null ? 0 : TotalDirectReferral;
    ViewBag.TotalDownline = TotalDownline === null ? 0 : TotalDownline;

    PROCEDURENAME = 'Usp_ManageReferal';
    await db.proc(DB, 'usp_managereferal', { plid: Math.trunc(Plid) }); // result list (Landing) is not used by the view
    const rows = await db.queryOne(DB, 'select * from portal_login where plid=@plid limit 1', { plid: Plid });
    const UserName = row.username;
    ViewBag.ReferralID = row.username;
    let RLID = 0;
    if (Number(rows.defaultlandingurl) === 0) RLID = 0; else RLID = rows.defaultlandingurl;
    const row1 = await db.queryOne(DB, 'select * from referral_link where rlid=@r limit 1', { r: RLID });
    if (row1 !== null) ViewBag.DefaultUrl = String(row1.url).replace(/\/+$/, '') + '/' + UserName;

    return res.json({ Model: ObjSponser, ...ViewBag });
  } catch (Obj) {
    if (Obj instanceof RedirectSignal) return res.json({ redirect: Obj.url });
    await errorInsert(Obj, PROCEDURENAME, req);
    return res.json({ ErrorMessage: Obj.message });
  }
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/DefaultSponserSide{/:id}', auth, asyncHandler(async (req, res) => {
  const side = req.p.side;
  const plid = Number(req.user.plid);
  let Regno = 0;
  const member_details = await new Member_Master().Get_member_details(plid);
  if (member_details) Regno = member_details.REGNO;
  await db.exec(DB, 'update Member_Master set DefaultSponserSide=@side where regNo=@regno', { side, regno: Regno });
  const Ret = await db.exec(DB, 'update Portal_Login Set CommunitySide=@side where plid=@plid', { side, plid });
  res.json(Ret);
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/Visitor_statatics_data{/:id}', auth, asyncHandler(async (req, res) => {
  let VisitorStatics = [];
  try {
    const Plidd = Number(req.user.plid);
    VisitorStatics = mapRows(await db.proc(DB, 'usp_visitor_statics', { plid: Plidd }), P.Visitor_Statics);
    return res.json(VisitorStatics);
  } catch (e) {
    await errorInsert(e, 'USP_Visitor_Statics', req);
    return res.json(VisitorStatics);
  }
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/GetAllIncome{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await AllIncomeForDashBoard(Number(req.user.plid)));
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/GetAllIncomeForChart{/:id}', auth, asyncHandler(async (req, res) => {
  const r = await db.queryOne(DB, 'select * from member_performance where regno=@plid limit 1', { plid: Number(req.user.plid) });
  res.json(mapRow(r, P.MemberPerformance));
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/GetTdsIncom{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getallincom', {});
  res.json(mapRows(rows, P.GetAllIncome));
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/GetBinaryIncomeByRegNo{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getmonthlybinaryincomebyregno', { regno: Number(req.user.plid) });
  res.json(mapRows(rows, P.BinaryIncomePayout));
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/BitcoinRate{/:id}', auth, asyncHandler(async (req, res) => {
  const CurrencySymbol = config.app.CurrencySymbol || '';
  try {
    const UrlForHit = 'https://bitpay.com/api/rates/' + CurrencySymbol;
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x });
    const obj = JSON.parse(r.data);
    return res.json(String(obj.rate));
  } catch (e) {
    await errorInsert(e, 'BitcoinRate', req);
    // PORT-NOTE: legacy serialised the Exception object; the message is returned instead.
    return res.json({ Message: e.message });
  }
}));

// auth (public non-ActionResult helper methods of the controller, routable in MVC; result serialised as JSON)
router.all('/member/D4_Level_ROI_Coin_Binary/AllIncomeForDashBoard{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await AllIncomeForDashBoard(Number(req.user.plid)));
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/ReferalLinks{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await ReferalLinks());
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/AllSubTitleWithUrl{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(await AllSubTitleWithUrl());
}));

// auth
router.all('/member/D4_Level_ROI_Coin_Binary/GetRewardFroDashBoard{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    res.json(await GetRewardFroDashBoard(req));
  } catch (e) {
    if (e instanceof RedirectSignal) return res.json({ redirect: e.url });
    throw e;
  }
}));

module.exports = router;
