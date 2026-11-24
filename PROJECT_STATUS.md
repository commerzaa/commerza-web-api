# commerza-web-api: Project Status

Written for: you, the project owner, as a record of what was done with `C:\Users\MY ASUS\cluster` and what is still pending.

Date: 2026-11-23. Location: `d:\old commerza\commerza-web-api`.

## 1. What was in `C:\Users\MY ASUS\cluster`

| Folder | What it is | Controllers | C# size | Ported? |
|---|---|---|---|---|
| ClusterOfferAPI | ASP.NET Web API: mobile and web client API | 29 | 1.7 MB | **Yes, in this project** (pending verification, see section 4) |
| ClusterofferShopingPortal | Customer shopping website (MVC) | 204 | 9.3 MB | No |
| MLM_Adminpanel | Admin back office (MVC) | 82 | 7.0 MB | No |
| Payment Gateway | Gateway app (MVC) | 71 | 3.3 MB | No |
| Member | Member panel (MVC) | 31 | 3.3 MB | No |
| Shoping Portal Merchant Panel | Merchant panel (MVC) | 25 | 3.9 MB | No |
| Franchise | Franchise panel (MVC) | 10 | 2.4 MB | No |
| clusteroffer.in, comerza, db | Static/website copy, empty folder, SQL dumps (`dbshopping.sql`, `affilate.sql`) | n/a | n/a | Dumps used as schema reference |

Only ClusterOfferAPI is an API. The other apps are ASP.NET MVC websites. They may contain business logic (admin payouts, income distribution, merchant and franchise management, the payment gateway) that is not in the API.

## 2. What was done

### Stack decisions (confirmed with you)
- Node.js 18 + Express.
- PostgreSQL, using your existing databases (nothing is created by this app).
- JWT authentication.
- Full port of ClusterOfferAPI with no logic dropped.

### Foundation (written and tested)
| File | Purpose |
|---|---|
| `src/server.js`, `src/app.js` | Server start-up, middleware (helmet, cors, compression, request logging), health check at `/health` |
| `src/config/index.js`, `.env.example` | All legacy `Web.config` settings as env variables. No secrets copied |
| `src/db/index.js` | PostgreSQL layer for the two legacy databases (`affiliate` = Db_Affiliate, `shopping` = Db_Shopping). Keeps `@param` SQL style, parameterised, transactions, stored-procedure calls |
| `src/middleware/auth.js` | JWT: `signToken`, `auth`, `optionalAuth`, `requireType` |
| `src/middleware/params.js` | Emulates Web API parameter binding (query string + body, case-insensitive) |
| `src/utils/crypto.js` | Password encryption, byte-compatible with the legacy `Encryptword` / `Decryptword` (checked against a sample from the legacy code) |
| `src/utils/shape.js` | Restores C# property-name casing in JSON responses |
| `PORTING_GUIDE.md` | Rules all porting agents followed |
| `scripts/check-routes.js` | Compares legacy C# routes with the Express routes and checks that every `require` resolves |

### Controllers ported (26 files, 144 route registrations)
| Group | Files (in `src/modules`) | Routes |
|---|---|---|
| Sign-in, profile, shops | Visitor_signIn, Profile, Shops | 8 + 8 + 6 |
| Account, help desk, app | MyAccount, HelpDesk, PushNotification, AppRequired, Scheduler, Values | 7 + 4 + 1 + 3 + 1 + 5 |
| Packages, wallets | ClusterPackage, IncomeWallet, ShppingWallet, SmartWork | 4 + 1 + 1 + 2 (agent counted 7 in total) |
| Community, earnings, referral | MyCommunity, MyEarnings, RefferalDashboard | 11 + 6 + 1 |
| Money | TopupWallet, Withdrawal, Recharge | 7 + 4 + 7 |
| Shopping | Checout, WebHome, Marchant, MarchantP | 7 + 2 + 5 + 4 |
| Orders | Order | 8 |
| Payment | Payment (+ `_payment/helpers.js`) | 7 |
| Products | Products | 24 |

The stray file `ut4txqcq.kha~` in the legacy folder is an old editor copy of `OrderController.cs`. Every route in it exists in the real controller, so it was not ported.

### Shared libraries ported (88 files in `src/lib`)
Utilities (`UtilityClass`, `DataUtility`, `GetIP`, mail and SMS), the DAL files (login/registration, dashboard, referral, help, coupons, offers, scheduler/payout), external integrations (DMT, Ezpay, Quicko KYC, recharge, FCM push, CoinPayment, Bitcoin, Razorpay, BlockChain), and the helper libs. Names match the legacy C# classes and methods.

### Authentication (JWT)
- Login (`MemberSignIn`) and signup (`SignUpNow`) keep their legacy response and add `token` (`userType: 'member'`).
- Public: login, signup, OTP, location lookups, product and shop browsing, master data, scheduler, app-version.
- Protected (`auth`): everything that acts on a logged-in user (wallet, orders, cart, checkout, profile, KYC, tickets, topup, withdrawal, recharge, payment).
- No route signs a `customer` token, because no ported route authenticates against the shopping customer table.

## 3. Security findings (action needed from you)

1. **Live credentials were in the legacy `Web.config` and code.** Database password, FCM key, PayU key and salt, SMTP and SMS credentials, Razorpay live key, Quicko, DMT, Ezpay and rechapi keys, a SendGrid key, and an SMTP password for a second mailbox. None were copied. **Rotate all of them.**
2. The legacy code built SQL by string concatenation (SQL injection). All SQL in the port is parameterised.
3. **Still open in the port (kept to match legacy behaviour, decide whether to fix):**
   - `DeleteMemberAddress` has no ownership check, so a logged-in user can delete another user's address.
   - `SendpushNotification` is public: anyone can push to all users.
   - `updateVersion` is public with no filter: anyone can overwrite the app version.
   - `AutoPayout` is open unless `SCHEDULER_KEY` is set.
   - `UpdateCategoryIcon` is public and lists files from a caller-supplied folder path.
   - Voucher credentials (BuyerGUID/BuyerPassword) are written into a log table and a URL column, as in legacy.
   - Protected routes still trust the `plid` the client sends. The token proves the caller is logged in, but the code does not yet check that the `plid` matches the token.

## 4. Pending

### A. Finishing and verifying the ClusterOfferAPI port
Done and verified on 2026-11-23 (no database available):
- [x] All porting agents finished. `src/lib/IMS_MasterProductAttribute.js` (in the legacy `CartProduct` folder, not covered by any agent) was written by hand.
- [x] `node scripts/check-routes.js "C:/Users/MY ASUS/cluster/ClusterOfferAPI/ClusterOfferAPI"`: all 132 legacy attribute routes are registered (141 Express routes, the extras are the Values/Marchant scaffolds and `all` variants). All `require`s resolve.
- [x] Server starts with 26 modules. Smoke test: public route works, protected route returns 401 without a token and 401 for a bad token, a valid JWT passes the guard and only fails at the database (`ECONNREFUSED`, since no database is configured here).

Still to do:
- [ ] **Nothing has been run against a real database.** Every SQL statement and stored-procedure call is untested.
- [ ] Run a real review pass over the money flows (topup, withdrawal, recharge, checkout, order, payment) comparing the JS to the C# line by line.
- [ ] Tests (none written yet).

### B. Needs your database
- [ ] Fill in `.env` (copy `.env.example`): PostgreSQL connection for both databases, `JWT_SECRET`, `ENCRYPTION_KEY`, and the third-party keys.
- [ ] Confirm the migrated schema: lowercase unquoted table and column names, and stored procedures that exist as PostgreSQL functions with named parameters. If not, send the schema; the call format is one function, `procSql()` in `src/db/index.js`.
- [ ] Output parameters are read as result columns with lowercase names (`result`, `intresult`, `stroutput`, `strresult`, `returnregno` and similar). Confirm the functions return them that way.
- [ ] `Usp_Get_Help` and `USP_MANAGEGATEWAYRESPONSE` are in neither SQL dump. Create them or confirm they exist.
- [ ] Many procedures and tables exist in only one of the two dumps. Where the legacy code used the other connection, the port uses the database that has them (some libs try `affiliate`, then retry on `shopping`). Confirm this matches your PostgreSQL layout.
- [ ] Bit columns are assumed to be PostgreSQL booleans. DOB is passed to a KYC procedure as a string.

### C. Decisions only you can make (behaviour was preserved, change on request)
- Cart endpoints now require a token. The legacy ones worked for guests with only a session id. Make them public or add guest tokens if your site needs guest carts.
- `MarchantPurchase` needs a token; `FetchCashback` is public. The OTP routes in Payment need a token.
- Checkout totals keep legacy quirks: shipping counted twice in the grand total; BV not multiplied by quantity, PV and cashback are.
- `CheckBalance` always returns "Success" (the legacy query was invalid).
- `KycIDProof` always ends in HTTP 500 (a legacy conversion bug).
- Order cancel and refund run as two separate steps with no transaction. A failure between them can leave an order cancelled without a refund.
- `updgradepackage` had no route in legacy (probably unreachable); it is registered under `/api/ClusterPackage/updgradepackage`.
- Several smaller legacy bugs were reproduced and are marked `PORT-NOTE` in the code.

### D. Not started: the rest of `C:\Users\MY ASUS\cluster`
Each of these is a separate, larger job. Suggested order after A and B are done:
1. Member panel (31 controllers).
2. Merchant panel (25).
3. MLM admin panel (82): likely holds payout and income distribution logic.
4. Payment Gateway (71).
5. Franchise (10).
6. Customer shopping website (204): largest; part of it overlaps with the API already ported.

### E. Later
- Customer-type JWT (shopping customer login) once the customer login code is ported.
- Rate limiting on login, OTP and payment routes (`express-rate-limit` is installed but not used).
- Deployment: a process manager, HTTPS, logs, and the legacy upload folders (Member_Image, KYC_Images, TicketCenterImage, UploadedBills, Challen_Image) moved into `uploads/`.
