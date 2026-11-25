'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/D1_Level_ROI.cs (D1_Level_ROIController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const axios = require('axios');
const { proc, query, queryOne, exec } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');

const router = express.Router();
const DB = 'affiliate';

// Model classes (properties as declared in the C# files)
const INCOME_PROPS = ['TOTALINCOME', 'AvailableCoinWallet', 'AvailableCommissionWallet', 'ReferralIncome', 'LEVELINCOME', 'GrowthReferralIncome', 'ROI_GROWTHLEVEL', 'ROI',
  'DepositedATC', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALDIRECTINCOME', 'Available_Fund'];
const LINK_PROPS = ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active'];
const SUBMENU_PROPS = ['SID', 'TITLE', 'HERF', 'Dashboardshotcut'];
const REWARD_PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS', 'ACHIVED', 'REQUIRED', 'MATCHED'];
const GROWTH_PROPS = ['REGNO', 'INVEST_AMOUNT', 'MAXRETURN', 'CURRENTRETURN'];
const SPONSER_PROPS = ['Name', 'UserName', 'Mobile', 'EmailID'];
const SUBSCRIPTION_PROPS = ['PuchaseDate', 'AllPackageName', 'TotalPaidForATCININR'];
const WALLET_PROPS = ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance'];
const DOWNLINE_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV',
  'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName'];
const NEWS_PROPS = ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename'];
const VISITOR_PROPS = ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth'];
const TDS_PROPS = ['TITLE', 'IncomeColor', 'MenuID'];
const BINARY_PROPS = ['REGNO', 'BINARYINCOME', 'PAYDATE'];
const PERFORMANCE_PROPS = ['REGNO', 'CFL', 'CFR', 'PAIDPAIR', 'PPV', 'TLPV', 'PAIDPV', 'FLUSHPV', 'CLPV', 'CRPV', 'PBV', 'TLBV', 'TRBV', 'PAIDBV', 'FLUSHBV', 'CLBV', 'CRBV',
  'DIRECTINCOME', 'PAIRINCOME', 'LEVELINCOME', 'CRAMOUNT', 'DRAMOUNT', 'TDS', 'ADMINCHARGE', 'WITHDRAWALAMOUNT', 'EPINGENERATE', 'FRANCHISEREFINCOME', 'FULSHPAIRS',
  'TOTALINCOME', 'CURRENTINCOME', 'CAPPINGLIMIT', 'FIRTPAIRSIDE', 'ACITVE', 'LOGINID', 'GIVEBV', 'PDAP', 'TOTAL_AGENCY', 'CURRENT_AGENCY', 'ISAGENCYACTIVE', 'GPV', 'CGPV',
  'CPPV', 'PGBV', 'LISID', 'ROI', 'TEMPROI', 'RedeemedPoints', 'TASKLEVELINCOME', 'ReferralIncome', 'GrowthReferralIncome', 'DepositedATC', 'ROI_GROWTHLEVEL',
  'HOLDREFERRALADMINCHARGE', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALADMINCHARGE', 'HOLDGROWTHREFERRALDIRECTINCOME', 'TotalAvailableShoppingPoints', 'Available_Fund',
  'CREDITED_FUND', 'USED_FUND', 'AVAILABLE_FUND', 'NetCoinWallet', 'BinaryLevelIncome', 'Used_Coin_Wallet', 'HOLDLEVELADMINCHARGE', 'HOLDLEVELINCOME', 'HOLDGROWTHLEVELADMINCHARGE',
  'HOLDGROWTHLEVELINCOME', 'AvailableCommissionWallet', 'AvailableCoinWallet', 'RollupIncome', 'STP', 'Credited_BTC', 'Used_BTC', 'Available_BTC', 'TotalDepositedBTCInBTCWalletNew'];

// Response.Redirect(...) inside a helper: unwinds to the action, which answers with { redirect }
class RedirectSignal extends Error {
  constructor(url) { super(`redirect ${url}`); this.url = url; }
}
async function errInsert(req, e, name) {
  console.error(e);
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (e2) { console.error(e2); }
}
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return null;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : f[k];
};
// Convert.ToInt32(DBNull/null) of an OUT value => treated as 0 here
const outInt = (rows, name) => { const n = parseInt(outOf(rows, name), 10); return Number.isNaN(n) ? 0 : n; };
const dec2 = (n) => Number((Math.round(n * 100 + Number.EPSILON * 100) / 100).toFixed(2)); // Percentage.ToString("0.00")

// ---- helper (public C# methods, also exposed as actions below) -------------------------------------------
async function AllIncomeForDashBoard(req) {
  const Plid = Number(req.user.plid);
  return mapRows(await proc(DB, 'usp_allincome_report', { regno: Plid }), INCOME_PROPS);
}
async function ReferalLinks() {
  return mapRows(await proc(DB, 'usp_referal_link', {}), LINK_PROPS);
}
async function AllSubTitleWithUrl() {
  return mapRows(await proc(DB, 'usp_allsubmenu_titlewith_url', {}), SUBMENU_PROPS);
}
async function GetRewardFroDashBoard(req) {
  let GetEwalletReward = [];
  try {
    // PORT-NOTE: @TOTALCOUNT OUT is read from the first result row (column totalcount); it is not used afterwards.
    GetEwalletReward = mapRows(await proc(DB, 'usp_getewallet_rewards', {}), REWARD_PROPS);
  } catch (e) {
    await errInsert(req, e, 'GetRewardFroDashBoard');
    throw new RedirectSignal('/page-not-found'); // Response.Redirect("/page-not-found")
  }
  return GetEwalletReward;
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/ZjJcCZQxvazNR891Dxl58Q==  (D1_Level_ROI / Index)
// auth
router.all(['/member/D1_Level_ROI/Index{/:id}', '/member/referral/ZjJcCZQxvazNR891Dxl58Q=='], auth, asyncHandler(async (req, res) => {
  let PROCEDURENAME = '';
  const ViewBag = {};
  try {
    const FavoriteURL = sessionStore.get(req, 'FavoriteURL');
    if (FavoriteURL !== undefined && FavoriteURL !== null) {
      return res.json({ redirect: String(FavoriteURL) }); // Response.Redirect(Session["FavoriteURL"])
    }

    // Auto approval of BTC/ETH/LTC/XRP/BCH etc. for E-Wallet topup (legacy: background thread)
    const RegNo = Number(req.user.plid);
    (async () => { try { await CoinPaymentAPI.PaymentAutoClearification(RegNo); } catch (e) { console.error(e); } })();

    ViewBag.AllincomeForDashboard = await AllIncomeForDashBoard(req);
    ViewBag.links = await ReferalLinks();
    ViewBag.AllSubTitleRecord = await AllSubTitleWithUrl();
    ViewBag.TotalReward = await GetRewardFroDashBoard(req);

    const Plid = Number(req.user.plid);
    let loginid = '';
    const row = await queryOne(DB, 'SELECT USERNAME FROM Member_master WHERE REGNO = @Plid LIMIT 1', { Plid });
    if (row) loginid = row.username;

    PROCEDURENAME = 'USP_GROWTH_ROICHART';
    const gm = await proc(DB, 'usp_growth_roichart', { plid: Plid }); // PORT-NOTE: @TOTALCOUNT / @RESULT OUT params are read from the first result row.
    const GrowthMaster = mapRows(gm, GROWTH_PROPS);
    const Totalcount = outInt(gm, 'totalcount');
    ViewBag.PackageCount = Totalcount;
    const PercentArray = new Array(GrowthMaster.length).fill(0);
    if (Totalcount > 0) {
      if (Number(GrowthMaster[0].MAXRETURN) > 0) {
        for (let i = 0; i < GrowthMaster.length; i++) {
          if (Number(GrowthMaster[i].MAXRETURN) === 0) throw new Error('Attempted to divide by zero.');
          PercentArray[i] = dec2((Number(GrowthMaster[i].CURRENTRETURN) * 100) / Number(GrowthMaster[i].MAXRETURN));
        }
      }
    }
    ViewBag.Growthincome = GrowthMaster;
    ViewBag.TotalGrowthPercentage = PercentArray;

    const Sideactive = await queryOne(DB, 'SELECT SHOWACTIVE::int AS v FROM TBL_DETAILSPAGEMASTERFORREGISTRATION WHERE TDPMFRID=4 LIMIT 1');
    ViewBag.Sideactive = Sideactive ? Number(Sideactive.v) : 0;

    const inv = await queryOne(DB, 'select coalesce(sum(coalesce(TotalPayableAmount,0)),0) as v from Tbl_AllSubscriptionMaster where IsOrderCanceled::int=0 and RegNo=@Plid', { Plid });
    ViewBag.MakeInvesMentAmt = inv ? Number(inv.v) : 0;
    const avalfund = await queryOne(DB, "SELECT coalesce(TITLE,'') AS v FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=2 LIMIT 1");
    if (avalfund) ViewBag.avalfund = avalfund.v;
    const currentfund = await queryOne(DB, "SELECT coalesce(TITLE,'') AS v FROM TBL_MAINMENU_MEMBERPANEL WHERE MID=3 LIMIT 1");
    if (currentfund) ViewBag.currentfund = currentfund.v;

    ViewBag.WalletPoint = '0.00';
    ViewBag.membernews = mapRows(await query(DB, "SELECT * FROM tbl_news WHERE status = 1 AND type = 'Member' ORDER BY date DESC LIMIT 5"), NEWS_PROPS);

    const GalleryImages = await queryOne(DB, 'SELECT Name, Title, Type FROM Tbl_FlyerManagement WHERE Status = 1 AND IsActive = 1 AND ContentType = 2 LIMIT 1');
    if (GalleryImages) {
      ViewBag.FlayerImages = GalleryImages.name.toString();
      ViewBag.ImageTitle = GalleryImages.title.toString();
    }

    const AtcINR = await queryOne(DB, 'SELECT INR FROM Tbl_Atc_INR_Ratio_Master LIMIT 1');
    ViewBag.INR = AtcINR ? Number(AtcINR.inr) : 0;

    PROCEDURENAME = 'USP_SPONSERANDACHIVELEVEL';
    const ObjSponser = mapRows(await proc(DB, 'usp_sponserandachivelevel', { plid: Plid }), SPONSER_PROPS);

    PROCEDURENAME = 'USP_SubScriptionDetails';
    const SubscriptionDetails = mapRows(await proc(DB, 'usp_subscriptiondetails', { plid: Plid }), SUBSCRIPTION_PROPS);
    ViewBag.SubscriptionList = SubscriptionDetails;
    ViewBag.SubscriptionListcount = SubscriptionDetails.length;

    PROCEDURENAME = 'USP_FUND_HISTORYGet_Top5Record';
    const WalletStateMent = mapRows(await proc(DB, 'usp_fund_historyget_top5record', { plid: Plid }), WALLET_PROPS);
    ViewBag.fundHistory = WalletStateMent;
    ViewBag.WalletStateMentcount = WalletStateMent.length;

    PROCEDURENAME = 'USP_GetSubMenuTittle';
    const GetTittleOfSubmenu = mapRows(await proc(DB, 'usp_getsubmenutittle', { sid: 43 }), SUBMENU_PROPS);
    ViewBag.GrowthBonus = GetTittleOfSubmenu[0].TITLE.toString();
    const Url = GetTittleOfSubmenu[0].HERF.toString();
    const url = Url.split('/');
    ViewBag.Url = url[2].toString();

    PROCEDURENAME = 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5';
    const AllDownlineMemberLeftRightTop5 = mapRows(await proc(DB, 'usp_new_member_get_member_downlinelist_side_wise_top5', { loginid }), DOWNLINE_PROPS);
    ViewBag.DownLineList = AllDownlineMemberLeftRightTop5;
    ViewBag.NoofDownLineList = AllDownlineMemberLeftRightTop5.length;
    ViewBag.ATCCoinRate = '0.00000000';

    const ATCUserId = '';
    const Atc_WalletAddress = '';
    if (ATCUserId !== '' && Atc_WalletAddress !== '') {
      ViewBag.ATCCoin = '0.00000000';
    } else {
      ViewBag.ATCCoin = '0.00000000';
    }
    const li = await queryOne(DB, 'SELECT LOGINID FROM MEMBER_MASTER WHERE USERNAME = @loginid LIMIT 1', { loginid });
    const loginids = li ? li.loginid : null;
    const tdr = await queryOne(DB, 'SELECT coalesce(count(1),0) AS v FROM Member_master where SPONSERID=@loginids', { loginids });
    const TotalDirectReferral = tdr ? Number(tdr.v) : 0;
    const tdl = await queryOne(DB, 'select coalesce(count(1),0) as v From FUN_ALL_DOWNLINE_MEMBERLIST_BINARY(@loginids, 0)', { loginids });
    const TotalDownline = tdl ? Number(tdl.v) : 0;
    ViewBag.TotalDirectReferral = TotalDirectReferral;
    ViewBag.TotalDownline = TotalDownline;

    PROCEDURENAME = 'Usp_ManageReferal';
    await proc(DB, 'usp_managereferal', { plid: Math.trunc(Plid) }); // ObjLanding (not used afterwards)
    const rows = await queryOne(DB, 'SELECT DefaultLandingUrl FROM Portal_Login WHERE PLID = @Plid LIMIT 1', { Plid });
    const UserName = row.username; // NullReference when no Member_Master row (caught below)
    ViewBag.ReferralID = row.username;
    let RLID = 0;
    if (rows.defaultlandingurl === 0) {
      RLID = 0;
    } else {
      RLID = rows.defaultlandingurl;
    }
    const row1 = await queryOne(DB, 'SELECT Url FROM Referral_Link WHERE RLID = @RLID LIMIT 1', { RLID });
    if (row1) {
      ViewBag.DefaultUrl = `${row1.url.toString().replace(/\/+$/, '')}/${UserName}`;
    }

    return res.json({ view: '~/Views/CustomerPanel/D1_Level_ROI/Index.cshtml', Model: ObjSponser, ViewBag });
  } catch (ExpObj) {
    if (ExpObj instanceof RedirectSignal) return res.json({ redirect: ExpObj.url });
    ViewBag.ErrorMessage = ExpObj.message;
    await errInsert(req, ExpObj, PROCEDURENAME);
    return res.json({ view: '~/Views/CustomerPanel/D1_Level_ROI/Index.cshtml', ViewBag });
  }
}));

// ---- DefaultSponserSide --------------------------------------------------------------------------------
// auth
router.all('/member/D1_Level_ROI/DefaultSponserSide{/:id}', auth, asyncHandler(async (req, res) => {
  const side = parseInt(req.p.side, 10);
  if (Number.isNaN(side)) throw new Error('Invalid column name.'); // legacy concatenated the raw value into the UPDATE
  const plid = Number(req.user.plid);
  let Regno = 0;
  // member_details.Get_member_details(plid) => Member_Master where REGNO == plid
  const member = await queryOne(DB, 'SELECT REGNO FROM Member_master WHERE REGNO = @plid LIMIT 1', { plid });
  if (member) Regno = Number(member.regno);
  await exec(DB, 'update Member_Master set DefaultSponserSide=@side where regNo=@Regno', { side, Regno });
  const Ret = await exec(DB, 'update Portal_Login Set CommunitySide=@side where plid=@plid', { side, plid });
  return res.json(Ret);
}));

// ---- Visitor_statatics_data ----------------------------------------------------------------------------
// auth
router.all('/member/D1_Level_ROI/Visitor_statatics_data{/:id}', auth, asyncHandler(async (req, res) => {
  let VisitorStatics = [];
  try {
    const Plidd = Number(req.user.plid);
    VisitorStatics = mapRows(await proc(DB, 'usp_visitor_statics', { plid: Plidd }), VISITOR_PROPS);
    return res.json(VisitorStatics);
  } catch (e) {
    await errInsert(req, e, 'Visitor_statatics_data');
    return res.json(VisitorStatics);
  }
}));

// ---- GetAllIncome --------------------------------------------------------------------------------------
// auth
router.all('/member/D1_Level_ROI/GetAllIncome{/:id}', auth, asyncHandler(async (req, res) => {
  return res.json(await AllIncomeForDashBoard(req));
}));

// ---- GetAllIncomeForChart ------------------------------------------------------------------------------
// auth
router.all('/member/D1_Level_ROI/GetAllIncomeForChart{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const r = await queryOne(DB, 'SELECT * FROM MEMBER_PERFORMANCE WHERE REGNO = @Plid LIMIT 1', { Plid });
  return res.json(mapRow(r, PERFORMANCE_PROPS));
}));

// ---- GetTdsIncom ---------------------------------------------------------------------------------------
// public (legacy action has no session check and no user data)
router.all('/member/D1_Level_ROI/GetTdsIncom{/:id}', asyncHandler(async (req, res) => {
  return res.json(mapRows(await proc(DB, 'usp_getallincom', {}), TDS_PROPS));
}));

// ---- GetBinaryIncomeByRegNo ----------------------------------------------------------------------------
// auth
router.all('/member/D1_Level_ROI/GetBinaryIncomeByRegNo{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  return res.json(mapRows(await proc(DB, 'usp_getmonthlybinaryincomebyregno', { regno: Plid }), BINARY_PROPS));
}));

// ---- BitcoinRate ---------------------------------------------------------------------------------------
// public (legacy action has no session check)
router.all('/member/D1_Level_ROI/BitcoinRate{/:id}', asyncHandler(async (req, res) => {
  const CurrencySymbol = config.app.CurrencySymbol;
  try {
    const UrlForHit = `https://bitpay.com/api/rates/${CurrencySymbol}`;
    const r = await axios.get(UrlForHit, { transformResponse: [(d) => d] }); // WebClient.DownloadString
    const ObjATCRateManagement = JSON.parse(r.data);
    const abc = String(ObjATCRateManagement.rate);
    return res.json(abc);
  } catch (ex) {
    await errInsert(req, ex, 'BitcoinRate');
    // PORT-NOTE: Json(Exception) serialised the .NET exception object; the closest equivalent is returned.
    return res.json({ Message: ex.message, StackTrace: ex.stack || null, Source: null, HelpLink: null, InnerException: null });
  }
}));

// ---- AllIncomeForDashBoard (public C# method => MVC action; returned List.ToString() in legacy, here the list as JSON) --
// auth
router.all('/member/D1_Level_ROI/AllIncomeForDashBoard{/:id}', auth, asyncHandler(async (req, res) => {
  return res.json(await AllIncomeForDashBoard(req));
}));

// ---- ReferalLinks (public C# method => MVC action) -----------------------------------------------------
// public (no session use)
router.all('/member/D1_Level_ROI/ReferalLinks{/:id}', asyncHandler(async (req, res) => {
  return res.json(await ReferalLinks());
}));

// ---- AllSubTitleWithUrl (public C# method => MVC action) -----------------------------------------------
// public (no session use)
router.all('/member/D1_Level_ROI/AllSubTitleWithUrl{/:id}', asyncHandler(async (req, res) => {
  return res.json(await AllSubTitleWithUrl());
}));

// ---- GetRewardFroDashBoard (public C# method => MVC action) --------------------------------------------
// public (no session use)
router.all('/member/D1_Level_ROI/GetRewardFroDashBoard{/:id}', asyncHandler(async (req, res) => {
  try {
    return res.json(await GetRewardFroDashBoard(req));
  } catch (e) {
    if (e instanceof RedirectSignal) return res.json({ redirect: e.url });
    throw e;
  }
}));

module.exports = router;
