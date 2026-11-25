# MLM_Adminpanel: Session -> JWT / sessionStore contract

Source: every `Session[...]` key in `C:\Users\MY ASUS\cluster\MLM_Adminpanel\Common\` (Controllers, BAL, Models, DAL, Views/Shared).
The login controllers (`adminlogin`, `adminloginwithOTP`, `Beta_Login`, `V4Admin/Login`) issue the JWT.
Every admin controller port MUST follow this file.

## 1. How to protect an admin route

```js
const { adminAuth, getAdminUser, legacyUrl } = require('./_shared/adminSession');
// auth
router.all('/admin/Foo/Index{/:id}', adminAuth, asyncHandler(async (req, res) => { ... }));
```

* `adminAuth` = `[auth, requireType('admin')]` (from `src/middleware/auth.js`). Use it for EVERY action that
  1. has `if (Session["Admin_User"] == null) return RedirectToAction(...)` / `Json("Session Expired...")`, or
  2. reads `Session["Admin_User"]` (cast to `Employee_Master`) anywhere (legacy would NullReference without a session), or
  3. is decorated with `[AdminSessionExpire]` (legacy filter in `adminloginController.cs`, redirect `~/Home`; `AdminSessionExpire` is exported too,
     it is the same as `adminAuth`).
* When the legacy action returned a specific JSON string on a missing session (e.g. `Json("Session Expired. Please login again")`)
  use `optionalAuth` + `if (!isAdmin(req)) return res.json('Session Expired. Please login again');` to keep the contract.
* Token claim `userType` is always `'admin'`.

## 2. Identity values (in the JWT, read from `req.user`)

`Session["Admin_User"]` is an `Employee_Master` row (+ NotMapped `LoginAs`, `IsStore`). Each property is a lower-case claim:

| Legacy expression | Use in JS | Notes |
|---|---|---|
| `((Employee_Master)Session["Admin_User"]).Emp_ID` | `req.user.emp_id` | int. The most used value (535 uses). |
| `.Emp_Code` | `req.user.emp_code` | |
| `.Emp_LoginID` | `req.user.emp_loginid` | |
| `.Emp_Name` | `req.user.emp_name` | |
| `.Emp_Email` | `req.user.emp_email` | |
| `.Emp_Mobile` | `req.user.emp_mobile` | |
| `.Emp_PanNo` | `req.user.emp_panno` | |
| `.Emp_Image` | `req.user.emp_image` | |
| `.TotalRoles` | `req.user.totalroles` | |
| `.Current_Balance` | `req.user.current_balance` | value at login time |
| `.CreateDate` | `req.user.createdate` | ISO string |
| `.Emp_LastLogin` | `req.user.emp_lastlogin` | ISO string (UTC, `UtilityClass.GetCurrentDate()`) |
| `.Active` / `.isDelete` | `req.user.active` / `req.user.isdelete` | |
| `.WHITELIST_IP` | `req.user.whitelist_ip` | |
| `.LOGINAVALIABLE_FROMTIME` / `_TOTIME` / `_ALLWAYS` | `req.user.loginavaliable_fromtime` / `req.user.loginavaliable_totime` / `req.user.loginavaliable_allways` | |
| `.LoginAs` | `req.user.loginas` | Branch type name (set at login; NOT set by the V4 `Login` controller, legacy left it null there) |
| `.IsStore` | `req.user.isstore` | bool (same remark as LoginAs) |
| `.Emp_Password` | **NOT in the token** | Encrypted password (reversible) must not travel in a readable JWT. Read it fresh: `await db.scalar('affiliate', 'select emp_password from tbl_employee_master where emp_id=@id', { id: req.user.emp_id })` (used by Package_Binary_Setting, ROIRate). |
| `.BrCode` | n/a | Only in commented-out code (Employee_Master has no BrCode). |
| `Session["Admin_User"] == null` | `!req.user \|\| req.user.userType !== 'admin'` (or just use `adminAuth`) | helper `isAdmin(req)` |
| whole object `(Employee_Master)Session["Admin_User"]` | `getAdminUser(req)` | returns a PascalCase `Employee_Master`-like object built from the token (no password) |

Extra claims: `userType: 'admin'`, `plid: <Emp_ID>` (**alias used ONLY so `src/utils/sessionStore.js` keys data per admin; it is
NOT a member PLID**, see section 4), `sub: '<Emp_ID>'`.

### Refreshing the session (`objUtil.UpdateAdminUserSession(Empid)` / `UtilityClass.UpdateAdminMenu(Empid)`)
~30 controllers do `Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid); Session["Admin_User_Menu"] = UtilityClass.UpdateAdminMenu(Empid);`.
Port as:
```js
const emp = await new UtilityClass().UpdateAdminUserSession(Empid);    // lib call (does the DB update of Emp_LastLogin)
const menu = await UtilityClass.UpdateAdminMenu(Empid);                  // lib call
sessionStore.set(req, 'Admin_User_Menu', menu);
out.token = issueAdminToken(emp);                                        // optional refreshed token in the response
```

## 3. Non-identity values (server side, `src/utils/sessionStore.js` -> `get(req, key)` / `set(req, key, value)`)

Use the legacy key name verbatim as the sessionStore key. `set(req, key, null)` == `Session[key] = null` / `Session.Remove(key)`.

| Session key | Written by | Read by | sessionStore key / remark |
|---|---|---|---|
| `Admin_User_Menu` (List<Admin_User_Menu>) | all login actions, `UtilityClass.UpdateAdminMenu` callers | `_AdminPanelLayout.cshtml`, AddProduct, add_product (`== null` check) | `'Admin_User_Menu'`. Too big for a JWT. Helper `await getAdminMenu(req)` returns the stored list or reloads it from `Usp_PickAdminUserRights` (Active==1) if the in-memory store was lost (restart). Login responses also return it as `Admin_User_Menu`. |
| `API_Menu` (List<API_Menu>) | V4 `Login` (AllowAccountToLogin) | views | `'API_Menu'` (also returned in the login response) |
| `SessionOTP` | Direct_Bonus_Setting, EwalletManagement, Fund_Management, Package_Binary_Setting, ROIRate, Unblock_Admin | same controllers | `'SessionOTP'`. **Never return the OTP in a response** unless the legacy action did. `Session.Remove("SessionOTP")` -> `set(req,'SessionOTP',null)`. Unblock_Admin is used pre-login? -> if the action is public, the key is per-IP (anon subject). |
| `GAKey`, `2FACode` | (Employee_Profile, set elsewhere / never in C#) | Employee_Profile | `'GAKey'`, `'2FACode'` |
| `TYPE`, `DATE` | Daily_*_Summary, EWallet_Summary_Detail, MoneyStaement_Summary_Detail | EWallet_Summary_Detail, MoneyStaement_Summary_Detail | `'TYPE'`, `'DATE'` |
| `FIMID`, `PrevURL` | Map_PinCode | Map_PinCode | `'FIMID'`, `'PrevURL'` |
| `OrderStatus`, `OrderPaymentStatus` | UploadOrderDetails, OrderPaymentConformation, OrderPaymentPending | same | `'OrderStatus'`, `'OrderPaymentStatus'` |
| `name`, `regno` | All_Member_List | All_Member_List (PDF) | `'name'`, `'regno'` |
| `RefNo` | Challan_Purchase_Bill | same | `'RefNo'` |
| `MySession` | Stock_LedgerController | same | `'MySession'` |
| `adminMasterLeftMenu` | CommonController | CommonController | `'adminMasterLeftMenu'` |
| `Latitude`, `longitude` | Change_Password_by_Admin, Franchaise_Change_Password | same | `'Latitude'`, `'longitude'` (exact casing) |
| `COUNTRYNAME`, `COUNTRYID`, `IPADDRESS`, `StateName`, `ZIPCODE` | Models/Country.cs (lib) | Country.cs | lib-internal; the lib takes `req` or returns them; key names verbatim |
| `STATENAME`, `CITYNAME`, `FRID`, `PLID` | only in commented-out code | - | skip |
| `member_master` / `Member_Master` (Member_Master_Custom) | **never set anywhere in the admin app** | Credit_Fund_by_Admin, Growth_Payout, Payout_Reports, Add_New_Referral, CommonController | always null in legacy: `== null` checks are TRUE (redirect branch), and `.regNo` dereferences threw NullReferenceException (-> the action's catch / 500). Reproduce that: `sessionStore.get(req,'member_master')` (undefined) - do NOT map to the admin token. |
| `Plid` (Login) | **never set in the admin app** | BulkUpload | same as above: legacy threw NullReferenceException. Do NOT use `req.user.plid` (that is the Emp_ID alias). |

## 4. Login-flow-only keys (pre-login, owned by the login controllers)

Before login there is no token, so `sessionStore` keys these by client IP (`anon:<ip>`). Only the login controllers use them:

| Session key | sessionStore key | Meaning |
|---|---|---|
| `countattent` | `'countattent'` | adminloginwithOTP attempts left (starts 3) |
| `vcode` | `'vcode'` | adminloginwithOTP verification code (OTP). Generated, stored, **never sent and never returned** (legacy never sent it either: no SMS/mail call exists; only `MasterCode` from config can satisfy VarifyOTP) |
| `loginid`, `Password` | `'loginid'`, `'Password'` | stored with the OTP, cleared after VarifyOTP |
| `FailCount` | `'FailCount'` | V4 Login attempts left (starts 5) |

`sessionStore` subject = `userType:plid|clid|did|ip`. Admin tokens carry `plid = Emp_ID`, so post-login values are per admin.
(Coordinator: consider adding `u.emp_id`/`u.sub` to `subject()` and dropping the plid alias.)

## 5. Logout
`adminlogin/Logout`, `adminloginwithOTP/Logout`, `Beta_Login/Logout` -> client drops the token; server clears `vcode`.

## 6. Permission check (BAL/CheckPermissions)
Legacy pattern (109 controllers use the BAL, ~145 inline the same SQL):
```cs
url = "~" + Request.Url.AbsolutePath;
CheckPermissions.GetPageActionPermission(url, Empid, out dl, out edit); ViewBag.isactive = dl; ViewBag.isedit = edit;
ViewBag.excelactive = CheckPermissions.GetExcelPermission(url);
```
Port as a plain call (not middleware; it never blocked the request, it only fed ViewBag):
```js
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const url = legacyUrl(req);                // '~' + path WITHOUT the '/admin' prefix, e.g. '~/AdminPanel/Admin-Login-Log-History'
const perm = await CheckPermissions.GetPageActionPermission(url, req.user.emp_id); // -> { _opIsDownloadAllowed, _opIsEditAllowed }
ViewBag.isactive = perm._opIsDownloadAllowed; ViewBag.isedit = perm._opIsEditAllowed;
ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
```
(`out` parameters are returned as an object with the C# parameter names; lib contract.)

## 7. Shared helpers available to every admin controller (`require('./_shared/adminSession')`)
`adminAuth`, `AdminSessionExpire`, `isAdmin(req)`, `getAdminUser(req)`, `legacyUrl(req)`, `getAdminMenu(req)`, `loadAdminMenu(empId)`,
`issueAdminToken(emp)` / `adminTokenPayload(emp)` (emp = PascalCase Employee_Master object), `publicAdminUser(emp)`,
`abandonSession(req)`, `errorInsert(req, err, 'PROCEDURENAME')` (the legacy `#region For ErrorInsert` block -> `DataUtility.ErrorInsert`),
`parseCookies(req)`, `anonReq(req)`. Do not edit these files; ask the login-port owner/coordinator for changes.
