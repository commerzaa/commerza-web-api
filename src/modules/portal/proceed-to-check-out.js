'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Proceed_To_CheckOutController.cs (class Proceed_To_CheckOutController)
// Database: shopping (Db_Shopping; portal DataBaseContext).
// Procs: USP_GETSHOPPINGCARTDATA (via batch-12-common), Usp_DistributorDiscount, USP_CUSTOMER_MAKE_ORDER, USP_ORDERONLINEREQUESTS, ordercomplete,
//   USP_GETSTOCKISTREQUEST (legacy note: not in the local database), Usp_VerificationCode, USP_CHECKOUTUSERREGISTER_UPDATE, USP_GET_RESELLERSETTING.
// Tables: IMS_MASTERPRODUCTATTRIBUTE, TBL_ATTRIBUTES_WITH_CATEGORY, TBL_DISTRIBUTOR_PREPAID_SETTING, TBL_CUSTOMERLOGIN, IMS_CustomerAddress,
//   TBL_ORDER_MASTER, IMS_SubProduct, tbl_Vat_Categories, TBL_COURIERPINCODES.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../../db');
const config = require('../../config');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const b12 = require('./_shared/batch-12-common');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CompanySettingsMod = require('../../lib/portal/CompanySettings');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const DAL_AffiliateBonusManage = require('../../lib/portal/DAL_AffiliateBonusManage');
const SendMail = require('../../lib/portal/SendMail');
const GetIP = require('../../lib/portal/GetIP');

const router = express.Router();
const DB = 'shopping';
const C = '/portal/Proceed_To_CheckOut';
const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;
const { CompanyMasterSettings } = CompanySettingsMod;

// PORT-NOTE (legacy bug + SECURITY, reproduced): `private static string pass, userid` are process-wide, shared by ALL visitors.
// UpdateStatus stores the last registrant's password/mobile here and AutoSignIn logs in whoever calls it next with them.
let pass = '';
let userid = '';

// private string CompanyName = AppSettings["CompanyName"]
const CompanyName = () => String(config.app.CompanyName || '');
// private string Currency = Convert.ToString(Session["CURRENCYCODE"])  (writers commented out => "")
const CurrencyOf = (req) => { const v = ps.sessionGet(req, 'CURRENCYCODE'); return v === null || v === undefined ? '' : String(v); };

// ---------------------------------------------------------------- binding helpers (ASP.NET model binding)
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
// MVC DefaultModelBinder: absent => default value; present but empty => null (ConvertEmptyStringToNull)
const strP = (v, def = null) => (v === undefined || v === null ? def : (String(v) === '' ? null : String(v)));
function intP(v, def = 0) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`The parameter value '${v}' is not valid.`);
  return n;
}
function numP(v, def = 0) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`The parameter value '${v}' is not valid.`);
  return n;
}
const appDID = () => { const n = parseInt(config.app.DID, 10); if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };
// C# "Random.Next(100000, 555555)"
const nextRandom = (min, max) => min + crypto.randomInt(max - min);
// fire-and-forget "new Thread(...).Start()"
const background = (fn) => { setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error('[Proceed_To_CheckOut background]', e && e.message)); }); };
const replaceAll = (s, a, b) => String(s).split(a).join(b === null || b === undefined ? '' : String(b));
const fmt2 = (n) => Number(n || 0).toFixed(2);
const csNum = (n) => (n === null || n === undefined ? '' : String(n)); // decimal/double ToString()

function masterPageShow(req) { return ps.sessionGet(req, 'LoginwithMobile') != null ? 'MobileLogin' : ''; }

// ---------------------------------------------------------------- Captcha()  (public void => image)
function captchaSvg(text) {
  const width = 100; const height = 40;
  let dots = '';
  const m = Math.max(width, height);
  for (let i = 0; i < Math.floor((width * height) / 30); i++) {
    const x = crypto.randomInt(width); const y = crypto.randomInt(height);
    const w = crypto.randomInt(Math.max(1, Math.floor(m / 50))); const h = crypto.randomInt(Math.max(1, Math.floor(m / 50)));
    if (w > 0 && h > 0) dots += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#87ceeb"/>`;
  }
  const skew = (crypto.randomInt(21) - 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + '<defs><pattern id="c" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#fff"/>'
    + '<rect x="1" y="1" width="1" height="1" fill="#d3d3d3"/></pattern></defs>'
    + `<rect width="${width}" height="${height}" fill="url(#c)"/>`
    + `<text x="50" y="28" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="25" fill="#000" stroke="#87ceeb" stroke-width="0.6" transform="skewX(${skew})">${text}</text>`
    + `${dots}</svg>`;
}
async function Captcha(req, res) {
  const captcha = String(nextRandom(111111, 999999));
  ps.sessionSet(req, 'Captcha', captcha);
  const svg = captchaSvg(ps.sessionGet(req, 'captcha'));
  // PORT-NOTE: legacy drew a warped System.Drawing bitmap as JPEG. sharp (not installed) is required lazily to rasterise to JPEG;
  // without it the same captcha is sent as SVG.
  let sharp = null;
  try { sharp = require('sharp'); } catch (_) { sharp = null; }
  if (sharp) {
    const jpg = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    res.type('image/jpeg').send(jpg);
    return;
  }
  res.type('image/svg+xml').send(svg);
}

// ---------------------------------------------------------------- getSelectedAttr(Int64 SPRID)  (public => also an MVC action)
async function getSelectedAttr(SPRID) {
  const rows = await db.query(DB,
    `select distinct title, value from ims_masterproductattribute mpa
       inner join tbl_attributes_with_category awc on mpa.awcid = awc.awct_id
      where awc.isselectiveattr = true and mpa.sprid = @SPRID`, { SPRID });
  return mapRows(rows, ['title', 'value']);
}

// ---------------------------------------------------------------- SendMailconfirmation(OrderID)  (protected helper, no route)
async function SendMailconfirmation(req, OrderID) {
  let TrProduct = ''; let mobileno = ''; let Address = ''; let city = ''; let pincode = '';
  let MemberName = ''; let email = ''; let TotalAmount = 0;
  const Currency = CurrencyOf(req);
  let getorderid = UtilityClass.Decryptword(OrderID);
  getorderid = String(getorderid).replace(/^,+|,+$/g, '');
  const GetCompleteorderde = await db.proc(DB, 'ordercomplete', { orderid: getorderid });
  let OrderId = '';
  for (const r of GetCompleteorderde) {
    const items = {
      MobileNo: r.mobileno, billadd: r.billadd, City: r.city, PinCode: r.pincode, EmailID: r.emailid, Name: r.name, orderDate: r.orderdate,
      total_purchase_cost: Number(r.total_purchase_cost || 0), orderID: r.orderid, MerchantName: r.merchantname, Product_Name: r.product_name,
      quntity: r.quntity, total_DAP: Number(r.total_dap || 0), Total_Ship_Ch: Number(r.total_ship_ch || 0),
      Total_payble_vat: Number(r.total_payble_vat || 0), Prod_Images: r.prod_images,
    };
    mobileno = items.MobileNo;
    Address = items.billadd;
    city = items.City;
    pincode = items.PinCode;
    email = items.EmailID;
    MemberName = items.Name;
    TotalAmount += items.total_purchase_cost;
    if (items.orderID !== OrderId) {
      OrderId = items.orderID;
      TrProduct += `
                                    <tr>
                                    	<td colspan='7' height='35px'>
                                        <a href='#' style='background-color: rgba(0, 0, 0, 0.7); border-color:
                                        rgb(218, 218, 218) rgb(218, 218, 218) rgb(204, 204, 204); box-shadow: 0 1px 1px rgba(90, 90, 90, 0.1);
                                        padding:5px 10px; color:#ffffff; border:1px solid #d4d4d4; text-decoration:none;'>
                                        <span>$$OrderId$$</span>
                                        <span>Seller: $$MerchantName$$ </span>
                                        </a>
                                        </td>
                                    </tr>`;
    }
    TrProduct += `<tr>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'>
                                 <img style='height: 30px; width: 30px; border:0px;' src='http://$$CompanyURL$$/images/logo.png'></td>
                             <td width='25%' style='border:1px solid #dddddd; padding:0px 5px;'>
                            <p style='overflow:auto; font-size:14px;'> $$product$$ </p></td>
                             <td width='15%' style='border:1px solid #dddddd; padding:0px 5px;'> $$price$$</td>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'> $$quantity$$</td>
                             <td width='15%' style='border:1px solid #dddddd; padding:0px 5px;'> $$shippingcharges$$</td>
                             <td width='15%' style='border:1px solid #dddddd; padding:0px 5px;'> $$vatcharges$$</td>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'> $$subtotal$$</td>
                              </tr>`;
    TrProduct = replaceAll(TrProduct, '$$MerchantName$$', items.MerchantName);
    TrProduct = replaceAll(TrProduct, '$$OrderId$$', items.orderID);
    TrProduct = replaceAll(TrProduct, '$$product$$', items.Product_Name);
    TrProduct = replaceAll(TrProduct, '$$CompanyURL$$', CompanySettings.CompanyURL);
    TrProduct = replaceAll(TrProduct, '$$quantity$$', items.quntity === null || items.quntity === undefined ? '' : String(items.quntity));
    TrProduct = replaceAll(TrProduct, '$$price$$', `${Currency} ${fmt2(items.total_DAP)}`);
    TrProduct = replaceAll(TrProduct, '$$shippingcharges$$', `${Currency} ${fmt2(items.Total_Ship_Ch)}`);
    TrProduct = replaceAll(TrProduct, '$$vatcharges$$', `${Currency} ${fmt2(items.Total_payble_vat)}`);
    TrProduct = replaceAll(TrProduct, '$$subtotal$$', `${Currency} ${fmt2(items.total_purchase_cost)}`);
    const imag = items.Prod_Images;
    if (imag === null || imag === undefined) throw NRE();
    const splitimage = String(imag).split('^')[0];
    if (splitimage !== '') {
      TrProduct = replaceAll(TrProduct, 'http://mvp.dealsinvicta.com/images/logo.png', `http://mvp.dealsinvicta.com/Product_Images/${splitimage}`);
    }
  }
  const subject = `Your Order Successfuly Placed in  ${CompanyName()}`;
  // Server.MapPath("~/OrderDetail.html") - identical file already shipped with src/modules/_payment
  const readFile = fs.readFileSync(path.join(__dirname, '..', '_payment', 'OrderDetail.html'), 'utf8');
  let myString = readFile;
  const now = new Date();
  // PORT-NOTE: DateTime.Now.ToShortDateString() rendered as M/d/yyyy (en-US); legacy used the server culture.
  myString = replaceAll(myString, '$$date$$', `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`);
  myString = replaceAll(myString, '$$Name$$', MemberName);
  myString = replaceAll(myString, '$$Mobile$$', mobileno);
  myString = replaceAll(myString, '$$Address$$', Address);
  myString = replaceAll(myString, '$$City$$', city);
  myString = replaceAll(myString, '$$PinCode$$', pincode);
  myString = replaceAll(myString, '$$CompanyName$$', CompanySettings.CompanyName);
  myString = replaceAll(myString, '$$CompanyURL$$', CompanySettings.CompanyURL);
  myString = replaceAll(myString, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
  myString = replaceAll(myString, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
  myString = replaceAll(myString, '$$customTr$$', TrProduct);
  myString = replaceAll(myString, '$$TotalProudctAmount$$', Currency + fmt2(TotalAmount));
  // legacy bug kept: passes MemberName when it is EMPTY, otherwise the e-mail address
  await UtilityClass.CheckAndSendMsgOnEmail((MemberName === null || MemberName === undefined || MemberName === '' ? MemberName : email),
    email, '', '', subject, myString);
}

// ---------------------------------------------------------------- referral tracking (Session["AffiliateUserId"])
async function saveReferral(req, COMPLETE_FLAG, REMARK, MODE, ORDER_ID) {
  const repo = new DAL_AffiliateBonusManage();
  const referral = await repo.GetReferralSessionData(String(ps.sessionGet(req, 'AffiliateUserId')));
  const model = {
    SHARE_BY_ID: referral.REFERRAL_USER_ID,
    SHARE_TO_ID: Math.trunc(Number(req.user.plid)) | 0,
    LINK: referral.SHARE_LINK,
    SPRID: referral.SPRID,
    COMPLETE_FLAG,
    REMARK,
    MODE,
    ORDER_ID,
  };
  return repo.SaveReferralInfo(model);
}

// ============================================================================ routes

// public
router.all(`${C}/Captcha{/:id}`, ps.portalSession, asyncHandler(Captcha));

// ---------------------------------------------------------------- CreateCaptch()
// PORT-NOTE: legacy wrote the captcha JPEG to the response and then rendered RegisterCaptcha.cshtml after it; only the image is sent.
// public
router.all(`${C}/CreateCaptch{/:id}`, ps.portalSession, asyncHandler(Captcha));

// ---------------------------------------------------------------- GetOrderReview()
// public (session optional; cart is keyed by CLID/Session.SessionID)
router.all(`${C}/GetOrderReview{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const pkgorder = [];
  let RegNo = 0;
  if (ps.isCustomer(req)) RegNo = Number(req.user.plid);
  let ReturnValue;
  const shoppingData = await b12.GetShoppingCartData(req);
  if (shoppingData != null && shoppingData.length > 0) {
    for (const shopData of shoppingData) {
      const pkg = {
        CategoryId: 0, CheckoutType: null, DAP: 0, GrandTotal: 0, Images: null, PaybleAmount: 0, PaybleAmount_OnPurchase: 0, PayblePurchaseTotal: 0,
        TotalVatAmount: 0, VatAmount: 0, VatPrecentage: 0, PinCodeAvailability: null, IsStockCount: 0, PrTitle: null, quantity: 0, sellMRP: 0,
        ShippingCharges: 0, SPRID: 0, TotalAmount: 0, TotalShipping: 0, BV: 0, PV: 0, CASHBACK: 0, title: null, value: null, productdetails: null,
        ProductRealAmount: 0, listproductdetails: null,
      };
      pkg.CheckoutType = '';
      pkg.SPRID = shopData.SPRID;
      pkg.PrTitle = shopData.PrTitle;
      pkg.PaybleAmount = b12.toDec(shopData.PaybleAmount);
      pkg.Images = shopData.Images;
      pkg.quantity = Math.round(b12.toDec(shopData.quantity));
      pkg.BV = b12.toDec(shopData.BV) * b12.toDec(shopData.quantity);
      pkg.PV = b12.toDec(shopData.PV) * b12.toDec(shopData.quantity);
      pkg.CASHBACK = b12.toDec(shopData.CASHBACK) * b12.toDec(shopData.quantity);
      pkg.ProductRealAmount = b12.toDec(shopData.ProductRealAmount);
      pkg.ShippingCharges = await b12.getshipingcharge(pkg.SPRID);
      pkg.VatPrecentage = await b12.getvatcharge(pkg.SPRID);
      pkg.PayblePurchaseTotal = pkg.PaybleAmount + pkg.ShippingCharges;
      pkg.VatAmount = (pkg.PaybleAmount * pkg.VatPrecentage) / 100;
      ReturnValue = await b12.PinCodeCheckAvalibility(UtilityClass.Encryptword(String(pkg.SPRID)), RegNo);
      pkg.PinCodeAvailability = String(ReturnValue[0]);
      pkg.IsStockCount = await b12.GetStockCount(Number(pkg.SPRID));
      pkg.DAP = b12.toDec(shopData.DAP);
      pkg.listproductdetails = await getSelectedAttr(shopData.SPRID);
      if (ReturnValue[1] === null || ReturnValue[1] === undefined) throw NRE();
      if (String(ReturnValue[1]) !== '') {
        ps.setCookie(res, 'pincode', String(ReturnValue[1]), { req });
      }
      pkg.TotalAmount += pkg.PayblePurchaseTotal;
      pkg.TotalShipping += pkg.quantity * pkg.ShippingCharges;
      pkg.TotalVatAmount += pkg.VatAmount;
      pkg.GrandTotal += pkg.PayblePurchaseTotal + (pkg.quantity * pkg.ShippingCharges) + pkg.VatAmount;
      pkgorder.push(pkg);
    }
  }
  // JavaScriptSerializer.Serialize(pkgorder) then Json(string) => a JSON string containing JSON
  res.json(JSON.stringify(pkgorder));
}));

// ---------------------------------------------------------------- getSelectedAttr(Int64 SPRID)
// PORT-NOTE: public non-action-result method => MVC returned Content(list.ToString()); reproduced literally.
// public
router.all(`${C}/getSelectedAttr{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  if (req.p.SPRID === undefined || req.p.SPRID === null || req.p.SPRID === '') {
    throw new Error("The parameters dictionary contains a null entry for parameter 'SPRID' of non-nullable type 'System.Int64'.");
  }
  await getSelectedAttr(intP(req.p.SPRID));
  res.type('text/html').send('System.Collections.Generic.List`1[productdetails]');
}));

// ---------------------------------------------------------------- Index()  [DistributerSessionExpireCheck] = no check
// public
// route-config: "proceed-to-checkout" -> Proceed_To_CheckOut/Index
router.all([C, `${C}/Index{/:id}`, '/portal/proceed-to-checkout'], ps.DistributerSessionExpireCheck, asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.masterpageshow = masterPageShow(req);
  if (ps.sessionGet(req, 'AffiliateUserId') != null) {
    if (ps.isCustomer(req)) {
      await saveReferral(req, 1, 'Clicked On Buy', 1, '');
    }
  }
  const pin = ps.parseCookies(req).pincode;
  if (pin !== undefined) {
    ViewBag.PinCode = String(pin);
  }
  res.json({ view: '~/Views/proceed_to_checkout/Index.cshtml', ViewBag });
}));

// ---------------------------------------------------------------- GetJcAndIWalletDetails(...)
const Z = '0.00000000~0.00000000~0.00000000~0.00000000~';
const TAIL = '~0123456789~12345';
const pad = (m, n) => Z + m + ' '.repeat(n) + TAIL;
// auth (legacy: Session["PLID"] == null => fixed "Session Expired" string)
router.all(`${C}/GetJcAndIWalletDetails{/:id}`, ...ps.customerOr(pad('Session Expired Please Refresh Page', 30)), asyncHandler(async (req, res) => {
  const Mode = intP(req.p.Mode, 0);
  const UserName = strP(req.p.UserName, '');
  const TransactionPassword = strP(req.p.TransactionPassword, '');
  const JC = numP(req.p.JC, 0);
  const IWallet = numP(req.p.IWallet, 0);
  const CallingType = intP(req.p.CallingType, 0);
  if (CallingType === 0) {
    return res.json(pad('Invalid Call', 53));
  }
  const DistributorID = parseInt(config.app.DistributerID || '0', 10) || 0;
  const PLID = Math.trunc(Number(req.user.plid));
  let Ewallet = '0.00'; let Coinwallet = '0.00'; let Commition = '0.00'; let PointWallet = '0.00';
  let StrMessage = ''; let Mobile = ''; let OTP = '';
  const rows = await db.proc(DB, 'usp_distributordiscount', {
    distributorid: DistributorID, mode: Mode, plid: PLID, username: UserName, transactionpassword: TransactionPassword,
    jc: JC, iwallet: IWallet, callingtype: CallingType,
  });
  // PostgreSQL port: when the proc only returns its OUT parameter (no wallet rows), the single row carries just "stroutput".
  const outOnly = rows.length === 1 && !Object.prototype.hasOwnProperty.call(rows[0], 'ewalletconsumeper');
  const list = outOnly ? [] : rows;
  for (const Items of list) {
    Ewallet = csNum(Items.ewalletconsumeper);
    Coinwallet = csNum(Items.coinwalletconsumeper);
    Commition = csNum(Items.commissionwalletconsumeper);
    PointWallet = csNum(Items.pointredeempercent);
    StrMessage = csNum(Items.stroutput);
    Mobile = csNum(Items.mobile);
    OTP = csNum(Items.otp);
  }
  if (list.length === 0) {
    StrMessage = outOnly ? csNum(rows[0].stroutput) : '';
  }
  if (StrMessage.toLowerCase() !== 'success') {
    return res.json(`${Z}${StrMessage}${' '.repeat(45)}${TAIL}`);
  }
  if (CallingType === 1 && Mode === 2) {
    if (Mobile !== '' && OTP !== '') {
      background(() => UtilityClass.SendMsgOnMobile(Mobile, `You have JC wallet request from :${UserName === null ? '' : UserName}\r\nJC wallet amount :${JC}\r\nOTP :${OTP}\r\nThe Cryptoinbox Team`));
    }
  }
  if (CallingType === 1 && Mode === 3) {
    if (Mobile !== '' && OTP !== '') {
      background(() => UtilityClass.SendMsgOnMobile(Mobile, `You have I wallet request from :${UserName === null ? '' : UserName}\r\nI wallet amount :${IWallet}\r\nOTP :${OTP}\r\nThe ${CompanySettings.CompanyName} Affiliate Team`));
    }
  }
  if (Mode === 2 && JC <= 0) {
    return res.json(pad('JC Point Is Invalid', 46));
  } else if (Mode === 3 && IWallet <= 0) {
    return res.json(pad('Net Payable Balance Is Invalid', 46));
  }
  if (Mode === 2 && Number(PointWallet) < JC) {
    return res.json(pad('Insufficient JP Point In Your Wallet', 46));
  }
  if (Mode === 3 && Number(Ewallet) < IWallet) {
    return res.json(pad('Insufficient I-Wallet Balance In Your Wallet', 46));
  }
  // PORT-NOTE (legacy, kept): the OTP is returned to the browser in the result string.
  const FinalResult = `${Ewallet}~${Coinwallet}~${Commition}~${PointWallet}~${StrMessage}~${Mobile}~${OTP}`;
  return res.json(FinalResult);
}));

// ---------------------------------------------------------------- Ordersadd(...)
// auth (legacy: Session["Plid"] == null => "Session Expired Please Refresh Page ")
router.all(`${C}/Ordersadd{/:id}`, ...ps.customerOr('Session Expired Please Refresh Page '), asyncHandler(async (req, res) => {
  const paymode = strP(req.p.paymode);
  const IsCouponApplyed = intP(req.p.IsCouponApplyed, 0);
  const USERNAME = strP(req.p.USERNAME, '');
  const TRANSACTIONPASSWORD = strP(req.p.TRANSACTIONPASSWORD, '');
  const SumBv = numP(req.p.SumBv, 0);
  const JP = numP(req.p.JP, 0);
  const netorder = numP(req.p.netorder, 0);
  const USERNAMEEWALLET = strP(req.p.USERNAMEEWALLET, '');
  const TRANSACTIONPASSWORDEWALLET = strP(req.p.TRANSACTIONPASSWORDEWALLET, '');
  const stockistname = strP(req.p.stockistname, '');
  const SumCashback = strP(req.p.SumCashback, '');
  // CaptchaCode / CheckoutSPRID are bound but unused in the active C# code.

  let ret = 'ok';
  let successurl = ''; let failureurl = ''; let inprocessurl = ''; let canceledurl = '';
  try {
    let PMID = Number(CompanySettings.PMID) || 0;
    let LoginId = '';
    if (ps.sessionGet(req, 'LoginId') != null) LoginId = String(ps.sessionGet(req, 'LoginId'));
    void LoginId;
    if (PMID === 0) {
      CompanyMasterSettings.GetResellerData();
      PMID = Number(CompanySettings.PMID) || 0;
    }
    let ResellerWallet = 0;
    const rw = await db.queryOne(DB,
      'select coalesce(available_wallet, 0) as available_wallet from tbl_distributor_prepaid_setting where pmid = @PMID limit 1', { PMID });
    if (rw) ResellerWallet = b12.toDec(rw.available_wallet);
    if (ResellerWallet < 10000) {
      return res.json('insufficientfund^');
    }

    const Loginid = req.user.loginid;
    const PLID = Number(req.user.plid);
    let adrs = {}; // new CustomerAddress()
    const ml = await db.queryOne(DB, 'select * from tbl_customerlogin where clid = @PLID limit 1', { PLID });
    if (ml != null) {
      adrs = await db.queryOne(DB,
        "select * from ims_customeraddress where tousertype = 'Customer' and touserid = @PLID and isdefault = true limit 1", { PLID });
    }
    let newstringval = '';
    let Payamount = 0;
    const shoppingData = await b12.GetShoppingCartData(req);
    if (shoppingData != null && shoppingData.length > 0) {
      for (const shopData of shoppingData) {
        const po = {};
        po.SPRID = shopData.SPRID;
        po.quantity = Math.round(b12.toDec(shopData.quantity));
        po.ShippingCharges = await b12.getshipingcharge(shopData.SPRID);
        po.VatPrecentage = await b12.getvatcharge(shopData.SPRID);
        newstringval += `${po.SPRID}^${po.quantity}|`;
        Payamount = Payamount + b12.toDec(shopData.ProductRealAmount) + po.ShippingCharges;
        po.VatAmount = ((b12.toDec(shopData.ProductRealAmount) * po.quantity) * po.VatPrecentage) / 100;
        Payamount += po.VatAmount;
      }
    }
    newstringval = newstringval.trim().replace(/^\|+|\|+$/g, '').trim();
    if (newstringval === '') {
      return res.json('No product selected for Registration');
    }
    const Product = newstringval;
    if (netorder < 0) return res.json('Amount Can Not Be Less Than Zero.');
    if (netorder === 0) return res.json('Amount Can Not Zero.');

    let DID = 0;
    if (DID === 0) {
      CompanyMasterSettings.GetResellerData();
      DID = appDID();
    }
    DID = appDID();
    // legacy dereferenced ml / adrs while building the parameters (NullReferenceException => catch)
    if (ml == null || adrs == null) throw NRE();
    const mlName = (v) => (v === null || v === undefined ? '' : String(v));
    const row = await db.procOne(DB, 'usp_customer_make_order', {
      orderid: '',
      loginid: Loginid,
      product: Product,
      fname: `${mlName(ml.fname)} ${mlName(ml.lname)}`,
      lname: ml.lname,
      address11: adrs.shortaddress,
      towncity: adrs.cityname,
      postalcode: adrs.pincode,
      emails: ml.emailid,
      mobile: adrs.phoneno1 === '' ? ml.phone : adrs.phoneno1,
      paymode,
      paymentremark: '',
      ordertype: 'Purchase',
      sh_fname: '',
      sh_lname: '',
      sh_address11: '',
      sh_towncity: '',
      sh_postalcode: '',
      sh_emails: '',
      sh_mobile: '',
      distributorid: DID,
      iscouponapplyed: IsCouponApplyed,
      username: USERNAME,
      transactionpassword: TRANSACTIONPASSWORD,
      sumbv: SumBv,
      jp: JP,
      netorder,
      usernameewallet: USERNAMEEWALLET,
      transactionpasswordewallet: TRANSACTIONPASSWORDEWALLET,
      plid: PLID,
      stockistusername: stockistname,
      sumcashback: SumCashback,
    });
    const out = row ? row.strresult : null;
    if (out === null || out === undefined) throw NRE(); // spOutput.Value.ToString()
    ret = String(out);
    const splitdata = ret.split('^');
    if (splitdata.length > 1) {
      if (splitdata[1].trim() === 'add') {
        const op = {
          Email: ml.emailid,
          mobile: ml.phone,
          name: `${mlName(ml.fname)}  ${mlName(ml.lname)}`,
          OrderId: splitdata[0],
          Payamount: String(Payamount),
          Product,
          Regno: PLID,
        };
        ps.sessionSet(req, 'PaymentForOrder', op);

        const Id = UtilityClass.Encryptword(splitdata[0].trim());
        ret = `add^${Id}`;
        ps.tempDataSet(req, 'TransIDOut', Id);
        const BASEURL = CompanySettings.CompanyREDIRECT;
        successurl = `${BASEURL}/secure-order-payment/payment-success`;
        failureurl = `${BASEURL}/secure-order-payment/payment-failed`;
        inprocessurl = `${BASEURL}/secure-order-payment/payment-inprocess`;
        canceledurl = `${BASEURL}/secure-order-payment/payment-cancel`;

        if (paymode === 'payumoney' && Id !== '' && Id !== null) {
          let paymentoutputResult = ''; let paymenttransactionID = '';
          const paySource = 'Checkout';
          const tempCheckOutOrderId = String(UtilityClass.Decryptword(String(Id)));
          const orderIdArray = tempCheckOutOrderId.split(',');
          if (orderIdArray.length < 2) throw new RangeError('Index was outside the bounds of the array.');
          const checkOutOrderId = orderIdArray[1];
          let PGAmount = 0;
          const pg = await db.queryOne(DB,
            'select coalesce(order_netamt, 0) as amt from tbl_order_master where orderid = @checkOutOrderId and loginid = @Loginid limit 1',
            { checkOutOrderId, Loginid });
          if (pg) PGAmount = b12.toDec(pg.amt);
          const r2 = await db.procOne(DB, 'usp_orderonlinerequests', {
            clid: PLID, amount: PGAmount, orderid: checkOutOrderId, source: paySource, successurl, failureurl, inprocessurl, cancelledurl: canceledurl,
          });
          if (!r2 || r2.stroutput === null || r2.stroutput === undefined) throw NRE();
          paymentoutputResult = String(r2.stroutput);
          if (r2.transactionid === null || r2.transactionid === undefined) throw NRE();
          paymenttransactionID = String(r2.transactionid);
          if (paymentoutputResult.toUpperCase() === 'SUCCESS' && paymenttransactionID !== '' && successurl !== '' && failureurl !== ''
            && inprocessurl !== '' && canceledurl !== '') {
            const BaseURL = String(config.app.PaymentURL || '');
            if (ps.sessionGet(req, 'AffiliateUserId') != null) {
              if (ps.isCustomer(req)) {
                await saveReferral(req, UtilityClass.ReferralStatus.proceed, 'Clicked Proceed To Payment', 2, splitdata[0].split(',').join(''));
              }
            }
            if (ResellerWallet >= 10000) {
              const E = (s) => UtilityClass.Encryptword(s);
              const Url = `${BaseURL}Home?refrenceid=${E(paymenttransactionID)}&successurl=${E(successurl)}&failureurl=${E(failureurl)}`
                + `&inprocessurl=${E(inprocessurl)}&canceledurl=${E(canceledurl)}&source=${E('Checkout')}&PMID=${E(String(PMID))}`;
              return res.json(`${ret}^${Url}`);
            }
          } else {
            const Url = '/page-not-found';
            return res.json(Url);
          }
        }

        if (paymode !== 'payumoney') {
          background(async () => {
            if (op.mobile !== '') {
              await UtilityClass.SendMsgOnMobile(op.mobile, `Dear ${op.name},\r\nYour order ${op.OrderId} has been successfully placed and we have send an email with complete information.\r\nThank you for shopping with us, \r\nThe ${CompanySettings.CompanyName} Team`);
            }
          });
          // PORT-NOTE: legacy foreground Thread (an exception there crashed the worker); here errors are only logged.
          background(() => SendMailconfirmation(req, Id));
        }
      }
    }
  } catch (ex) {
    try { await UtilityClass.TrackError(String(ex.message)); } catch (_) { /* ignore */ }
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- Getstockistuser(string username)
// public (no session check in legacy). Legacy comment: proc exists only in the "Kya Bol" franchise database.
router.all(`${C}/Getstockistuser{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const username = strP(req.p.username);
  if (username === null) throw NRE();
  const row = await db.procOne(DB, 'usp_getstockistrequest', { username: String(username) });
  const v = row ? row.intresult : null;
  if (v === null || v === undefined) throw new TypeError('Object cannot be cast from DBNull to other types.');
  res.json(Number(v));
}));

// ---------------------------------------------------------------- SignUpNow(password, mobileNo, verificationCode)
// public (registration)
router.all(`${C}/SignUpNow{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const password = strP(req.p.password);
  let mobileNo = strP(req.p.mobileNo);
  let email = '';
  let distributionid = 0;
  if (mobileNo !== '' && mobileNo !== null && mobileNo.includes('@')) {
    email = mobileNo;
    mobileNo = '';
  }
  const ip_address = GetIP.GetLocalIP(req);
  // Request.Cookies["Referrelcode"] was read into a local that is never used.
  const validate_Var = await DAL_RegistrationOrLogin.validate(email, '', password);
  if (distributionid === 0) {
    CompanyMasterSettings.GetResellerData();
    distributionid = appDID();
    if (distributionid === 0) distributionid = 1;
  }
  distributionid = appDID();
  if (validate_Var !== 'ok') {
    return res.json(validate_Var);
  }
  if (ps.sessionGet(req, 'CountryName') == null) {
    return res.json('expired');
  }
  const currency = CurrencyOf(req);
  const country = String(ps.sessionGet(req, 'CountryName'));
  const IntOutPutResult = await DAL_RegistrationOrLogin.CheckOutRegistration('', email, password, currency, country, '', ip_address, mobileNo,
    distributionid, '', 0, '', '', '', '', req);
  if (IntOutPutResult === '1') {
    const Vcode = nextRandom(100000, 555555);
    ps.tempDataSet(req, 'Vcode', Vcode);
    ps.sessionSet(req, 'VerificationCodeForMobile', Vcode);
    background(async () => {
      if (email !== '') {
        const Mailcontent = `Dear Sir/ Ma’am,<br />Your Verification code is <b>${Vcode}</b>. Please enter the Verification code to complete your registration with ${CompanySettings.CompanyName}. Don’t share this with anyone for security reasons! This code valid for one time only. <br/>The ${CompanySettings.CompanyName} Team`;
        await SendMail.Send1('', email, '', '', 'Verification Code', Mailcontent);
      }
      if (mobileNo !== '') {
        await UtilityClass.SendMsgOnMobile(mobileNo, `Verification Code:${Vcode} Please Use This Verification Code For Activate Your Account.Thank you.\r\nThe ${CompanySettings.CompanyName} Team`);
      }
    });
    return res.json('success');
  } else if (IntOutPutResult === '2') {
    return res.json('This Mobile No or Email Id Already Exist');
  } else if (IntOutPutResult === '5') {
    return res.json('User Name Already Exist.');
  } else if (IntOutPutResult === '6') {
    return res.json('This Mobile Number is Already Exist.');
  }
  return res.json('Failed');
}));

// ---------------------------------------------------------------- Resendotp(email, MobileNo, VerificationCode)
// public (OTP)
router.all(`${C}/Resendotp{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const email = strP(req.p.email);
  const MobileNo = strP(req.p.MobileNo);
  const Vcode = nextRandom(100000, 555555);
  ps.tempDataSet(req, 'Vcode', Vcode);
  ps.sessionSet(req, 'VerificationCodeForMobile', Vcode);
  background(async () => {
    if (email !== '') {
      const Mailcontent = `Dear Sir/ Ma’am,<br />Your Verification code is <b>${Vcode}</b>. Please enter the Verification code to complete your registration with ${CompanySettings.CompanyName}. Don’t share this with anyone for security reasons! This code valid for one time only. <br/>The ${CompanySettings.CompanyName} Team`;
      await SendMail.Send1('', email, '', '', 'Verification Code', Mailcontent);
    }
    if (MobileNo !== '') {
      await UtilityClass.SendMsgOnMobile(MobileNo, `Verification Code:${Vcode} Please Use This Verification Code For Activate Your Account.Thank you.\r\nThe ${CompanySettings.CompanyName} Team`);
    }
  });
  return res.json('success');
}));

// ---------------------------------------------------------------- ValidateMobile(UserName, EmailId, MobileNo)
// public (OTP). PORT-NOTE (legacy, kept): the verification code is returned in the response.
router.all(`${C}/ValidateMobile{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const t = (v) => { const s = strP(v); if (s === null) throw NRE(); return s.trim(); };
  const UserName = t(req.p.UserName);
  const EmailId = t(req.p.EmailId);
  const MobileNo = t(req.p.MobileNo);
  const row = await db.procOne(DB, 'usp_verificationcode', { username: UserName, emailid: EmailId, mobileno: MobileNo });
  const IntOutPutResult = row && row.intresult !== null && row.intresult !== undefined ? String(row.intresult) : '';
  const VerificationCodeForMobile = row && row.verificationcode !== null && row.verificationcode !== undefined ? String(row.verificationcode) : '';
  ps.sessionSet(req, 'VerificationCodeForMobile', VerificationCodeForMobile);
  if (IntOutPutResult === '1') {
    background(() => UtilityClass.SendMsgOnMobile(MobileNo, `Verification Code:${VerificationCodeForMobile} Please Use This Verification Code For Verify Your Mobile No.`));
    return res.json(`1^Verification code sent to ^${VerificationCodeForMobile}`);
  } else if (IntOutPutResult === '2') {
    return res.json(`2^Email Id Already Exist.^${VerificationCodeForMobile}`);
  } else if (IntOutPutResult === '5') {
    return res.json(`5^User Name Already Exist.^${VerificationCodeForMobile}`);
  } else if (IntOutPutResult === '6') {
    return res.json(`6^This Mobile Number is Already Exist.^${VerificationCodeForMobile}`);
  }
  return res.json(`0^Some Error Occur Here.^${VerificationCodeForMobile}`);
}));

// ---------------------------------------------------------------- UpdateStatus(password, VerificationCode, Mobile)
// public (registration OTP verification)
router.all(`${C}/UpdateStatus{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const password = strP(req.p.password);
  const VerificationCode = strP(req.p.VerificationCode);
  const Mobile = strP(req.p.Mobile);
  pass = password;
  userid = Mobile;
  let distributionid = 0;
  if (distributionid === 0) {
    CompanyMasterSettings.GetResellerData();
    distributionid = appDID();
    if (distributionid === 0) distributionid = 1;
  }
  distributionid = appDID();
  ps.tempDataSet(req, 'MER-Loginid', Mobile);
  ps.tempDataSet(req, 'MER-password', password);
  let IsVerified = 0;
  let plid = 0;
  let stringret = '';
  if (VerificationCode !== '') {
    const sv = ps.sessionGet(req, 'VerificationCodeForMobile');
    if (VerificationCode !== (sv === null || sv === undefined ? '' : String(sv))) {
      IsVerified = 0; // TempData.Keep(): values stay until read anyway
    } else {
      IsVerified = 1;
    }
  }
  try {
    if (IsVerified === 1) {
      const tp = ps.sessionGet(req, 'TempPLID');
      plid = tp === null || tp === undefined ? 0 : Math.round(Number(tp)); // Convert.ToInt32
      if (!Number.isFinite(plid)) throw new Error('Input string was not in a correct format.');
      const row = await db.procOne(DB, 'usp_checkoutuserregister_update', { plid, password1: password, distributerid: distributionid });
      stringret = row && row.intresult !== null && row.intresult !== undefined ? String(row.intresult) : '';
      const mx = row ? row.maxplid : null;
      if (mx === null || mx === undefined || !Number.isFinite(Number(mx))) throw new Error('Input string was not in a correct format.');
    } else {
      stringret = 'Invalid verification code';
    }
    return res.json(stringret);
  } catch (ex) {
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- CheckUserExists(LoginID)
// public (pre-login lookup)
router.all(`${C}/CheckUserExists{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const LoginID = strP(req.p.LoginID);
  let DistributorId = 0;
  if (DistributorId === 0) {
    CompanyMasterSettings.GetResellerData();
    DistributorId = appDID();
    if (DistributorId === 0) DistributorId = 1;
  }
  try {
    let Isexist = 0;
    const row = await db.procOne(DB, 'usp_get_resellersetting', { did: DistributorId });
    const o = row ? row.output : null;
    const s = o === null || o === undefined ? '' : String(o).trim();
    if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
    Isexist = Number(s);
    if (Isexist === 1) {
      const L = LoginID === null ? '' : LoginID;
      Isexist = Number(await db.scalar(DB,
        'select count(1) from tbl_customerlogin where did::text = @did and (phone = @L or emailid = @L or username = @L)',
        { did: String(DistributorId), L })) || 0;
    } else {
      Isexist = 3;
    }
    return res.json(Isexist);
  } catch (ex) {
    return res.json('Error');
  }
}));

// ---------------------------------------------------------------- SignIn(LoginID, Password, OTP="", LoginWithOTP=0, ForgetPassword=0, DID=1)
// public (login; issues the customer token)
router.all(`${C}/SignIn{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const LoginID = strP(req.p.LoginID);
  let Password = strP(req.p.Password);
  const OTP = strP(req.p.OTP, '');
  const LoginWithOTP = intP(req.p.LoginWithOTP, 0);
  const ForgetPassword = intP(req.p.ForgetPassword, 0);
  let DID = intP(req.p.DID, 1);
  DID = Number(CompanySettings.DID) || 0;
  if (DID === 0) {
    CompanyMasterSettings.GetResellerData();
    DID = Number(CompanySettings.DID) || 0;
  }
  let ReturnOutPut = '0';
  let sessionLogin; // undefined = Session["Plid"] untouched, null = cleared, object = logged in
  const sessCode = () => { const v = ps.sessionGet(req, 'VerificationCodeForMobile'); return v === null || v === undefined ? '' : String(v); };
  const L = LoginID === null ? '' : LoginID;

  if (LoginWithOTP === 1) {
    if (OTP !== '') {
      if (OTP === sessCode()) {
        if (Password === null) Password = '';
        const ip = GetIP.GetLocalIP(req);
        // legacy precedence kept: PHONE = x OR (EMAILID = x AND ACTIVE = 1)
        const pr = await db.queryOne(DB, 'select password from tbl_customerlogin where phone = @L or emailid = @L and active = true limit 1', { L });
        Password = pr ? pr.password : null;
        const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip, DID);
        if (ObjLogin == null) {
          sessionLogin = null;
          ReturnOutPut = '0';
        } else {
          ReturnOutPut = '1';
          sessionLogin = ObjLogin;
        }
      } else {
        ReturnOutPut = '2';
      }
    }
  }

  if (ForgetPassword === 1 && Password !== '') {
    if (OTP !== '') {
      if (OTP === sessCode()) {
        if (Password === null) Password = '';
        const ip = GetIP.GetLocalIP(req);
        if (LoginID === null) throw NRE();
        if (LoginID.includes('@')) {
          await db.exec(DB, 'update tbl_customerlogin set password = @Password where emailid = @LoginID', { Password, LoginID });
        } else {
          await db.exec(DB, 'update tbl_customerlogin set password = @Password where phone = @LoginID', { Password, LoginID });
        }
        const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip, DID);
        if (ObjLogin == null) {
          sessionLogin = null;
          ReturnOutPut = '0';
        } else {
          ReturnOutPut = '1';
          sessionLogin = ObjLogin;
        }
      } else {
        ReturnOutPut = '3';
      }
    }
  }

  if (LoginWithOTP === 0 && ForgetPassword === 0) {
    const ip = GetIP.GetLocalIP(req);
    const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip, DID);
    if (ObjLogin != null) {
      ReturnOutPut = '1';
      sessionLogin = ObjLogin;
      // username = ObjLogin.Name; logintype = Session["LoginType"]  (locals, unused)
    }
  }
  const out = { ReturnOutPut };
  if (sessionLogin) out.token = ps.issueCustomerToken(sessionLogin, req);
  else if (sessionLogin === null) ps.sessionRemove(req, 'Plid');
  return res.json(out);
}));

// ---------------------------------------------------------------- AutoSignIn(int DID = 1)
// public (login after registration; token in x-auth-token header since the body is a bare string)
router.all(`${C}/AutoSignIn{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  intP(req.p.DID, 1); // bound, unused
  let distributionid = 0;
  if (distributionid === 0) {
    CompanyMasterSettings.GetResellerData();
    distributionid = appDID();
    if (distributionid === 0) distributionid = 1;
  }
  distributionid = appDID();
  const pass1 = pass;
  const userid1 = userid;
  let ReturnOutPut = '1';
  const ip = GetIP.GetLocalIP(req);
  const LoginID = userid1;
  const Password = pass1;
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(LoginID, Password, ip, distributionid);
  if (ObjLogin == null) {
    ps.sessionRemove(req, 'Plid');
    ReturnOutPut = '0';
  } else {
    ReturnOutPut = '1';
    res.setHeader('x-auth-token', ps.issueCustomerToken(ObjLogin, req));
  }
  return res.json(ReturnOutPut);
}));

// ---------------------------------------------------------------- CheckoutSendOTP(MobileNo = "")
// public (OTP)
router.all(`${C}/CheckoutSendOTP{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const MobileNo = strP(req.p.MobileNo, '');
  const Vcode = nextRandom(100000, 555555);
  ps.sessionSet(req, 'VerificationCodeForMobile', Vcode);
  background(async () => {
    if (MobileNo.includes('@')) {
      const Mailcontent = `Dear Sir/ Ma’am,<br />Your Verification code is <b>${Vcode}</b>. Please enter the Verification code to complete your registration with ${CompanySettings.CompanyName}. Don’t share this with anyone for security reasons! This code valid for one time only. <br/>The ${CompanySettings.CompanyName} Team`;
      await SendMail.Send1('', MobileNo, '', '', 'Verification Code', Mailcontent);
    }
    if (MobileNo !== '') {
      await UtilityClass.SendMsgOnMobile(MobileNo, `Verification Code:${Vcode} Please Use This Verification Code For Activate Your Account.Thank you.\r\nThe ${CompanySettings.CompanyName} Team`);
    }
  });
  return res.json('1');
}));

module.exports = router;
