# Pending port work: C:\Users\MY ASUS\cluster

Written for: the project owner. Status on 2026-11-26. Every legacy controller is now ported. What is left is running it against a
database and the go-live items below.

## Summary

| Legacy app | Controllers | Ported | Pending |
|---|---|---|---|
| ClusterOfferAPI | 29 | 29 | 0 |
| Member | 302 | 302 | 0 |
| Franchise | 184 | 184 | 0 |
| Shoping Portal Merchant Panel | 120 | 120 | 0 |
| Payment Gateway (Shoping Portal Payment Gateway) | 3 | 3 | 0 |
| MLM_Adminpanel | 497 | 497 (incl. 6 empty files and 4 non-controller helpers, ported to `src/lib`) | 0 |
| ClusterofferShopingPortal | 259 | 254 (+5 that are empty or not controllers) | 0 |

"Ported" means every public action has a registered Express route and every module loads; `require('./src/app.js')` succeeds.
**None of it has been run against a database yet.**

How to check:
- `node scripts/check-coverage.js <App> <prefix> [subfolder]` for admin/member/franchise/merchant (text search; actions built by
  shared builder functions show up as false gaps there).
- `node scripts/check-portal-routes.js [Controller ...]` for the portal: loads each module and compares the routes it really
  registers with the C# actions. Result: 806 of 818 actions routed; the 12 others are helper methods (nested `RemotePost.Add/Post`,
  `Generatehash512`, `SaveData`, `SendConfirmationToConcern`), not MVC actions.

Unrouted helpers in the other apps (ported as internal functions, called by the actions): Member `PayByPayYouMoney`, `SaveImage`,
`EwalletType`, `RemotePost.Add/Post`; Franchise/Merchant `SendMail`, `SendMessage`, `ExportReport`, `ImageUploadMasterMethod`,
`WriteDataIntoExcelWithFormats`, `ExportExcelForReporting`, `saveImage`, `DataUtility.*`.

## 1. Shopping Portal: decisions for the owner

1. `/portal/servicejewaria/MakePostpaidRecharge` returns 500 on purpose: the C# had two public methods with that name, so MVC threw
   AmbiguousMatchException on every call (Dth/Electricity/Gas/DataCard/BroadBand views post there). Set `ambiguousMakePostpaid: false`
   in `src/modules/portal/servicejewaria.js` to make it work.
2. Android auto-login (`CustomerPanel/Link_ForAnroid`, `All_RechargeService_from_mobile`) and `Login_as_Mobile/Index` issue a login
   token to anyone who knows a customer CLID (and DID). Kept public as in legacy; should get a real check.
3. Login checks were ADDED where legacy was open and the action was dangerous: `Order_List/SendMail`, the PayU-signing
   `ProceedToPayment` actions, `KYCCheck.InsertKYCViaCs`, `getdetails` (KYCCheck, Business_KYC), `Add_Product.saveImage`,
   `ClassifiedAds.SendAdPostlMail`, `reviews.AddComment/Updatesingleproduct`, `view_all_notifications.Markasread`,
   `PostShareManagement.ManageHistoryOfSessionForEachUser`, `SendEmailViaSelfAccount.SendEmailByApiSettingMethod`, `Wallet.WithdrawalList`.
4. Still open as in legacy: `Change_Create_Invoice` Index/PrintInvoice (invoice and address data), `Common.GetAddressDetail` /
   `DeleteMemberAddress` (logged in, but no ownership check).
5. `CustomerPanel/MakePayment` PayU success/failure URLs are hard-coded to `http://localhost:41075/merchant/...` in legacy; kept.
6. Single-segment URLs `/portal/<title>` go to BusinessDetails/Index unless another module registers that path (then that module wins).
7. `customer/my-profile` goes to UserPanel/Member_Profile (RouteConfig maps it there first), not CustomerPanel/My_Profile.

## 2. Stored procedures / tables missing from `dbshopping.sql`

These calls are kept with their legacy names; they fail (usually into the legacy catch branch) until the object exists in PostgreSQL:
USP_CUSTOMER_INSURANCE_RECHARGE_REQUESTS, usp_DeleteProductFromOrder, USP_TRANSFERORDERTOBRANCH, USP_UPDATEORDERPRODUCTQUANTITY,
USP_GETINSUFFICIENTPRODUCT_DETAILS, USP_INSERTBANKDETAISCUSTOMER, Usp_MYREVIEWDETAIL, USP_UPDATEREVIEW, usp_postNewAd,
USP_GETAGENCY_SALEREPORTS, USP_GETBVSALEREPORTS, USP_GETSALEONPRODUCTREPORTS, usp_GetGiftVoucherReceiptDetails, table tbl_carriermaster.
`Usp_ClickManagements` in the dump has no Mode 5/6 and a different parameter order: the live database must have a newer version.
Earlier apps: usp_Fund_Recieve_From_Agency, Usp_TransferFundToUser, usp_All_FundsTransfer_history, Usp_Get_Help, USP_MANAGEGATEWAYRESPONSE.

Procs with several result sets (USP_ORDERDETAILS, USP_INVOICE_DETAILS, USP_INVOICE_DETAILS_FOR_PRINT, usp_InsertBulkProduct) need
PostgreSQL functions that return all sets, or the later sets come back empty.

## 3. npm packages and files to deploy

- Not installed, lazy-required (the module loads; only the handler that needs one fails): `xlsx`, `exceljs`, `adm-zip`, `sharp`
  (without sharp, images are saved unresized). Needed for bulk product/image upload, Excel exports, email/mobile data upload.
- Copy from the live server into `uploads/`: `add-confirm-page.html` (ClassifiedAds/Index returns 500 without it) and
  `OrderStatusUpdate.html` (Order_List status mails; or set `ORDER_STATUS_UPDATE_TEMPLATE`).

## 4. Library file names

`src/lib/**` still uses the legacy class names (e.g. `UtilityClass.js`). Rename them to kebab-case in one pass, using the same
before/after route check as the module rename.

## 5. Not code, but needed before go-live

1. Fill in `.env`: PostgreSQL connections, JWT secret, encryption key, and the credentials that were hard-coded in the old code (PayU,
   Razorpay, PayPal (`PAYPAL_*`), SMS, SMTP, `NO_REPLY_MAIL` (empty => profile/bank/billing confirmation mails are skipped, as legacy),
   ShipRocket, IP lookup, admin mail accounts, `TEMPLATE_SHEET_PASSWORD`).
2. Run everything against a copy of the database. No SQL has been executed yet.
3. Rotate every credential that was in the legacy Web.config files and code.
4. Decide the security items raised during the port: password-only store login, decrypted passwords shown to admins, SMTP passwords on
   the Email Account page, block.io key in an error message, payment-gateway SaveData, master OTP code, plus section 1 above.
5. Load the seed data: `database/seed_country_state.sql` (db_shopping) and `database/seed_country_state_affiliate.sql` (db_affiliate).
