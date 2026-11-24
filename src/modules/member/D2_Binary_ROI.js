'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/D2_Binary_ROI.cs (D2_Binary_ROIController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const C = 'D2_Binary_ROI';

// ---- helpers ------------------------------------------------------------------------------------------
class RedirectSignal extends Error { constructor(to) { super('redirect'); this.redirect = to; } }
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const colOf = (rows, n) => {
  const r = rows && rows[0];
  if (!r) return null;
  const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase());
  return k === undefined ? null : r[k];
};
const totalOf = (rows, n = 'totalcount') => Number(colOf(rows, n) || 0);
const two = (n) => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);

// ---- C# model property lists (restore legacy PascalCase keys) ----------------------------------------
const P_GROWTH = ['REGNO', 'INVEST_AMOUNT', 'MAXRETURN', 'RETURNPER', 'CURRENTRETURN'];
const P_SPONSER = ['Name', 'UserName', 'Mobile', 'EmailID'];
const P_SUBSCRIPTION = ['PuchaseDate', 'AllPackageName', 'TotalPaidForATCININR'];
const P_WALLET5 = ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance'];
const P_TITLE = ['SID', 'TITLE', 'HERF', 'Dashboardshotcut'];
const P_DOWN5 = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV',
  'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName'];
const P_VISITOR = ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth'];
const P_INCOME = ['TOTALINCOME', 'AvailableCoinWallet', 'AvailableCommissionWallet', 'ReferralIncome', 'LEVELINCOME', 'GrowthReferralIncome', 'ROI_GROWTHLEVEL', 'ROI', 'DepositedATC',
  'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALDIRECTINCOME', 'Available_Fund', 'CURRENTINCOME', 'WITHDRAWALAMOUNT', 'NetCommissionWallet', 'TLBV', 'TRBV', 'TotalAvailableShoppingPoints'];
const P_GETALLINCOME = ['TITLE', 'IncomeColor', 'MenuID'];
const P_BINARY = ['REGNO', 'BINARYINCOME', 'PAYDATE'];
const P_REFLINKS = ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active'];
const P_REWARDS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS', 'ACHIVED', 'REQUIRED', 'MATCHED'];
const P_NEWS = ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename'];
const P_PERF = ['REGNO', 'CFL', 'CFR', 'PAIDPAIR', 'PPV', 'TLPV', 'PAIDPV', 'FLUSHPV', 'CLPV', 'CRPV', 'PBV', 'TLBV', 'TRBV', 'PAIDBV', 'FLUSHBV', 'CLBV', 'CRBV', 'DIRECTINCOME', 'PAIRINCOME',
  'LEVELINCOME', 'CRAMOUNT', 'DRAMOUNT', 'TDS', 'ADMINCHARGE', 'WITHDRAWALAMOUNT', 'EPINGENERATE', 'FRANCHISEREFINCOME', 'FULSHPAIRS', 'TOTALINCOME', 'CURRENTINCOME', 'CAPPINGLIMIT',
  'FIRTPAIRSIDE', 'ACITVE', 'LOGINID', 'GIVEBV', 'PDAP', 'TOTAL_AGENCY', 'CURRENT_AGENCY', 'ISAGENCYACTIVE', 'GPV', 'CGPV', 'CPPV', 'PGBV', 'LISID', 'ROI', 'TEMPROI', 'RedeemedPoints',
  'TASKLEVELINCOME', 'ReferralIncome', 'GrowthReferralIncome', 'DepositedATC', 'ROI_GROWTHLEVEL', 'HOLDREFERRALADMINCHARGE', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALADMINCHARGE',
  'HOLDGROWTHREFERRALDIRECTINCOME', 'TotalAvailableShoppingPoints', 'Available_Fund', 'CREDITED_FUND', 'USED_FUND', 'AVAILABLE_FUND', 'NetCoinWallet', 'BinaryLevelIncome', 'Used_Coin_Wallet',
  'HOLDLEVELADMINCHARGE', 'HOLDLEVELINCOME', 'HOLDGROWTHLEVELADMINCHARGE', 'HOLDGROWTHLEVELINCOME', 'AvailableCommissionWallet', 'AvailableCoinWallet', 'RollupIncome'];

// ---- public (non-view) helper methods of the controller (also routed, like MVC does) ----------------------
async function AllIncomeForDashBoard(plid) {
  return mapRows(await proc(DB, 'usp_allincome_report', { regno: plid }), P_INCOME);
}
async function ReferalLinks() {
  return mapRows(await proc(DB, 'usp_referal_link', {}), P_REFLINKS);
}
async function AllSubTitleWithUrl() {
  return mapRows(await proc(DB, 'usp_allsubmenu_titlewith_url', {}), P_TITLE);
}
async function GetRewardFroDashBoard(req) {
  let GetEwalletReward = [];
  try {
    // PORT-NOTE: @TOTALCOUNT OUT (unused by the legacy code apart from parsing) is a result column
    GetEwalletReward = mapRows(await proc(DB, 'usp_getewallet_rewards', {}), P_REWARDS);
  } catch (ex) {
    await errIns(req, ex, 'USP_GETEWALLET_REWARDS');
    throw new RedirectSignal('/page-not-found');
  }
  return GetEwalletReward;
}

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`], auth, indexHandler());
// route-config (D2BinaryROI)
router.all('/member/referral/CWkW6MF47XAK0Z6StkJupw==', auth, indexHandler());

function indexHandler() {
  return asyncHandler(async (req, res) => {
    let PROCEDURENAME = '';
    // legacy: page / ActivationStatus parameters default to 0 and are only used by commented-out code
    const ViewBag = {};
    try {
      const FavoriteURL = sessionStore.get(req, 'FavoriteURL');
      if (FavoriteURL != null) throw new RedirectSignal(String(FavoriteURL));

      // Auto approval of BTC/ETH/LTC/XRP/BCH etc for E-Wallet topup (fire and forget thread)
      Promise.resolve().then(() => CoinPaymentAPI.PaymentAutoClearification(Number(req.user.plid))).catch(() => {});

      ViewBag.AllincomeForDashboard = await AllIncomeForDashBoard(Number(req.user.plid));
      ViewBag.links = await ReferalLinks();
      ViewBag.AllSubTitleRecord = await AllSubTitleWithUrl();
      ViewBag.TotalReward = await GetRewardFroDashBoard(req);

      const Plid = Number(req.user.plid);
      let loginid = '';
      const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
      if (row) loginid = row.username;

      PROCEDURENAME = 'USP_GROWTH_ROICHART';
      const growthRaw = await proc(DB, 'usp_growth_roichart', { plid: Plid });
      const GrowthMaster = mapRows(growthRaw, P_GROWTH);
      // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when no rows)
      const Totalcount = totalOf(growthRaw);
      ViewBag.PackageCount = Totalcount;
      const PercentArray = new Array(GrowthMaster.length).fill(0);
      if (Totalcount > 0) {
        if (Number(GrowthMaster[0].MAXRETURN) > 0) {
          for (let i = 0; i < GrowthMaster.length; i++) {
            PercentArray[i] = Number(two((Number(GrowthMaster[i].CURRENTRETURN) * 100) / Number(GrowthMaster[i].MAXRETURN)));
          }
        }
      }
      ViewBag.Growthincomed2 = GrowthMaster;
      ViewBag.TotalGrowthPercentaged2 = PercentArray;

      const Sideactive = await scalar(DB, 'SELECT showactive FROM tbl_detailspagemasterforregistration WHERE tdpmfrid=4 limit 1');
      ViewBag.Sideactive = Sideactive === null ? 0 : Sideactive;

      const MakeInvesMentAmt = await scalar(DB, 'select coalesce(sum(coalesce(totalpayableamount,0)),0) as totalpayableamount from tbl_allsubscriptionmaster where isordercanceled::int=0 and regno=@plid', { plid: Plid });
      ViewBag.MakeInvesMentAmt = MakeInvesMentAmt === null ? 0 : MakeInvesMentAmt;
      const avalfund = await scalar(DB, "SELECT coalesce(title,'') FROM tbl_mainmenu_memberpanel WHERE mid=2 limit 1");
      if (avalfund !== null) ViewBag.avalfund = avalfund;
      const currentfund = await scalar(DB, "SELECT coalesce(title,'') FROM tbl_mainmenu_memberpanel WHERE mid=3 limit 1");
      if (currentfund !== null) ViewBag.currentfund = currentfund;

      ViewBag.WalletPoint = '0.00';
      ViewBag.membernews = mapRows(await query(DB, "select * from tbl_news where status=1 and type='Member' order by date desc limit 5"), P_NEWS);

      const GalleryImages = await queryOne(DB, 'select * from tbl_flyermanagement where status=1 and isactive=1 and contenttype=2 limit 1');
      if (GalleryImages) {
        ViewBag.FlayerImages = String(GalleryImages.name);
        ViewBag.ImageTitle = String(GalleryImages.title);
        ViewBag.Type = String(GalleryImages.type);
      }

      let perentage = 0;
      const growth = await queryOne(DB, 'select * from tbl_growthmaster where regno=@plid limit 1', { plid: Plid });
      if (growth) {
        if (Number(growth.maxreturn) !== 0 && Number(growth.currentreturn) !== 0) {
          perentage = (Number(growth.currentreturn) * 100) / Number(growth.maxreturn);
        } else perentage = 0;
      }
      ViewBag.GraphPercentage = two(perentage);

      const AtcINR = await scalar(DB, 'select inr from tbl_atc_inr_ratio_master limit 1');
      ViewBag.INR = AtcINR === null ? 0 : AtcINR;

      PROCEDURENAME = 'USP_SPONSERANDACHIVELEVEL';
      const ObjSponser = mapRows(await proc(DB, 'usp_sponserandachivelevel', { plid: Plid }), P_SPONSER);

      PROCEDURENAME = 'USP_SubScriptionDetails';
      const SubscriptionDetails = mapRows(await proc(DB, 'usp_subscriptiondetails', { plid: Plid }), P_SUBSCRIPTION);
      ViewBag.SubscriptionList = SubscriptionDetails;
      ViewBag.SubscriptionListcount = SubscriptionDetails.length;

      PROCEDURENAME = 'USP_FUND_HISTORYGet_Top5Record';
      const WalletStateMent = mapRows(await proc(DB, 'usp_fund_historyget_top5record', { plid: Plid }), P_WALLET5);
      ViewBag.fundHistory = WalletStateMent;
      ViewBag.WalletStateMentcount = WalletStateMent.length;

      PROCEDURENAME = 'USP_GetSubMenuTittle';
      const GetTittleOfSubmenu = mapRows(await proc(DB, 'usp_getsubmenutittle', { sid: 43 }), P_TITLE);
      ViewBag.GrowthBonus = String(GetTittleOfSubmenu[0].TITLE);
      const Url = String(GetTittleOfSubmenu[0].HERF);
      const url = Url.split('/');
      ViewBag.Url = String(url[2]);

      PROCEDURENAME = 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5';
      const AllDownlineMemberLeftRightTop5 = mapRows(await proc(DB, 'usp_new_member_get_member_downlinelist_side_wise_top5', { loginid }), P_DOWN5);
      ViewBag.DownLineList = AllDownlineMemberLeftRightTop5;
      ViewBag.NoofDownLineList = AllDownlineMemberLeftRightTop5.length;
      ViewBag.ATCCoinRate = '0.00000000';

      ViewBag.ATCCoin = '0.00000000';

      const loginids = await scalar(DB, 'SELECT loginid FROM member_master WHERE username=@loginid limit 1', { loginid });
      const TotalDirectReferral = await scalar(DB, 'SELECT coalesce(count(1),0) as totaldirectreferral FROM fun_all_downline_memberlist(@lid,0) where sponserid=@lid', { lid: loginids });
      const TotalDownline = await scalar(DB, 'select coalesce(count(1),0) as totaldownline from fun_all_downline_memberlist_binary(@lid,0)', { lid: loginids });
      if (TotalDirectReferral !== null) ViewBag.TotalDirectReferral = Number(TotalDirectReferral);
      if (TotalDownline !== null) ViewBag.TotalDownline = Number(TotalDownline);

      PROCEDURENAME = 'Usp_ManageReferal';
      await proc(DB, 'usp_managereferal', { plid: Math.trunc(Plid) });
      const rows = await queryOne(DB, 'select * from portal_login where plid=@plid limit 1', { plid: Plid });
      const UserName = row.username;
      ViewBag.ReferralID = row.username;
      let RLID = 0;
      if (Number(rows.defaultlandingurl) === 0) RLID = 0; else RLID = Number(rows.defaultlandingurl);
      const row1 = await queryOne(DB, 'select * from referral_link where rlid=@rlid limit 1', { rlid: RLID });
      if (row1) ViewBag.DefaultUrl = String(row1.url).replace(/\/+$/, '') + '/' + UserName;

      return res.json({ Model: ObjSponser, ViewBag });
    } catch (Obj) {
      if (Obj instanceof RedirectSignal) return res.json({ redirect: Obj.redirect });
      ViewBag.ErrorMessage = Obj.message;
      await errIns(req, Obj, PROCEDURENAME);
      return res.json({ Model: null, ViewBag });
    }
  });
}

// ---- DefaultSponserSide ----------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/DefaultSponserSide{/:id}`, auth, asyncHandler(async (req, res) => {
  const { side } = req.p;
  let Regno = 0; let plid = 0;
  if (req.user) {
    plid = Number(req.user.plid);
    const member_details = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid });
    if (member_details) Regno = Number(member_details.regno);
  }
  await exec(DB, 'update member_master set defaultsponserside=@side::int where regno=@regno', { side, regno: Regno });
  const Ret = await exec(DB, 'update portal_login set communityside=@side::int where plid=@plid', { side, plid });
  res.json(Ret);
}));

// ---- Visitor_statatics_data -------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/Visitor_statatics_data{/:id}`, auth, asyncHandler(async (req, res) => {
  let VisitorStatics = [];
  try {
    VisitorStatics = mapRows(await proc(DB, 'usp_visitor_statics', { plid: Number(req.user.plid) }), P_VISITOR);
    return res.json(VisitorStatics);
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'USP_Visitor_Statics');
    return res.json(VisitorStatics);
  }
}));

// ---- GetAllIncome -----------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/GetAllIncome{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await AllIncomeForDashBoard(Number(req.user.plid)));
}));

// ---- GetAllIncomeForChart ---------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/GetAllIncomeForChart{/:id}`, auth, asyncHandler(async (req, res) => {
  const r = await queryOne(DB, 'select * from member_performance where regno=@plid limit 1', { plid: Number(req.user.plid) });
  res.json(mapRow(r, P_PERF));
}));

// ---- GetTdsIncom ------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/GetTdsIncom{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getallincom', {}), P_GETALLINCOME));
}));

// ---- GetBinaryIncomeByRegNo -------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/GetBinaryIncomeByRegNo{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getmonthlybinaryincomebyregno', { regno: Number(req.user.plid) }), P_BINARY));
}));

// ---- BitcoinRate ------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/BitcoinRate{/:id}`, auth, asyncHandler(async (req, res) => {
  const CurrencySymbol = config.app.CurrencySymbol || '';
  try {
    const UrlForHit = 'https://bitpay.com/api/rates/' + CurrencySymbol;
    const r = await axios.get(UrlForHit, { transformResponse: (x) => x });
    const ObjATCRateManagement = JSON.parse(r.data);
    const abc = String(ObjATCRateManagement.rate);
    return res.json(abc);
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'BitcoinRate');
    // PORT-NOTE: legacy serialised the Exception object itself; here its public shape { Message } is returned
    return res.json({ Message: ExpObj.message });
  }
}));

// ---- public non-JsonResult helper methods (MVC treats public methods as actions) ---------------------------
// auth
router.all(`/member/${C}/AllIncomeForDashBoard{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await AllIncomeForDashBoard(Number(req.user.plid)));
}));
// auth
router.all(`/member/${C}/ReferalLinks{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await ReferalLinks());
}));
// auth
router.all(`/member/${C}/AllSubTitleWithUrl{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await AllSubTitleWithUrl());
}));
// auth
router.all(`/member/${C}/GetRewardFroDashBoard{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    res.json(await GetRewardFroDashBoard(req));
  } catch (e) {
    if (e instanceof RedirectSignal) return res.json({ redirect: e.redirect });
    throw e;
  }
}));

module.exports = router;
