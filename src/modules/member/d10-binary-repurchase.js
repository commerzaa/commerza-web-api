'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/D10_Binary_Repurchase.cs (D10_Binary_RepurchaseController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');

const router = express.Router();
const DB = 'affiliate';

const INCOME_PROPS = ['TOTALINCOME', 'AvailableCoinWallet', 'AvailableCommissionWallet', 'ReferralIncome', 'LEVELINCOME', 'GrowthReferralIncome', 'ROI_GROWTHLEVEL', 'ROI',
  'DepositedATC', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALDIRECTINCOME', 'Available_Fund', 'CURRENTINCOME', 'WITHDRAWALAMOUNT', 'NetCommissionWallet', 'TLBV', 'TRBV',
  'TotalAvailableShoppingPoints'];
const LINKS_PROPS = ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active'];
const SUBMENU_PROPS = ['SID', 'TITLE', 'HERF', 'Dashboardshotcut'];
const REWARDS_PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS', 'ACHIVED', 'REQUIRED', 'MATCHED'];
const GROWTH_PROPS = ['REGNO', 'INVEST_AMOUNT', 'MAXRETURN', 'CURRENTRETURN'];
const SPONSER_PROPS = ['Name', 'UserName', 'Mobile', 'EmailID'];
const SUBSCRIPTION_PROPS = ['PuchaseDate', 'AllPackageName', 'TotalPaidForATCININR'];
const FUND_PROPS = ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance'];
const DOWNLINE_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV',
  'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName'];
const NEWS_PROPS = ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename'];
const VISITOR_PROPS = ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth'];
const GETALLINCOME_PROPS = ['TITLE', 'IncomeColor', 'MenuID'];
const BINARY_PAYOUT_PROPS = ['REGNO', 'BINARYINCOME', 'PAYDATE'];
const PERFORMANCE_PROPS = ['REGNO', 'CFL', 'CFR', 'PAIDPAIR', 'PPV', 'TLPV', 'PAIDPV', 'FLUSHPV', 'CLPV', 'CRPV', 'PBV', 'TLBV', 'TRBV', 'PAIDBV', 'FLUSHBV', 'CLBV', 'CRBV',
  'DIRECTINCOME', 'PAIRINCOME', 'LEVELINCOME', 'CRAMOUNT', 'DRAMOUNT', 'TDS', 'ADMINCHARGE', 'WITHDRAWALAMOUNT', 'EPINGENERATE', 'FRANCHISEREFINCOME', 'FULSHPAIRS', 'TOTALINCOME',
  'CURRENTINCOME', 'CAPPINGLIMIT', 'FIRTPAIRSIDE', 'ACITVE', 'LOGINID', 'GIVEBV', 'PDAP', 'TOTAL_AGENCY', 'CURRENT_AGENCY', 'ISAGENCYACTIVE', 'GPV', 'CGPV', 'CPPV', 'PGBV', 'LISID',
  'ROI', 'TEMPROI', 'RedeemedPoints', 'TASKLEVELINCOME', 'ReferralIncome', 'GrowthReferralIncome', 'DepositedATC', 'ROI_GROWTHLEVEL', 'HOLDREFERRALADMINCHARGE',
  'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALADMINCHARGE', 'HOLDGROWTHREFERRALDIRECTINCOME', 'TotalAvailableShoppingPoints', 'Available_Fund', 'CREDITED_FUND', 'USED_FUND',
  'AVAILABLE_FUND', 'NetCoinWallet', 'BinaryLevelIncome', 'Used_Coin_Wallet', 'HOLDLEVELADMINCHARGE', 'HOLDLEVELINCOME', 'HOLDGROWTHLEVELADMINCHARGE', 'HOLDGROWTHLEVELINCOME',
  'AvailableCommissionWallet', 'AvailableCoinWallet', 'RollupIncome', 'STP', 'Credited_BTC', 'Used_BTC', 'Available_BTC', 'TotalDepositedBTCInBTCWalletNew'];

const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');
const npe = () => new Error('Object reference not set to an instance of an object.');
const first = (rows) => { const f = rows[0]; return f ? f[Object.keys(f)[0]] : null; }; // SqlQuery<scalar>().FirstOrDefault()
const REDIRECT = Symbol('page-not-found');

async function logErr(req, procName, e) {
  try { await new DataUtility().ErrorInsert(0, e.message, procName, 0, legacyPath(req)); } catch (x) { console.error(x); }
}

// ---- helper actions (public methods of the controller) -------------------------------------------------------------
async function AllIncomeForDashBoard(req) {
  const Plid = Number(req.user.plid);
  return mapRows(await db.proc(DB, 'usp_allincome_report', { regno: Plid }), INCOME_PROPS);
}
async function ReferalLinks() {
  return mapRows(await db.proc(DB, 'usp_referal_link', {}), LINKS_PROPS);
}
async function AllSubTitleWithUrl() {
  return mapRows(await db.proc(DB, 'usp_allsubmenu_titlewith_url', {}), SUBMENU_PROPS);
}
/** Throws REDIRECT (legacy: Response.Redirect("/page-not-found") inside the catch) after logging. */
async function GetRewardFroDashBoard(req) {
  try {
    // PORT-NOTE: @TOTALCOUNT OUT param is returned as a column of the result row (unused by the legacy code).
    return mapRows(await db.proc(DB, 'usp_getewallet_rewards', {}), REWARDS_PROPS);
  } catch (ExpObj) {
    await logErr(req, 'GetRewardFroDashBoard', ExpObj);
    throw REDIRECT;
  }
}

// auth
// route-config: "referral/hRI6rZup2MQiTuElyB5rc7aCTshNao3x" -> D10_Binary_Repurchase/Index
router.all(['/member/D10_Binary_Repurchase/Index{/:id}', '/member/referral/hRI6rZup2MQiTuElyB5rc7aCTshNao3x'], auth, asyncHandler(async (req, res) => {
  let PROCEDURENAME = '';
  const ViewBag = {};
  const VIEW = '~/Views/CustomerPanel/D10_Binary_Repurchase/Index.cshtml';
  try {
    const fav = sessionStore.get(req, 'FavoriteURL');
    if (fav !== undefined && fav !== null) return res.json({ redirect: String(fav) });

    // Auto approval of BTC/ETH/LTC/XRP/BCH etc. for e-wallet topup (background thread in legacy)
    const RegNoBg = Number(req.user.plid);
    Promise.resolve().then(() => CoinPaymentAPI.PaymentAutoClearification(RegNoBg)).catch((e) => console.error('PaymentAutoClearification', e));

    ViewBag.AllincomeForDashboard = await AllIncomeForDashBoard(req);
    ViewBag.links = await ReferalLinks();
    ViewBag.AllSubTitleRecord = await AllSubTitleWithUrl();
    ViewBag.TotalReward = await GetRewardFroDashBoard(req);

    const Plid = Number(req.user.plid);
    let loginid = '';
    const row = await db.queryOne(DB, 'select username from member_master where regno = @plid limit 1', { plid: Plid });
    if (row !== null) loginid = row.username;

    PROCEDURENAME = 'USP_GROWTH_ROICHART';
    // PORT-NOTE: legacy passed only the OUT params (@TOTALCOUNT, @RESULT); they are returned as columns of the result row.
    const growthRows = await db.proc(DB, 'usp_growth_roichart', {});
    const GrowthMaster = mapRows(growthRows, GROWTH_PROPS);
    const tcv = col(growthRows[0], 'totalcount');
    ViewBag.PackageCount = tcv === null ? 0 : parseInt(tcv, 10);
    const PercentArray = [];
    for (let i = 0; i < GrowthMaster.length; i++) {
      const maxr = Number(GrowthMaster[i].MAXRETURN);
      if (maxr === 0) throw new Error('Attempted to divide by zero.');
      const Percentage = (Number(GrowthMaster[i].CURRENTRETURN) * 100) / maxr;
      PercentArray[i] = Number(Percentage.toFixed(2));
    }
    ViewBag.Growthincome = GrowthMaster;
    ViewBag.TotalGrowthPercentage = PercentArray;

    const sa = first(await db.query(DB, 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid = 4 limit 1', {}));
    ViewBag.Sideactive = sa === null ? 0 : Number(sa);

    const mi = await db.scalar(DB, 'select coalesce(sum(coalesce(totalpayableamount, 0)), 0) as totalpayableamount from tbl_allsubscriptionmaster where isordercanceled::int = 0 and regno = @regno', { regno: String(Plid) });
    ViewBag.MakeInvesMentAmt = mi === null ? 0 : mi;

    const avalfund = await db.scalar(DB, "select coalesce(title, '') from tbl_mainmenu_memberpanel where mid = 2 limit 1", {});
    if (avalfund !== null) ViewBag.avalfund = avalfund;
    const currentfund = await db.scalar(DB, "select coalesce(title, '') from tbl_mainmenu_memberpanel where mid = 3 limit 1", {});
    if (currentfund !== null) ViewBag.currentfund = currentfund;

    ViewBag.WalletPoint = '0.00';
    ViewBag.membernews = mapRows(await db.query(DB, 'select * from tbl_news where status::int = 1 and type = @type order by "date" desc limit 5', { type: 'Member' }), NEWS_PROPS);

    const GalleryImages = await db.queryOne(DB, 'select name, title from tbl_flyermanagement where status::int = 1 and isactive::int = 1 and contenttype::int = 2 limit 1', {});
    if (GalleryImages !== null) {
      ViewBag.FlayerImages = String(GalleryImages.name);
      ViewBag.ImageTitle = String(GalleryImages.title);
    }

    const inr = await db.scalar(DB, 'select inr from tbl_atc_inr_ratio_master limit 1', {});
    ViewBag.INR = inr === null ? 0 : inr;

    PROCEDURENAME = 'USP_SPONSERANDACHIVELEVEL';
    const ObjSponser = mapRows(await db.proc(DB, 'usp_sponserandachivelevel', { plid: Plid }), SPONSER_PROPS);

    PROCEDURENAME = 'USP_SubScriptionDetails';
    const SubscriptionDetails = mapRows(await db.proc(DB, 'usp_subscriptiondetails', { plid: Plid }), SUBSCRIPTION_PROPS);
    ViewBag.SubscriptionList = SubscriptionDetails;
    ViewBag.SubscriptionListcount = SubscriptionDetails.length;

    PROCEDURENAME = 'USP_FUND_HISTORYGet_Top5Record';
    const WalletStateMent = mapRows(await db.proc(DB, 'usp_fund_historyget_top5record', { plid: Plid }), FUND_PROPS);
    ViewBag.fundHistory = WalletStateMent;
    ViewBag.WalletStateMentcount = WalletStateMent.length;

    PROCEDURENAME = 'USP_GetSubMenuTittle';
    const GetTittleOfSubmenu = mapRows(await db.proc(DB, 'usp_getsubmenutittle', { sid: 43 }), SUBMENU_PROPS);
    if (GetTittleOfSubmenu.length === 0) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
    ViewBag.GrowthBonus = String(GetTittleOfSubmenu[0].TITLE);
    const Url = String(GetTittleOfSubmenu[0].HERF);
    const url = Url.split('/');
    if (url.length < 3) throw new Error('Index was outside the bounds of the array.');
    ViewBag.Url = String(url[2]);

    PROCEDURENAME = 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5';
    const AllDownlineMemberLeftRightTop5 = mapRows(await db.proc(DB, 'usp_new_member_get_member_downlinelist_side_wise_top5', { loginid }), DOWNLINE_PROPS);
    ViewBag.DownLineList = AllDownlineMemberLeftRightTop5;
    ViewBag.NoofDownLineList = AllDownlineMemberLeftRightTop5.length;
    ViewBag.ATCCoinRate = '0.00000000';
    // (ATCUserId / Atc_WalletAddress are empty strings in legacy, so ATCCoin is always the same value)
    ViewBag.ATCCoin = '0.00000000';

    const loginids = await db.scalar(DB, 'select loginid from member_master where username = @username limit 1', { username: loginid });
    const TotalDirectReferral = await db.scalar(DB, 'select coalesce(count(1), 0) as totaldirectreferral from fun_all_downline_memberlist(@lid, 0) where sponserid = @lid', { lid: loginids });
    const TotalDownline = await db.scalar(DB, 'select coalesce(count(1), 0) as totaldownline from fun_all_downline_memberlist_binary(@lid, 0)', { lid: loginids });
    ViewBag.TotalDirectReferral = Number(TotalDirectReferral || 0);
    ViewBag.TotalDownline = Number(TotalDownline || 0);

    PROCEDURENAME = 'Usp_ManageReferal';
    await db.proc(DB, 'usp_managereferal', { plid: Math.trunc(Number(req.user.plid)) }); // result (ObjLanding) unused in legacy
    const rows = await db.queryOne(DB, 'select defaultlandingurl from portal_login where plid = @plid limit 1', { plid: Plid });
    if (row === null) throw npe(); // row.USERNAME
    const UserName = row.username;
    ViewBag.ReferralID = row.username;
    if (rows === null) throw npe(); // rows.DefaultLandingUrl
    let RLID = 0;
    if (Number(rows.defaultlandingurl) === 0) RLID = 0; else RLID = Number(rows.defaultlandingurl);
    const row1 = await db.queryOne(DB, 'select url from referral_link where rlid = @rlid limit 1', { rlid: RLID });
    if (row1 !== null) {
      ViewBag.DefaultUrl = String(row1.url).replace(/\/+$/, '') + '/' + UserName;
    }
    return res.json({ view: VIEW, Model: ObjSponser, ViewBag });
  } catch (Obj) {
    if (Obj === REDIRECT) {
      // GetRewardFroDashBoard did Response.Redirect("/page-not-found"); the outer catch only logged before the abort completed
      await logErr(req, PROCEDURENAME, new Error('Thread was being aborted.'));
      return res.json({ redirect: '/page-not-found' });
    }
    ViewBag.ErrorMessage = Obj.message;
    await logErr(req, PROCEDURENAME, Obj);
    return res.json({ view: VIEW, ViewBag });
  }
}));

// auth
router.all('/member/D10_Binary_Repurchase/DefaultSponserSide{/:id}', auth, asyncHandler(async (req, res) => {
  const side = req.p.side;
  const plid = Math.trunc(Number(req.user.plid));
  let Regno = 0;
  const Member_Master = require('../../lib/member/Member_Master');
  const member_details = await new Member_Master().Get_member_details(plid);
  if (member_details) Regno = Number(member_details.REGNO !== undefined ? member_details.REGNO : member_details.regno);
  // PORT-NOTE: legacy concatenated `side` into the SQL text; it is bound as a parameter here.
  await db.exec(DB, 'update member_master set defaultsponserside = @side where regno = @regno', { side, regno: Regno });
  const Ret = await db.exec(DB, 'update portal_login set communityside = @side where plid = @plid', { side, plid });
  res.json(Ret);
}));

// auth
router.all('/member/D10_Binary_Repurchase/Visitor_statatics_data{/:id}', auth, asyncHandler(async (req, res) => {
  let VisitorStatics = [];
  try {
    const Plidd = Number(req.user.plid);
    VisitorStatics = mapRows(await db.proc(DB, 'usp_visitor_statics', { plid: Plidd }), VISITOR_PROPS);
    return res.json(VisitorStatics);
  } catch (ExpObj) {
    await logErr(req, 'USP_Visitor_Statics', ExpObj);
    return res.json(VisitorStatics);
  }
}));

// auth
router.all('/member/D10_Binary_Repurchase/GetAllIncome{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  res.json(mapRows(await db.proc(DB, 'usp_allincome_report', { regno: Plid }), INCOME_PROPS));
}));

// auth
router.all('/member/D10_Binary_Repurchase/GetAllIncomeForChart{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const GetAllIncome = await db.queryOne(DB, 'select * from member_performance where regno = @regno limit 1', { regno: Plid });
  res.json(GetAllIncome === null ? null : mapRow(GetAllIncome, PERFORMANCE_PROPS));
}));

// auth
router.all('/member/D10_Binary_Repurchase/GetTdsIncom{/:id}', auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await db.proc(DB, 'usp_getallincom', {}), GETALLINCOME_PROPS));
}));

// auth
router.all('/member/D10_Binary_Repurchase/GetBinaryIncomeByRegNo{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  res.json(mapRows(await db.proc(DB, 'usp_getmonthlybinaryincomebyregno', { regno: Plid }), BINARY_PAYOUT_PROPS));
}));

// auth (member dashboard widget)
router.all('/member/D10_Binary_Repurchase/BitcoinRate{/:id}', auth, asyncHandler(async (req, res) => {
  const CurrencySymbol = config.app.CurrencySymbol || '';
  try {
    const UrlForHit = 'https://bitpay.com/api/rates/' + CurrencySymbol;
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (d) => d });
    const ObjATCRateManagement = JSON.parse(r.data);
    if (ObjATCRateManagement.rate === undefined || ObjATCRateManagement.rate === null) throw npe();
    return res.json(String(ObjATCRateManagement.rate));
  } catch (ExpObj) {
    await logErr(req, 'BitcoinRate', ExpObj);
    // PORT-NOTE: legacy returned Json(<Exception object>) (not serialisable by JavaScriptSerializer); the error message is returned instead.
    return res.json({ Message: ExpObj.message });
  }
}));

// auth (public helper methods of the legacy controller: MVC exposed them as actions)
router.all('/member/D10_Binary_Repurchase/AllIncomeForDashBoard{/:id}', auth, asyncHandler(async (req, res) => { res.json(await AllIncomeForDashBoard(req)); }));
router.all('/member/D10_Binary_Repurchase/ReferalLinks{/:id}', auth, asyncHandler(async (req, res) => { res.json(await ReferalLinks()); }));
router.all('/member/D10_Binary_Repurchase/AllSubTitleWithUrl{/:id}', auth, asyncHandler(async (req, res) => { res.json(await AllSubTitleWithUrl()); }));
router.all('/member/D10_Binary_Repurchase/GetRewardFroDashBoard{/:id}', auth, asyncHandler(async (req, res) => {
  try { res.json(await GetRewardFroDashBoard(req)); } catch (e) { if (e === REDIRECT) return res.json({ redirect: '/page-not-found' }); throw e; }
}));

module.exports = router;
