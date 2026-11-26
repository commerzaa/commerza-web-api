// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\ClassifiedAds.cs (class ClassifiedAdsController => /portal/ClassifiedAds/...)
'use strict';
// Database: shopping (Db_Shopping, portal DataBaseContext).
// PORT-NOTE (routing): this CustomerPanel controller is "ClassifiedAds" (URL /ClassifiedAds/{action}); the root file
//   Controllers\ClassifiedAdsController.cs (already ported as classified-ads.js) declares class "ClassifiedAdController" (singular,
//   URL /ClassifiedAd/... plus the RouteConfig friendly URL "classified-ads/{action}"). The two controllers never shared a URL in
//   MVC (no areas; RouteConfig's "user/classifiedads" entry for this controller is commented out), so this module only registers
//   /portal/ClassifiedAds/... and none of the /portal/ClassifiedAd/... or /portal/classified-ads/... paths of classified-ads.js.
// PORT-NOTE (session, SESSION.md 3.3): AdPayment / PostAdConfirmation store the Portal_Login with ps.setPortalLogin (no token);
//   Index / PostNewAd read it back with ps.getPortalLogin. A customer Login there => InvalidCastException as legacy. The
//   Portal_Login no longer replaces the customer login for other pages (legacy Session["Plid"] = row overwrote it).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const ClassifiedAds = require('../../lib/portal/ClassifiedAds');
const YouAre = require('../../lib/portal/YouAre');
const AdType = require('../../lib/portal/AdType');
const Certified = require('../../lib/portal/Certified');
const AdPrice = require('../../lib/portal/AdPrice');
const AdCondition = require('../../lib/portal/AdCondition');
const YouWantTo = require('../../lib/portal/YouWantTo');
const StateAndCity = require('../../lib/portal/StateAndCity');
const Map_Attributer_With_SubCategory = require('../../lib/portal/Map_Attributer_With_SubCategory');
const Prodct_SubCat_Type = require('../../lib/portal/Prodct_SubCat_Type');
const Brand_Master = require('../../lib/portal/Brand_Master');
const Model_Master = require('../../lib/portal/Model_Master');
const googlemap = require('../../lib/portal/googlemap');
const { Portal_Master } = require('../../lib/portal/Portal_Master');
const { Portal_Login } = require('../../lib/portal/Portal_Login');
const { Product_Subcategory } = require('../../lib/portal/Product_Subcategory');
const { csErr, nullRef, mvcStr, mvcInt, toInt32, toDecimal, toStr } = require('./_shared/batch-03-common');
const { view, content } = require('./_shared/batch-06-common');
const {
  customerOrPortalLogin, portalLoginOrThrow, readTemplate, fmt00,
  ClassifiedAdsCreateImage, ClassifiedAdsSaveImage, ClassifiedAdsGetimageformate,
} = require('./_shared/batch-22-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/ClassifiedAds';
const V = '~/Views/CustomerPanel/ClassifiedAds/';

const count = (list) => { if (list === null || list === undefined) nullRef(); return list.length; };
/** Convert.ToInt64(TempData["AdID"].ToString()) */
function adIdOf(v) {
  if (v === null || v === undefined) nullRef();
  return toInt32(String(v));
}

// ---------------------------------------------------------------- ActionResult Index(string subcategory)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"); Session["Plid"] = customer Login OR Portal_Login)
router.all([`${C}/Index{/:id}`, C], customerOrPortalLogin, asyncHandler(async (req, res) => {
  const subcategory = mvcStr(req, 'subcategory');
  // StreamReader reader = new StreamReader(Server.MapPath("/add-confirm-page.html")) (opened, never read; missing => FileNotFoundException)
  // PORT-NOTE: add-confirm-page.html is not in the legacy source tree; it is looked up under config.uploadDir.
  readTemplate('/add-confirm-page.html');
  ps.tempDataSet(req, 'AdID', '');
  const TempData = { AdID: '' };
  if (subcategory === null) {
    const obj = new ClassifiedAds();
    return view(res, V + 'Index.cshtml', await obj.Product_Cat_And_SubCat_List(), {}, { TempData });
  }
  const Row = mapRow(await db.queryOne(DB,
    'select * from product_subcategory where lower(scat_code) = lower(@subcategory) and scatactive = true limit 1', { subcategory }),
  Product_Subcategory.PROPS);
  if (Row === null) return res.json({ redirect: '/ClassifiedAds/Index', TempData });

  const ViewBag = {};
  const LiYour = await new YouAre().YouAre_List(Row.CATID);
  const _AdType = new AdType();
  let LiAdType = await _AdType.AdType_List(Row.CATID);
  const LiAdTypeSubCat = await _AdType.AdType_List_OnSubCategory(Row.SCATID);
  if (count(LiAdTypeSubCat) > 0) LiAdType = LiAdTypeSubCat;
  const LiCertified = await new Certified().Certified_List(Row.CATID);
  const LiAdPrice = await new AdPrice().AdPrice_List(Row.CATID);
  const _AdCondition = new AdCondition();
  let LiAdCondition = await _AdCondition.AdCondition_List(Row.CATID);
  const LiAdConditionOnSubCategory = await _AdCondition.AdCondition_ListOnSubCategory(Row.SCATID);
  if (count(LiAdConditionOnSubCategory) > 0) LiAdCondition = LiAdConditionOnSubCategory;
  const LiYouWantTo = await new YouWantTo().YouWantTo_List(Row.CATID);

  let Cid = toInt32(ps.sessionGet(req, 'countryid'));
  if (ps.isCustomer(req) || ps.getPortalLogin(req)) {
    const pl = portalLoginOrThrow(req); // (Portal_Login)Session["Plid"]
    Cid = toInt32(pl.CID);
  }
  const _LiStateAndCity = await new StateAndCity().StateAndCityList(Cid);
  const Map_Attributer_With_SubCategory_List = await new Map_Attributer_With_SubCategory().Map_Attributer_With_SubCategory_List(Row.SCATID);

  const obj = {
    SCatID: 0, _LiYouAre: null, _LiAdType: null, _Certified: null, _AdPrice: null, _AdCondition: null, _LiYouWantTo: null,
    _LiStateAndCity: null, _Map_Attributer_With_SubCategory: null, _LiPortal_Mater: null,
  };
  obj.SCatID = Row.SCATID;
  const Li_BrandMaster = [];
  const Li_ModelMaster = [];
  const _LiProdct_SubCat_Type = await new Prodct_SubCat_Type().Prodct_SubCat_Type_List(Row.SCATID);
  ViewBag.ddlProductType = _LiProdct_SubCat_Type;
  if (count(_LiProdct_SubCat_Type) === 0) {
    ViewBag.ddlProductType = _LiProdct_SubCat_Type;
    const row = await new Brand_Master().Brand_Master_List(Row.SCATID);
    if (count(row) > 0) {
      ViewBag.ddlBrandName = row;
      ViewBag.ddlModel = Li_ModelMaster;
    } else {
      const row2 = await new Model_Master().Model_Master_List(Row.SCATID);
      if (count(row2) > 0) {
        ViewBag.ddlProductType = _LiProdct_SubCat_Type;
        ViewBag.ddlBrandName = Li_BrandMaster;
        ViewBag.ddlModel = row2;
      } else {
        ViewBag.ddlProductType = _LiProdct_SubCat_Type;
        ViewBag.ddlBrandName = Li_BrandMaster;
        ViewBag.ddlModel = Li_ModelMaster;
      }
    }
  } else {
    ViewBag.ddlBrandName = Li_BrandMaster;
    ViewBag.ddlModel = Li_ModelMaster;
  }
  obj._LiYouAre = LiYour;
  obj._LiAdType = LiAdType;
  obj._Certified = count(LiCertified) > 0 ? 'yes' : 'no';
  obj._AdPrice = count(LiAdPrice) > 0 ? 'yes' : 'no';
  if (count(LiAdCondition) > 0) {
    for (const Li of LiAdCondition) obj._AdCondition = Li.Title;
  } else {
    obj._AdCondition = 'no';
  }
  obj._LiYouWantTo = LiYouWantTo;
  obj._LiStateAndCity = _LiStateAndCity;
  obj._Map_Attributer_With_SubCategory = Map_Attributer_With_SubCategory_List;
  return view(res, V + 'CreateAd.cshtml', obj, ViewBag, { TempData });
}));

// ---------------------------------------------------------------- ActionResult AdPayment()
// public (no session check; reads TempData["AdID"], puts the ad owner's Portal_Login into Session["Plid"])
router.all(`${C}/AdPayment{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const AdID = ps.tempDataGet(req, 'AdID');
  if (AdID === null) return res.json({ redirect: '/Home/Index' });
  const ViewBag = {};
  try {
    const adid = adIdOf(AdID);
    const RowPMid = mapRow(await db.queryOne(DB, 'select * from portal_master where ad_id = @adid limit 1', { adid }), Portal_Master.PROPS);
    if (RowPMid === null) nullRef();
    const plid = RowPMid.PLID;
    const row = mapRow(await db.queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid }), Portal_Login.PROPS);
    ps.setPortalLogin(req, row); // Session["Plid"] = row
    ViewBag.pm = RowPMid;
    return view(res, V + 'AdPayment.cshtml', undefined, ViewBag);
  } catch (Exp) {
    ViewBag.Message = Exp.message;
    return res.json({ redirect: '/Home/Index' });
  }
}));

// ---------------------------------------------------------------- ActionResult PostAd_Paypal_Confirmation()
// public (no session check; reads TempData["TransID"])
// PORT-NOTE: the PayPal business account, API Username/Password/Signature were hard-coded in the C# redirect URL; they are read from
//   config.app.PayPalBusinessEmail / PayPalApiUserName / PayPalApiPassword / PayPalApiSignature (secrets are never copied).
router.all(`${C}/PostAd_Paypal_Confirmation{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const TransID_Temp = toStr(ps.tempDataGet(req, 'TransID'));
  if (TransID_Temp === '') return res.json({ redirect: '/post-your-ad/Index' });
  let EmailID = ''; let Mobile = ''; let AdTitle = ''; let currencysymbol = '';
  let Featured_Ad_Cost = 0;
  // from op in _Tbl_Onlinepayments  left join _Portal_Login pl on pl.PMID == op.PMID  left join _Portal_Master pm on pm.PLID == pl.PLID
  const query2 = await db.queryOne(DB, `select pl.emailid, pl.phone as mobileno, pm.ad_title, op.currency, op.paybleamount, op.status, op.transid
      from tbl_onlinepayments op
      left join portal_login pl on pl.pmid = op.pmid
      left join portal_master pm on pm.plid = pl.plid
     where op.transid = @TransID_Temp and op.status = 'Pending' limit 1`, { TransID_Temp });
  if (query2 !== null) {
    EmailID = toStr(query2.emailid);
    AdTitle = toStr(query2.ad_title);
    Mobile = toStr(query2.mobileno);
    Featured_Ad_Cost = toDecimal(query2.paybleamount);
    currencysymbol = toStr(query2.currency);
  } else {
    return res.json({ redirect: '/ClassifiedAds/Index' });
  }
  let AmountInPound = 0;
  const firstCcode = currencysymbol;
  const lastCcode = 'USD';
  const apiRate = Number(await UtilityClass.ExchangeRateFromAPI(0, firstCcode, lastCcode));
  if (apiRate === 0) return res.json({ redirect: '/post-your-ad/Index' });
  AmountInPound = apiRate * Number(Featured_Ad_Cost);
  const app = config.app || {};
  let redirecturl = '';
  redirecturl += 'https://www.paypal.com/cgi-bin/webscr?business=' + (app.PayPalBusinessEmail || '');
  redirecturl += '&cmd=_cart';
  redirecturl += '&upload=' + 'https://www.paypal.com/cgi-bin/webscr';
  redirecturl += '&Username=' + (app.PayPalApiUserName || '');
  redirecturl += '&Password=' + (app.PayPalApiPassword || '');
  redirecturl += '&Signature=' + (app.PayPalApiSignature || '');
  redirecturl += '&first_name=' + '';
  redirecturl += '&last_name=' + '';
  for (let i = 1; i <= 1; i++) {
    redirecturl += '&item_name_' + String(i) + '=' + 'Featured Ad For 1 month for ' + AdTitle;
    redirecturl += '&amount_' + String(i) + '=' + fmt00(AmountInPound);
    redirecturl += '&custom=' + '';
    redirecturl += '&quantity_' + i + '=' + '1';
  }
  redirecturl += '&night_phone_a=' + Mobile;
  redirecturl += '&email=' + EmailID;
  redirecturl += '&orderId=' + TransID_Temp;
  redirecturl += '&tax=0';
  redirecturl += '&currency=' + 'USD';
  redirecturl += '&orderId=' + TransID_Temp;
  redirecturl += '&invoice=' + TransID_Temp;
  redirecturl += '&type=mastercard';
  const absoluteUri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const enc = await UtilityClass.Encryptword(TransID_Temp.toString());
  if (absoluteUri.toString().indexOf('://localhost'.toLowerCase()) >= 0) {
    redirecturl += '&return=' + 'http://localhost:39901/OnlinePaymentComplete?transid=' + enc;
    redirecturl += '&cancel_return=' + 'http://localhost:39901/OnlinePaymentCancel?transid=' + enc;
  } else {
    redirecturl += '&return=' + 'http://qads.bz/OnlinePaymentComplete?transid=' + enc;
    redirecturl += '&cancel_return=' + 'http://qads.bz/OnlinePaymentCancel?transid=' + enc;
  }
  // Response.Redirect(redirecturl) ends the request (the following RedirectToAction("RedirectingToPaypal","post_your_ad") never ran)
  return res.json({ redirect: redirecturl });
}));

// ---------------------------------------------------------------- JsonResult PostNewAd(...)
// public (no session check in legacy; Session["Plid"] optional: a Portal_Login overrides Seller_Email)
router.all(`${C}/PostNewAd{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Seller_Name = mvcStr(req, 'Seller_Name'); let Seller_Email = mvcStr(req, 'Seller_Email');
  const Seller_ContactNo = mvcStr(req, 'Seller_ContactNo'); const Seller_Address = mvcStr(req, 'Seller_Address');
  const Seller_Cid = mvcInt(req, 'Seller_Cid'); const Seller_ctid = mvcInt(req, 'Seller_ctid'); const SCatID = mvcInt(req, 'SCatID');
  const YourAre = mvcStr(req, 'YourAre'); const Ad_Title = mvcStr(req, 'Ad_Title'); const Ad_Price = mvcStr(req, 'Ad_Price');
  const Ad_Type = mvcStr(req, 'Ad_Type'); const YouWantTo_ = mvcStr(req, 'YouWantTo'); const IsCertifiedAd = mvcInt(req, 'IsCertifiedAd');
  const Certified_Image_Name = mvcStr(req, 'Certified_Image_Name'); const IsFeaturedAd = mvcInt(req, 'IsFeaturedAd');
  const Condition = mvcStr(req, 'Condition'); let Ad_Images = mvcStr(req, 'Ad_Images'); const Ad_Description = mvcStr(req, 'Ad_Description');
  const Ad_CID = mvcStr(req, 'Ad_CID'); const Ad_Area = mvcStr(req, 'Ad_Area'); const Ad_Pincode = mvcStr(req, 'Ad_Pincode');
  const Ad_CTID = mvcStr(req, 'Ad_CTID'); let Ad_AID = mvcStr(req, 'Ad_AID'); const Attributes = mvcStr(req, 'Attributes');
  const VCode = mvcStr(req, 'VCode'); const Pr_Type = mvcStr(req, 'Pr_Type'); const Brand = mvcStr(req, 'Brand');
  const Model = mvcStr(req, 'Model'); let imageByteCode = mvcStr(req, 'imageByteCode'); const Selected_Pay_Value = mvcInt(req, 'Selected_Pay_Value');
  const PostAd_PayMode = mvcStr(req, 'PostAd_PayMode'); const PostAd_BankName = mvcStr(req, 'PostAd_BankName');
  const PostAd_DDChNo = mvcStr(req, 'PostAd_DDChNo'); let PostAd_ChDate = mvcStr(req, 'PostAd_ChDate');
  const PostAd_PayRemark = mvcStr(req, 'PostAd_PayRemark'); const PostAd_PayLoginID = mvcStr(req, 'PostAd_PayLoginID');
  const PostAd_PayPassword = mvcStr(req, 'PostAd_PayPassword');
  const ViewBag = {};
  const err = 'Sorry, some error occured.';
  const isInt32 = (v) => /^\s*[+-]?\d+\s*$/.test(v) && Math.abs(parseInt(v, 10)) <= 2147483647;

  let ret = '';
  if (imageByteCode === null) nullRef();
  imageByteCode = imageByteCode.split('hariOmNamahshivay').join('^');
  Ad_Images = await ClassifiedAdsSaveImage(imageByteCode, Ad_Title);

  // Int32.TryParse(Seller_Cid.ToString() / Seller_ctid.ToString() (twice) ...) on int parameters always succeeds
  if (toInt32(IsFeaturedAd) === 1) {
    if (toInt32(Selected_Pay_Value) <= 0) return res.json('Please select payment mode !');
  }
  // SCatID / IsCertifiedAd / IsFeaturedAd are ints: TryParse always succeeds
  if (Ad_CID === null) nullRef();
  if (!isInt32(Ad_CID)) return res.json(err);
  if (Ad_CTID === null) nullRef();
  if (!isInt32(Ad_CTID)) return res.json(err);
  if (Ad_AID === '') Ad_AID = '0';
  if (Ad_AID === null) nullRef();
  if (!isInt32(Ad_AID)) return res.json(err);

  if (toStr(PostAd_ChDate) !== '') {
    try {
      const arr = PostAd_ChDate.split('/');
      if (arr.length < 3) throw csErr('IndexOutOfRangeException', 'Index was outside the bounds of the array.');
      PostAd_ChDate = arr[2] + '-' + arr[1] + '-' + arr[0] + ' 00:00:00.000';
    } catch (Exp) {
      ViewBag.Message = Exp.message;
      PostAd_ChDate = null;
    }
  }

  let Plid = 0;
  if (!(ps.isCustomer(req) || ps.getPortalLogin(req))) {
    Plid = 0;
  } else {
    Plid = 0; // Convert.ToDouble(((Portal_Login)Session["Plid"]).Plid);
    Seller_Email = portalLoginOrThrow(req).LOGINID;
  }
  let Optid = 0;
  if (ps.sessionGet(req, 'optid') === null) Optid = 0;
  else Optid = toInt32(ps.sessionGet(req, 'Optid'));

  if (VCode !== toStr(ps.sessionGet(req, 'vcodePosting'))) {
    return res.json('Sorry, you have entered wrong verification code.');
  }
  const obj = new ClassifiedAds();
  const str = await obj.PostNewAd(Seller_Name, Seller_Email, Seller_ContactNo, Seller_Address, Seller_Cid, Seller_ctid, SCatID, YourAre, Ad_Title,
    Ad_Price, Ad_Type, YouWantTo_, IsCertifiedAd, Certified_Image_Name, IsFeaturedAd, Condition, Ad_Images, Ad_Description, Ad_CID, Ad_Area,
    Ad_Pincode, Ad_CTID, Ad_AID, Attributes, VCode, Pr_Type, Brand, Model, imageByteCode, Selected_Pay_Value, PostAd_PayMode, PostAd_BankName,
    PostAd_DDChNo, PostAd_ChDate, PostAd_PayRemark, PostAd_PayLoginID, PostAd_PayPassword, Plid, Optid);
  if (str.length > 0) {
    if (toInt32(str[0]) > 0) {
      ps.tempDataSet(req, 'AdID', str[0]);
      if (Seller_Email !== '') ps.tempDataSet(req, 'username', Seller_Email);
      else ps.tempDataSet(req, 'username', 'User');
      ret = 'ok^' + str[0];
      if (toStr(str[1]) !== 'ok') {
        ret = toStr(str[1]);
      } else {
        const google = new googlemap();
        await google.google(toInt32(str[0]));
      }
      if (Selected_Pay_Value === 1 && IsFeaturedAd === 1) {
        // string TransID = str[3]; on a string[3]
        if (str.length < 4) throw csErr('IndexOutOfRangeException', 'Index was outside the bounds of the array.');
        const TransID = str[3];
        ps.tempDataSet(req, 'TransID', TransID);
        ret = 'paypal_success^123';
      }
    } else {
      ret = 'some error occured. Please try again';
    }
  } else {
    ret = 'some error occured. Please try again';
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- string CreateImage(string base64String, string imagename)
// public (public helper method reachable as an MVC action; string return => ContentResult)
router.all(`${C}/CreateImage{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const r = await ClassifiedAdsCreateImage(mvcStr(req, 'base64String'), mvcStr(req, 'imagename'));
  return content(res, r);
}));

// ---------------------------------------------------------------- ViewResult RedirectingToPaypal()
// public
router.all(`${C}/RedirectingToPaypal{/:id}`, ps.portalSession, asyncHandler(async (req, res) => view(res, V + 'RedirectingToPaypal.cshtml')));

// ---------------------------------------------------------------- ActionResult PostAdConfirmation()
// public (no session check; reads TempData["AdID"], puts the ad owner's Portal_Login into Session["Plid"])
router.all(`${C}/PostAdConfirmation{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const AdID = ps.tempDataGet(req, 'AdID');
  if (AdID === null) return res.json({ redirect: '/Home/Index' });
  let emailid = ''; let loginid = ''; let password = ''; let date = ''; let title = ''; let ExtraRow = '';
  const adid = adIdOf(AdID);
  const RowPMid = mapRow(await db.queryOne(DB, 'select * from portal_master where ad_id = @adid limit 1', { adid }), Portal_Master.PROPS);
  if (RowPMid === null) nullRef();
  const plid = RowPMid.PLID;
  title = RowPMid.AD_TITLE;
  const row = mapRow(await db.queryOne(DB, 'select * from portal_login where plid = @plid limit 1', { plid }), Portal_Login.PROPS);
  ps.setPortalLogin(req, row); // Session["Plid"] = row
  if (row === null) nullRef();
  emailid = row.EMAILID;
  loginid = row.LOGINID;
  password = row.PASSWORD;
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  date = `${z(d.getUTCDate())}-${z(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`; // DateTime.UtcNow.ToString("dd-MM-yyyy")
  ExtraRow = '';
  const CountPlid = Number(await db.scalar(DB, 'select count(*) from portal_master where plid = @plid', { plid }));
  if (CountPlid === 1) {
    ExtraRow += "<div style='clear:both'>You can manage your ads by login into your account</div>";
    ExtraRow += "<ul style='width: auto;  padding: 0px 70px 5px 3px;'>";
    ExtraRow += "<li style='margin-top: 8px; font-size: 15px; list-style:none; font-family:Arial; '>Login Details <br/></li>";
    ExtraRow += "<li style='font-size:14px; list-style:none; color:#454545;'>User ID : " + toStr(loginid) + '</li>';
    ExtraRow += "<li style='font-size:14px;  list-style:none;color:#454545;'>Password : " + toStr(password) + '</li>';
    ExtraRow += ' </ul>';
  }
  const subject = 'Welcome To Qads.bz';
  // PORT-NOTE: add-confirm-page.html is not in the legacy source tree; it is looked up under config.uploadDir.
  const readFile = readTemplate('/add-confirm-page.html');
  const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
  let myString = '';
  myString = readFile;
  myString = rep(myString, '$$LoginDetails$$', ExtraRow);
  myString = rep(myString, '$$lblLoginId$$', loginid);
  myString = rep(myString, '$$lblPassword$$', password);
  myString = rep(myString, '$$lblAddNo$$', String(adid));
  myString = rep(myString, '$$date$$', date);
  myString = rep(myString, '$$title$$', title);
  // new Thread(() => SendAdPostlMail(plid, emailid, subject, myString)).Start()
  setImmediate(() => {
    Promise.resolve().then(() => SendMail.Send(plid, '', emailid, '', '', subject, myString))
      .catch((e) => console.error('[ClassifiedAds.PostAdConfirmation mail]', e && e.message));
  });
  return view(res, V + 'PostAdConfirmation.cshtml');
}));

// ---------------------------------------------------------------- string Getimageformate(System.Drawing.Image img)
// public. PORT-NOTE: an abstract System.Drawing.Image parameter cannot be model-bound, so the legacy URL always failed
//   (MissingMethodException); reproduced as a 500. The logic itself is ClassifiedAdsGetimageformate in batch-22-common.
router.all(`${C}/Getimageformate{/:id}`, ps.portalSession, asyncHandler(async () => {
  void ClassifiedAdsGetimageformate;
  throw csErr('MissingMethodException', 'Cannot create an abstract class.');
}));

// ---------------------------------------------------------------- string getRandomName()
// public (string return => ContentResult)
router.all(`${C}/getRandomName{/:id}`, ps.portalSession, asyncHandler(async (req, res) => content(res, await UtilityClass.getRandomName())));

// ---------------------------------------------------------------- string saveImage(string imgecode, string titlename)
// public (string return => ContentResult)
router.all(`${C}/saveImage{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const r = await ClassifiedAdsSaveImage(mvcStr(req, 'imgecode'), mvcStr(req, 'titlename'));
  return content(res, r);
}));

// ---------------------------------------------------------------- JsonResult VerifyNewAd(string emailID)
// public (sets Session["vcodePosting"])
router.all(`${C}/VerifyNewAd{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const emailID = mvcStr(req, 'emailID');
  const ViewBag = {};
  try {
    const vcode = String(10000 + Math.floor(Math.random() * (999999 - 10000))); // (new Random()).Next(10000, 999999)
    ps.sessionSet(req, 'vcodePosting', vcode);
    await SendVerificationMail(emailID, vcode);
    // a second background Thread was created but never started (emailThread.Start() commented out)
    return res.json('ok^' + vcode);
  } catch (Exp) {
    ViewBag.Message = Exp.message;
    return res.json('some erro occured, please try again !');
  }
}));

/** private void SendVerificationMail(string emailid, string vcode) */
async function SendVerificationMail(emailid, vcode) {
  let body = '';
  const subject = 'Verification code for posting ad';
  const bcc = ''; const cc = ''; const to = emailid; const from1 = '';
  body = ` <div style='margin: auto; background: #fff url(http://qlook.bz/images/topborder.png) top left repeat-x; border: 2px solid #ddd; width: 700px; padding-bottom: 7px; -webkit-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); -moz-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65);'>
           <table width='700' style='background: #2d97de; margin: 0px auto; padding: 45px 0px;'>
        <tr>
            <td>
                <table cellpadding='0' cellspacing='0' style='background: none repeat scroll 0 0 #fff; border: 7px solid #dcdcdc; color: #333; font-family: Arial,Helvetica,sans-serif; margin: 0 48px; width: 585px;'>
                    <tr>
                        <td>
                            <table width='585'>
                                <tr>
                                    <td style='width: 350px; height: 70px;'><a href='http://qads.bz/'>
                                        <img src='http://qads.bz/images/new_logo.png' height='45px' border='0' style='height: 45px; margin-left: 6px; float: left;' />
                                    </a></td>
                                    <td style='text-align: right; font-size: 17px; padding-right: 15px; color: #eb480b; font-family: Arial,Helvetica,sans-serif; width: 250px;'>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div>
                                <div class='clear'></div>

                                <table style='border-top: 1px solid rgb(204, 204, 204); height: auto; padding-bottom: 0px; padding-left: 12px; padding-top: 6px; width: 585px;'>
                                    <tr>
 <td>

 <p style='font-family: Arial; font-size: 17px; color: #454545; padding: 10px 0px 0px; margin-top: 19px;'>Dear, $$Name$$  </p>
                                             <h3><span style=' color: rgb(69, 69, 69);  font-size: 16px; font-weight: normal;'> Your Verification Code is: <span style='color: #3d7cd0; font-weight: normal;'>$$lblcode$$</span> </span></h3>

                                            </table>
                                            <div style='clear: both'></div>
                                            <p style='font-size: 14px; font-family: Arial; font-weight: normal; margin: 0px 0px 7px 15px; color: #3f3f42;'>
                                                If you have any issues verfying your email, we will be happy to help you.
                                            </p>
                                            <strong style='font-size: 15px; font-family: Arial; font-weight: normal; margin: 0px 0 0 15px; color: #454545;'>You can contact  us on support@qads.bz</strong>
                                            <div style='clear: both'></div>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td>
                                            <table width='554'>
                                                <tr>
                                                    <td width='70%' style='padding-top:20px;'>

                                                        <p style='font-size: 15px; font-family: Arial; font-weight: normal; margin: 6px 0px 7px 15px; float: left; color: #3f3f42;'>
                                                            Sincerely,
                <br />
                                                            Qads Team
                                                        </p>
                                                    </td>
                                                    <td  valign='middle' style ='width: 280px; text-align: right; padding-top:20px;'>

                                                        <div style='margin-right: 7px;'>

                                                            <a href='https://www.facebook.com/Qads.bz' style='border: none; text-decoration: none; margin-bottom: 10px; float: left; width: 28px;'>
                                                                <img src='http://qads.bz/images/mailer-fb-icon.png' border='0px' height='23px;' />
                                                            </a>

                                                            <a href='https://twitter.com/Qads_bz' style='border: none; text-decoration: none; margin-bottom: 10px; float: left; width: 28px;'>
                                                                <img src='http://qads.bz/images/mailer-twit-icon.png' border='0px' height='23px;' />
                                                            </a>

                                                            <a href='https://plus.google.com/+Qads-Bz/posts' style='border: none; text-decoration: none; margin-bottom: 10px; float: left; width: 28px;'>
                                                                <img src='http://qads.bz/images/mailer-gplus-icon.png' border='0px' height='23px;' />
                                                            </a>

                                                            <a href='https://www.youtube.com/user/ATCShopping' style='border: none; text-decoration: none; margin-bottom: 10px; float: left; width: 28px;'>
                                                                <img src='http://qads.bz/images/mailer-youtube-icon.png' border='0px' height='23px;' />
                                                            </a>

                                                            <a href='https://www.pinterest.com/Qads_bz/' style='border: none; text-decoration: none; float: left; width: 28px;'>
                                                                <img src='https://jewria.com/images/mailer-pin-icon.png' border='0px' height='23px;' />
                                                            </a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                        </td>
                                    </tr>
                                </table>
                                <div class='clear'></div>
                            </div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
        </div>`;
  body = body.split('$$Name$$').join(emailid === null || emailid === undefined ? '' : String(emailid));
  body = body.split('$$lblcode$$').join(vcode);
  await SendMail.Send1(from1, to, cc, bcc, subject, body);
}

// ---------------------------------------------------------------- void SendAdPostlMail(Int64 plid, string emailid, string subject, string myString)
// auth. PORT-NOTE (security): legacy exposed this public helper as an anonymous MVC action (an open mail relay sending any HTML
//   body to any address); it is protected with ps.customerAuth here. void => empty 200 response.
router.all(`${C}/SendAdPostlMail{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const plid = mvcInt(req, 'plid');
  await SendMail.Send(plid, '', mvcStr(req, 'emailid'), '', '', mvcStr(req, 'subject'), mvcStr(req, 'myString'));
  return res.status(200).end();
}));

module.exports = router;
