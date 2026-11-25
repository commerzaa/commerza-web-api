# ClusterofferShopingPortal: Session -> JWT / sessionStore contract

Source: every `Session[...]`, `TempData[...]`, `Session.SessionID`, `Session.Remove`, cookie and action filter in
`C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\` (Controllers, Controllers\CustomerPanel,
Controllers\UserPanel, Models, DAL, Global.asax.cs, Views\Shared). Database `Db_Shopping` => `'shopping'`.
Every portal controller port (`src/modules/portal/*.js`, routes `/portal/...`) MUST follow this file literally.
Helpers: `require('./_shared/portal-session')`. Never call `src/utils/sessionStore` directly from a portal module.

## 0. Facts that drive the design
* There is ONE identity in the whole app: `Session["Plid"]`, a `Login` object (`Models/LoginRegistration.cs`), filled by
  `USP_PORTALLOGIN_M_CUSTOMER` / `USP_SOCIAL_LOGINCHECK` from `TBL_CUSTOMERLOGIN`. **`Login.Plid` is the customer CLID.**
  CustomerPanel, UserPanel and the merchant pages inside CustomerPanel (Add_Product, Manage_Products, Merchant_*) all use the
  same `Session["Plid"]`. So there is ONE userType: **`'customer'`**. No separate merchant/user type.
* ASP.NET session keys are **case-insensitive**: `Session["Plid"]`, `Session["PLID"]`, `Session["plid"]` are the same entry
  (likewise `Cart`/`cart`, `COUNTRYID`/`countryid`, `COUNTRYNAME`/`CountryName`/`countryName`, `Captcha`/`captcha`, `optid`/`Optid`).
  The helpers lower-case keys, so pass the legacy spelling verbatim.
* The session existed BEFORE login and continued AFTER it (cart, OTP, captcha, `TempPLID`, `LoginType`, `FavoriteURL`) and its
  `Session.SessionID` is written to the DB (cart `USP_GETSHOPPINGCARTITEMS @CLID,@SESSIONID`, recently viewed items, `Adview`...).
  Therefore non-identity data is keyed by a **portal session id**, not by the login: `getSid(req)` (24 chars `[a-z0-5]`, ASP.NET
  format). Resolution: token claim `sid` > header `x-session-id` > cookie `ASP.NET_SessionId` > newly generated. Every helper
  middleware below echoes it back (`x-session-id` response header + HttpOnly cookie `ASP.NET_SessionId`). Clients must resend it.
* customer-auth.js (`/api/CustomerSignIn`) tokens `{ plid: clid, clid, userName, userType: 'customer' }` are accepted on every
  portal route; the missing Login claims are filled from `TBL_CUSTOMERLOGIN` by the middleware (`hydrateCustomer`).

## 1. Protecting a route (which middleware)

```js
const ps = require('./_shared/portal-session');
// auth
router.all('/portal/Address/Index{/:id}', ps.customerAuth, asyncHandler(async (req, res) => { ... }));
// auth
router.post('/portal/Cart_List/GetCart', ...ps.customerOr('error^loginrequired'), asyncHandler(...));
// public
router.all('/portal/Home/Index{/:id}', ps.portalSession, asyncHandler(...));
```

| Legacy pattern | Middleware |
|---|---|
| `[SessionExpireCheck]` (Add_Product.cs: `Session["Plid"]==null` -> `Redirect("~/")`) | `ps.customerAuth` (alias `ps.SessionExpireCheck`) |
| `if (Session["Plid"] == null) return RedirectToAction("Index","Home")` (97x) / `Redirect(...)` / `return null` / `return View(...)` | `ps.customerAuth` (401 JSON from `auth`) |
| Action casts `(Login)Session["Plid"]` with no null check (legacy NullReferenceException) | `ps.customerAuth` |
| `if (Session["Plid"] == null) return Json("<text>")` (`"error^loginrequired"` 27x, `"expired"` 12x, `"error^This page has been expired, Please login again"`, `"Session Expired. Please login again"`, `"login"` ...) | `...ps.customerOr('<exact legacy value>')` (status 200, body = that value). Use the exact string/typo of THAT action. |
| Session optional (`if (Session["Plid"] != null) { CLID = ... }` else anonymous path), or any action that touches other `Session[...]`/`TempData`/`Session.SessionID` | `ps.portalSession` (never rejects; `req.user` set if a valid token was sent) |
| `[DistributerSessionExpireCheck]`, `[CheckResellerTimeout]` | bodies are commented out in legacy => no check: `ps.portalSession` (aliases exported). Do not add auth because of them. |
| Payment/recharge gateway return URLs that read `Session["Plid"]` / `PaymentForOrder` / `Rech*` (OnlineOrderResponse, Online*RechargeResponse, OrderComplete, OnlinePayment, IPN...) | `ps.callbackSession` (identity from the server-side Login snapshot of the session cookie, never rejects; keep the legacy null-session branch) |

`ps.portalSession`, `ps.customerAuth`, `ps.callbackSession` are arrays (pass directly or spread); `ps.customerOr(...)` returns an array (spread it).

## 2. Identity values (JWT, `req.user`)

| Legacy expression | Use in JS | Notes |
|---|---|---|
| `((Login)Session["Plid"]).Plid` (also via `"PLID"`/`"plid"`) | `req.user.plid` | = CLID (number). 415 uses. `req.user.clid` is the same value. |
| `.LoginID` / `.LOGINID` | `req.user.loginid` | |
| `.DID` | `req.user.did` | distributor id of the login (NOT `Session["DID"]`, see 3) |
| `.Name` | `req.user.name` | `FNAME + ' ' + LNAME` (trailing space kept, as the proc) |
| `.UserName` | `req.user.username` | `ISNULL(USERNAME, LOGINID)`. (`req.user.userName` = same, customer-auth compat) |
| `.Cid` | `req.user.cid` | |
| `.Pmid` | `req.user.pmid` | |
| `.Smdid` | `req.user.smdid` | |
| `.EmailId` | `req.user.emailid` | **always null**: the login procs do not return EMAILID. Keep legacy behaviour (e.g. VisitorSignup/Logout passes null). |
| `.SecretCode` | n/a (null) | `[NotMapped]`, never set |
| whole object `(Login)Session["Plid"]` | `ps.getCustomerLogin(req)` | PascalCase `Login` rebuilt from claims; `null` if no customer session |
| `Session["Plid"] == null` / `!= null` / `!= ""` / `!= "0"` | `!ps.isCustomer(req)` / `ps.isCustomer(req)` | |
| `Convert.ToInt64(Session["Plid"])` style (whole object converted) | legacy threw InvalidCastException -> reproduce the action's catch branch | |

Claims in every portal token: `plid, clid, pmid, smdid, loginid, username, userName, name, emailid, cid, did, userType:'customer',
src:'portal', sid, sub:String(plid)`. Values are those of the Login object at login time.

## 3. Non-identity values (server side: `ps.sessionGet(req, key)` / `ps.sessionSet(req, key, value)` / `ps.sessionRemove(req, key)`)

Use the legacy key verbatim (case does not matter). Missing => `null` (legacy `null`). `sessionSet(req, key, null)` == `Session[key] = null` == `Session.Remove(key)`.
Write values with the same type the C# stored (string vs number vs object), because readers do `Convert.ToX`/`.ToString()`.

### 3.1 Keys that are written in active code
| Session key | Writers | Remark |
|---|---|---|
| `Cart` | Login_as_Mobile, Logout, OnlineOrderResponse, OrderComplete, Product_Detail, UserPanel/Proceed_To_Payment | string, `|`-separated (`""` vs `null` differ!) |
| `ManageCart` | Login_as_Mobile, Product_Detail (`Session.Add("ManageCart","SyncCart")`) | `sessionSet` |
| `BuyNow` | Login_as_Mobile | `true` / null |
| `PaymentForOrder` | AddFund, PayItForward, PurchasePackage, SubscribeUs, EVouchersDetails, Proceed_To_CheckOut (read by MakePayment*, Proceed_To_Payment, gateway responses) | object (`OrderPayment` / `PaymentForAddFund` / `OnlinePaymentForPackage`), store the PascalCase object |
| `MobileNo`, `RechOpCode`, `RechOpName`, `RechOpService`, `RechAmount`, `StrTransactionId`, `RechDOB` | *_Payment, servicejewaria, All_RechargeService_from_mobile | read by Online*RechargeResponse (use `callbackSession`) |
| `errormessagemobile` | All_RechargeService_from_mobile | read by AllServiceJewaria/appRechargefailureurl |
| `LoginwithMobile` | Login_as_Mobile (`"MobileLogin"`), Link_ForAnroid (`"LoginMobile"`) | many CustomerPanel actions set `ViewBag.masterpageshow` from it |
| `LoginType` | VisitorSignup visitor_login/referrel_login/customer_login (1/2/3) | pre-login, read after login (SignIn response `logintype`) |
| `FavoriteURL` | VisitorSignup, BusinessDetails (null), Views/Home/Index (null) | |
| `OTP` | MLMWallet, TransferToBank, TransferToBank_mobile | never return it unless the legacy did |
| `VerificationCodeForMobile` | VisitorSignup, Proceed_To_CheckOut | same |
| `Mobilevcode`, `Emailvcode` | UserPanel/Member_Profile | read by CommonController too |
| `MobileOTP` | never written | CommonController check is always false |
| `vcodePosting` | ClassifiedAds VerifyNewAd | |
| `Captcha` | Proceed_To_CheckOut Captcha() | |
| `IsMobileUpdateProceed` | My_Profile | |
| `TempPLID` | `DAL_RegistrationOrLogin.Registration / VisitiorRegistration / CheckOutRegistration` (lib, via HttpContext) | read by VisitorSignup/Proceed_To_CheckOut UpdateStatus via `ps.sessionGet(req,'TempPLID')`. Written by the lib (see 6: controllers pass `req` as extra last argument). |
| `reviewPMID`, `reviewDEALID` | BusinessDetails, Product_Detail, DealsDetails | read by CommonController |
| `AffiliateUserId` | Product_Detail | read by Proceed_To_CheckOut |
| `RefrenceId`, `Source`, `OrderId` | OnlinePayment | |
| `PlidSurfing` | SurfNow | |
| `SelectedCity`, `SearchedItem` | CommonController | |
| `RecentlyViewedItems` | Product_Detail | |
| `RecentlyViewedProducts` | Global.asax timer (no HttpContext there -> threw and was swallowed) | effectively never set |
| `WriteReviewTemp` | Product_Detail | object |
| `AccessToken` | VisitorSignup FacebookCallback | |
| `Afterlogout` | Logout | |
| `COUNTRYID`, `COUNTRYNAME`, `IPADDRESS`, `MASTERSESSION` | `GetCountry.InitializeVisitorCountrySession()` | port the call as `ps.initializeVisitorCountrySession(req)` (sets `"96"`, `"India"`, `"223.190.123.252"`, null). `GetCountry.SettingVisitor(sid)` body is fully commented out => no-op. Layout `_OuterSearchLayout` calls both when `COUNTRYID == null`; actions that read COUNTRYID without calling it keep the null branch. |

### 3.2 Keys that are only READ (all writers commented out) => always `null`, reproduce the null branch
`resellerDomain`, `ResellerLoginId`, `LoginId`, `DID` (Session key, not the Login property), `CURRENCYCODE`, `CountryName`/`countryName`
(note: same key as `COUNTRYNAME`, so it IS set once `initializeVisitorCountrySession` ran in this session), `Propertysessionofcountrystatecity`
(`VisitorLocation`; guarded reads skip, unguarded `.IPAddress` threw NullReferenceException), `member_master`, `Admin_User` (only in comments).
Read them with `ps.sessionGet` anyway (never hard-code null) so behaviour stays identical if a writer is added.

### 3.3 `Session["Plid"]` holding a `Portal_Login` (ClassifiedAds only)
`ClassifiedAds.AdPayment` / `PostAdConfirmation` put a `Portal_Login` row (affiliate member, not a customer) into `Session["Plid"]`;
`ClassifiedAds.Index` (line 62) and `PostNewAd` (line 397) cast it back. Port: `ps.setPortalLogin(req, row)` (no token issued) and
`ps.getPortalLogin(req)`. When `getPortalLogin` is null but `ps.isCustomer(req)` is true, legacy threw InvalidCastException
(a `Login` is not a `Portal_Login`) -> take that action's catch branch. PORT-NOTE in ClassifiedAds: the Portal_Login no longer
replaces the customer login for other pages.

### 3.4 `Session.SessionID`
`Session.SessionID` (Home, Product_Detail, Login_as_Mobile, AllOuterDeals, AllSellerList, BusinessList, DealsDetails, My_Profile,
NewsLetterSubscription, layouts) => `ps.getSid(req)`. Use the route middleware so the id is echoed back to the client.

### 3.5 `TempData[...]`
Session-backed and read-once in MVC (`Vcode`, `TransIDOut`, `Sent`, `Success`, `R1`, `R2`, `Error`, `AdID`, `ml`, `MER-Loginid`, ...).
`TempData[k] = v` -> `ps.tempDataSet(req,k,v)`; reading `TempData[k]` -> `ps.tempDataGet(req,k)` (removes it for later requests,
repeated reads in the same request still work); `TempData.Peek(k)` -> `ps.tempDataPeek(req,k)`. When the action ends in `return View()`
also put the TempData values it set into the JSON (MVC guide 1).

## 4. Login actions (must issue the token)

Every action that does `Session["Plid"] = ObjLogin` (a `Login`) must, on the non-null branch, call
`const token = ps.issueCustomerToken(ObjLogin, req);` and return it:
* object response (incl. `{ redirect: ... }` and ViewBag JSON) -> add a top-level `token` property;
* non-object response (bare string like `"success"`, array) -> keep the body unchanged and send `res.setHeader('x-auth-token', token)`.
  Do NOT also add `token` to the body in that case.
`issueCustomerToken` keeps the current portal session id (cart/OTP/TempPLID survive login) and stores the Login snapshot server-side.
`Session["Plid"] = null` on failure -> `ps.sessionRemove(req,'Plid')` and issue no token.

| Controller.Action | How ObjLogin is obtained |
|---|---|
| `VisitorSignup.SignIn`, `SignIn1`, `DirectSignIn`, `AutoLogin`, `GoogleSignIN`, `FacebookSignUpAndAutoLogin` | `DAL_RegistrationOrLogin.Login_Check` / `SocialLoginCheck` |
| `Proceed_To_CheckOut.SignIn`, `AutoSignIn` | same |
| `Login_as_sso.Index`, `Login_as_yourchoice.DirectSignIn` | same |
| `DirectLogin.Index` (encrypted clid), `OrderDirectLogin.Index`, `UserPanel/Orders.Index` (clid param), `Login_as_Mobile.Index` (clid,did) | `USP_PORTALLOGIN_M_CUSTOMER` direct |
| `CustomerPanel/Link_ForAnroid.*_ForAnroid` (14 actions), `CustomerPanel/All_RechargeService_from_mobile.*` (5 actions) | `Login_Check(phone, password, ip, did/PMID)`; they are reached by the Android app WebView without a token, keep them `// public` as legacy (PORT-NOTE: legacy auto-login by Clid, authentication check is hard-coded to 1) |

These login routes are `// public` (use `ps.portalSession` so pre-login session values are visible).

## 5. Logout
* `Logout.Index`: `ps.sessionRemove(req,'Plid')`, `ps.sessionSet(req,'Cart',null)`, `ps.sessionSet(req,'Afterlogout', resellerDomain)`,
  `ps.sessionRemove(req,'DID')`, then `res.json({ redirect: resellerDomain })`. The client drops its token.
* `VisitorSignup.Logout`: legacy removed `Plid` first and then read `.EmailId` (NullReferenceException swallowed by its catch) => the
  `USP_GetToken_logout` call never ran. Reproduce: remove, skip the proc, `res.json('Logout')`.
* `Session.Abandon()/Clear()` (only commented out in legacy) -> `ps.abandonSession(req)`.

## 6. Libs (DAL / Models) that touch the session
* `DAL_RegistrationOrLogin.Registration / VisitiorRegistration / CheckOutRegistration`: return value unchanged; the lib methods take an
  optional trailing `req` argument and call `require('../../modules/portal/_shared/portal-session').sessionSet(req,'TempPLID',TempPLID)`
  when `req` is given. Controllers always pass `req` as the extra last argument. (If the lib port lacks the `req` parameter, the
  controller fetches nothing extra: report it; do not re-implement the lib.)
* `UtilityClass` (line 1454, `Session["CURRENCYCODE"]`) and `GetCountry` (Country.cs): same rule, optional trailing `req`, use `ps.sessionGet/sessionSet`.
* Libs must never read `Session["Plid"]`; controllers pass `req.user.plid`.

## 7. Cookies
No `FormsAuthentication`, no `[Authorize]`. Cookies are plain UI state; port them 1:1 with the helpers:
* read: `ps.parseCookies(req)[name]`; multi-value cookie (`Request.Cookies["Products"]["product_id"]`): `ps.parseCookieValues(ps.parseCookies(req).Products).product_id`.
* write: `ps.setCookie(res, name, value, { expires })`; multi-value: `ps.setCookie(res, 'Products', null, { values: { product_id }, expires })`;
  expire: `ps.deleteCookie(res, name)`.
* Names used: `pincode` (Proceed_To_CheckOut, Product_Detail, Cart_List view), `Referrelcode` (VisitorSignup, Proceed_To_CheckOut,
  1 month), `comp` (Product_Detail compare list), `rece_view`, `Products` (`product_id`, 2 days), plus Product_Detail's generic
  cookie helper (line ~1576). The session cookie itself is `ASP.NET_SessionId` (managed by the helpers; do not write it).

## 8. Other helpers
`ps.legacyUrl(req)` = `"~" + Request.Url.AbsolutePath` without the `/portal` prefix. `ps.LOGIN_PROPS`, `ps.PORTAL_LOGIN_PROPS`,
`ps.VISITOR_LOCATION_PROPS` = C# property lists for `mapRows`. `ps.loadCustomerLogin(clid)` = Login row by CLID (Active=1) or null.
Do not edit `portal-session.js`; ask the coordinator for changes.
