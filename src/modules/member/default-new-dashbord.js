'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\default_New_Dashbord.cs (default_New_DashbordController)
 *  Non-action helpers (public List<T> methods used only by Index): AllIncomeForDashBoard, ReferalLinks, AllSubTitleWithUrl, GetRewardFroDashBoard
 *  are ported inline as internal functions and are not routed.
 */
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const ATCAPI = require('../../lib/member/ATCAPI');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/default_New_Dashbord';

const GROWTH_PROPS = ['REGNO', 'INVEST_AMOUNT', 'MAXRETURN', 'CURRENTRETURN'];
const SPONSER_PROPS = ['Name', 'UserName', 'Mobile', 'EmailID'];
const SUBSCRIPTION_PROPS = ['PuchaseDate', 'AllPackageName', 'TotalPaidForATCININR'];
const WALLET_TOP5_PROPS = ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance'];
const SUBMENU_PROPS = ['SID', 'TITLE', 'HERF', 'Dashboardshotcut'];
const DOWNLINE_TOP5_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno'];
const INCOME_PROPS = ['TOTALINCOME', 'AvailableCoinWallet', 'AvailableCommissionWallet', 'ReferralIncome', 'LEVELINCOME', 'GrowthReferralIncome', 'ROI_GROWTHLEVEL',
  'ROI', 'DepositedATC', 'HOLDREFERRALDIRECTINCOME', 'HOLDGROWTHREFERRALDIRECTINCOME', 'Available_Fund', 'CURRENTINCOME', 'WITHDRAWALAMOUNT',
  'NetCommissionWallet', 'TLBV', 'TRBV', 'TotalAvailableShoppingPoints'];
const LINK_PROPS = ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active'];
const REWARD_PROPS = ['EWRID', 'FROMBUSINESS', 'TOBUSINESS', 'REWARDSAMOUNT', 'ADMINCHARGE', 'PAYBLEAMOUNT', 'REWARDNAME', 'FROMDATE', 'TODATE', 'STATUS',
  'ACHIVED', 'REQUIRED', 'MATCHED'];
const NEWS_PROPS = ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename'];
const VISITOR_PROPS = ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth'];
const BINARY_INCOME_PROPS = ['REGNO', 'BINARYINCOME', 'PAYDATE'];
const ALLINCOME_PROPS = ['TITLE', 'INCOME', 'COLOR']; // GetAllIncomeFroNewDashBoard

const NPE = () => new Error('Object reference not set to an instance of an object.');
const need = (o) => { if (o === null || o === undefined) throw NPE(); return o; };
const fixed2 = (v) => Number((Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2)); // Decimal.ToString("0.00")
// marker error: Response.Redirect("/page-not-found")
class RedirectError extends Error { constructor(to) { super('redirect'); this.redirect = to; } }

async function AllIncomeForDashBoard(Plid) {
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
    const rows = await proc(DB, 'usp_getewallet_rewards', {});
    GetEwalletReward = mapRows(rows, REWARD_PROPS);
    // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first row (unused afterwards)
  } catch (ExpObj) {
    console.error(ExpObj.message);
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_GETEWALLET_REWARDS', 0, req.path); } catch (e) { console.error(e.message); }
    throw new RedirectError('/page-not-found'); // Response.Redirect("/page-not-found")
  }
  return GetEwalletReward;
}

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/KAeB5n6tXKPue8n2Hy8qtao3KRE0MW9b" -> default_New_Dashbord/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/KAeB5n6tXKPue8n2Hy8qtao3KRE0MW9b'], auth, asyncHandler(async (req, res) => {
  let PROCEDURENAME = '';
  const ViewBag = {};
  try {
    const fav = sessionStore.get(req, 'FavoriteURL');
    if (fav !== undefined && fav !== null) return res.json({ redirect: String(fav) }); // Response.Redirect(Session["FavoriteURL"])

    // Auto approval of BTC for E-Wallet topup (background thread in legacy)
    const RegNo = Math.trunc(Number(req.user.plid));
    Promise.resolve().then(() => ATCAPI.BTCPaymentClearification(RegNo)).catch((e) => console.error(e.message));

    const Plid = Number(req.user.plid);
    ViewBag.AllincomeForDashboard = await AllIncomeForDashBoard(Plid);
    ViewBag.links = await ReferalLinks();
    ViewBag.AllSubTitleRecord = await AllSubTitleWithUrl();
    ViewBag.TotalReward = await GetRewardFroDashBoard(req);

    let loginid = '';
    const row = await queryOne(DB, 'select username from member_master where regno = @plid limit 1', { plid: Plid });
    if (row != null) loginid = row.username;

    PROCEDURENAME = 'USP_GROWTH_ROICHART';
    // @TOTALCOUNT / @RESULT are OUTPUT parameters (read from the first result row)
    const growthRows = await proc(DB, 'usp_growth_roichart', { plid: Number(req.user.plid) }); // Gplid
    const GrowthMaster = mapRows(growthRows, GROWTH_PROPS);
    const Totalcount = growthRows.length && growthRows[0].totalcount !== null && growthRows[0].totalcount !== undefined ? Number(growthRows[0].totalcount) : 0;
    ViewBag.PackageCount = Totalcount;
    const PercentArray = new Array(GrowthMaster.length).fill(0);
    if (Totalcount > 0) {
      if (Number(GrowthMaster[0].MAXRETURN) > 0) {
        for (let i = 0; i < GrowthMaster.length; i++) {
          if (Number(GrowthMaster[i].MAXRETURN) === 0) throw new Error('Attempted to divide by zero.');
          const Percentage = (Number(GrowthMaster[i].CURRENTRETURN) * 100) / Number(GrowthMaster[i].MAXRETURN);
          PercentArray[i] = fixed2(Percentage);
        }
      }
    }
    ViewBag.Growthincome = GrowthMaster;
    ViewBag.TotalGrowthPercentage = PercentArray;

    const sa = await scalar(DB, 'select showactive::int from tbl_detailspagemasterforregistration where tdpmfrid = 4 limit 1', {});
    ViewBag.Sideactive = sa === null || sa === undefined ? 0 : Number(sa);

    const inv = await scalar(DB, 'select coalesce(sum(coalesce(totalpayableamount, 0)), 0) from tbl_allsubscriptionmaster where isordercanceled = 0 and regno = @plid', { plid: Plid });
    ViewBag.MakeInvesMentAmt = inv === null || inv === undefined ? 0 : Number(inv);
    const avalfund = await scalar(DB, "select coalesce(title, '') from tbl_mainmenu_memberpanel where mid = 2 limit 1", {});
    if (avalfund !== null && avalfund !== undefined) ViewBag.avalfund = avalfund;
    const currentfund = await scalar(DB, "select coalesce(title, '') from tbl_mainmenu_memberpanel where mid = 3 limit 1", {});
    if (currentfund !== null && currentfund !== undefined) ViewBag.currentfund = currentfund;

    ViewBag.WalletPoint = '0.00';
    ViewBag.membernews = mapRows(await query(DB, "select * from tbl_news where status = 1 and type = 'Member' order by date desc limit 5", {}), NEWS_PROPS);

    const GalleryImages = await queryOne(DB, 'select name, title from tbl_flyermanagement where status = 1 and isactive = 1 and contenttype = 2 limit 1', {});
    if (GalleryImages != null) {
      ViewBag.FlayerImages = String(need(GalleryImages.name));
      ViewBag.ImageTitle = String(need(GalleryImages.title));
    }

    const inr = await scalar(DB, 'select inr from tbl_atc_inr_ratio_master limit 1', {});
    ViewBag.INR = inr === null || inr === undefined ? 0 : inr;

    PROCEDURENAME = 'USP_SPONSERANDACHIVELEVEL';
    const ObjSponser = mapRows(await proc(DB, 'usp_sponserandachivelevel', { plid: Plid }), SPONSER_PROPS);

    PROCEDURENAME = 'USP_SubScriptionDetails';
    const SubscriptionDetails = mapRows(await proc(DB, 'usp_subscriptiondetails', { plid: Plid }), SUBSCRIPTION_PROPS);
    ViewBag.SubscriptionList = SubscriptionDetails;
    ViewBag.SubscriptionListcount = SubscriptionDetails.length;

    PROCEDURENAME = 'USP_FUND_HISTORYGet_Top5Record';
    const WalletStateMent = mapRows(await proc(DB, 'usp_fund_historyget_top5record', { plid: Plid }), WALLET_TOP5_PROPS);
    ViewBag.fundHistory = WalletStateMent;
    ViewBag.WalletStateMentcount = WalletStateMent.length;

    PROCEDURENAME = 'USP_GetSubMenuTittle';
    const GetTittleOfSubmenu = mapRows(await proc(DB, 'usp_getsubmenutittle', { sid: 43 }), SUBMENU_PROPS);
    if (!GetTittleOfSubmenu.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
    ViewBag.GrowthBonus = String(need(GetTittleOfSubmenu[0].TITLE));
    const Url = String(need(GetTittleOfSubmenu[0].HERF));
    const url = Url.split('/');
    if (url.length < 3) throw new Error('Index was outside the bounds of the array.');
    ViewBag.Url = url[2];

    PROCEDURENAME = 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE_TOP5';
    const AllDownlineMemberLeftRightTop5 = mapRows(await proc(DB, 'usp_new_member_get_member_downlinelist_side_wise_top5', { loginid }), DOWNLINE_TOP5_PROPS);
    ViewBag.DownLineList = AllDownlineMemberLeftRightTop5;
    ViewBag.NoofDownLineList = AllDownlineMemberLeftRightTop5.length;
    ViewBag.ATCCoinRate = '0.00000000';
    ViewBag.ATCCoin = '0.00000000'; // both legacy branches assign the same value

    const loginids = await scalar(DB, 'select loginid from member_master where username = @u limit 1', { u: loginid });
    const TotalDirectReferral = Number(await scalar(DB, 'select coalesce(count(1), 0) from member_master where sponserid = @l', { l: loginids })) || 0;
    const TotalDownline = Number(await scalar(DB, 'select coalesce(count(1), 0) from fun_all_downline_memberlist_binary(@l, 0)', { l: loginids })) || 0;
    ViewBag.TotalDirectReferral = TotalDirectReferral;
    ViewBag.TotalDownline = TotalDownline;

    PROCEDURENAME = 'Usp_ManageReferal';
    await proc(DB, 'usp_managereferal', { plid: Math.trunc(Plid) }); // ObjLanding is loaded but never used in legacy
    const rows = await queryOne(DB, 'select defaultlandingurl from portal_login where plid = @plid limit 1', { plid: Plid });
    need(row); // row.USERNAME dereference
    need(rows);
    const UserName = row.username;
    ViewBag.ReferralID = row.username;
    const RLID = Number(rows.defaultlandingurl) === 0 ? 0 : Number(rows.defaultlandingurl);
    const row1 = await queryOne(DB, 'select url from referral_link where rlid = @r limit 1', { r: RLID });
    if (row1 != null) ViewBag.DefaultUrl = String(need(row1.url)).replace(/\/+$/, '') + '/' + UserName;

    return res.json({ Model: ObjSponser, ViewBag });
  } catch (ExpObj) {
    if (ExpObj instanceof RedirectError) return res.json({ redirect: ExpObj.redirect });
    console.error(ExpObj.message);
    ViewBag.ErrorMessage = ExpObj.message;
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, PROCEDURENAME, 0, req.path); } catch (e) { console.error(e.message); }
    return res.json({ ViewBag });
  }
}));

// auth (legacy tolerated a missing session by updating nothing; protected because it changes the member's own data)
router.all(`${P}/DefaultSponserSide{/:id}`, auth, asyncHandler(async (req, res) => {
  const side = parseInt(req.p.side, 10);
  if (Number.isNaN(side)) throw new Error('Incorrect syntax near the keyword \'where\'.');
  let Regno = 0;
  const plid = Math.trunc(Number(req.user.plid));
  const member = await queryOne(DB, 'select regno from member_master where regno = @plid limit 1', { plid }); // Member_Master.Get_member_details
  if (member != null) Regno = Number(member.regno);
  await exec(DB, 'update member_master set defaultsponserside = @side where regno = @regno', { side, regno: Regno });
  const Ret = await exec(DB, 'update portal_login set communityside = @side where plid = @plid', { side, plid });
  res.json(Ret);
}));

// auth (legacy dereferenced the session)
router.all(`${P}/Visitor_statatics_data{/:id}`, auth, asyncHandler(async (req, res) => {
  let VisitorStatics = [];
  try {
    const Plidd = Number(req.user.plid);
    VisitorStatics = mapRows(await proc(DB, 'usp_visitor_statics', { plid: Plidd }), VISITOR_PROPS);
    return res.json(VisitorStatics);
  } catch (ExpObj) {
    console.error(ExpObj.message);
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_Visitor_Statics', 0, req.path); } catch (e) { console.error(e.message); }
    return res.json(VisitorStatics);
  }
}));

// auth (legacy dereferenced the session)
router.all(`${P}/GetAllIncome{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await AllIncomeForDashBoard(Number(req.user.plid)));
}));

// auth (legacy dereferenced the session)
router.all(`${P}/GetTdsIncom{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(mapRows(await proc(DB, 'usp_getincomforpieandgraph', { pliid: Number(req.user.plid) }), ALLINCOME_PROPS));
}));

// auth (legacy dereferenced the session)
router.all(`${P}/GetBinaryIncomeByRegNo{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getmonthlybinaryincomebyregno', { regno: Number(req.user.plid) });
  res.json(mapRows(rows, BINARY_INCOME_PROPS));
}));

// public (no session use in legacy)
router.all(`${P}/BitcoinRate{/:id}`, asyncHandler(async (req, res) => {
  const CurrencySymbol = (config.app && config.app.CurrencySymbol) || '';
  try {
    const UrlForHit = 'https://bitpay.com/api/rates/' + CurrencySymbol;
    const resp = await axios.get(UrlForHit, { responseType: 'text', transformResponse: [(d) => d] });
    const ObjATCRateManagement = JSON.parse(resp.data);
    const abc = String(ObjATCRateManagement.rate);
    return res.json(abc);
  } catch (ex) {
    console.error(ex.message);
    try { await new DataUtility().ErrorInsert(0, ex.message, 'BitcoinRate', 0, req.path); } catch (e) { console.error(e.message); }
    // PORT-NOTE: legacy returned the serialised Exception object (Json(ExpObj)); a minimal {Message} object is returned instead
    return res.json({ Message: ex.message });
  }
}));

module.exports = router;
