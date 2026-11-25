# Porting guide addendum: ASP.NET MVC apps (Franchise, Member, Merchant, MLM Admin, Payment Gateway, Shopping Portal)

Read `PORTING_GUIDE.md` first. Everything there applies (zero logic loss, T-SQL -> PostgreSQL, parameterised SQL, PORT-NOTE,
await every lib call, `node --check`, final report). This file lists ONLY the differences for MVC apps.

Source roots (read-only): `C:\Users\MY ASUS\cluster\<App>\`. Target: `d:\old commerza\commerza-web-api`.
Schema dumps: `d:\old commerza\db\dbshopping.sql`, `d:\old commerza\db\affilate.sql`.

## What changes versus the Web API port
1. **Controllers return views, not only JSON.** Every public action must become an Express endpoint:
   - `JsonResult` / `Content` / `File` actions: reproduce the response exactly (JSON shape, keys, casing, strings).
   - `ActionResult Index()` (or any action ending in `return View(...)`): the view (.cshtml) is NOT ported, but **all server-side
     logic before the `return View` is** (DB reads, paging, filters, ViewBag/ViewData/Model values). Return that data as JSON:
     `res.json({ ...everything the view would receive (Model, ViewBag.*, ViewData.*, TempData.*) })`. Use the legacy names as keys.
   - `RedirectToAction(...)` / `Redirect(...)`: return `res.json({ redirect: '<legacy target>' })` (status 200) unless it is an
     auth failure (see 2).
   - POST form handlers: read `req.body` (+ `req.p`), do the same work, return `{ status, message, ...ViewBag/TempData values }`.
   - File upload (`HttpPostedFileBase`) -> `multer` memory storage, save under `config.uploadDir/<LegacyFolder>`. Excel/CSV/PDF
     exports -> generate the same content and send as download (use only already-installed packages; if a package like exceljs is
     required, say so in the report and write the code anyway).
2. **Session -> JWT.** `Session["Plid"]` (a `Login` object with `.Plid`, `.DID`, ...) is replaced by `req.user` (JWT, `auth` middleware).
   - A null-session check (`if (Session["Plid"] == null) return RedirectToAction("Index","Home")`) becomes the `auth` middleware.
   - `((Login)Session["Plid"]).Plid` -> `req.user.plid`, `.DID` -> `req.user.did`, other session keys -> `req.user.<lowercase key>`.
     Login endpoints (the controller action that originally populates `Session[...]`) MUST put every value they store in Session
     into the JWT payload via `signToken({ userType: '<app>', plid, did, ...allSessionValues })` and return `token` + the legacy response.
   - Session values that are written then read in later requests for non-identity data (e.g. cart, captcha, OTP) -> store server-side in
     `src/utils/sessionStore.js` (`get(req,key)`, `set(req,key,value)`, keyed by the JWT subject; **file does not exist yet, assume it
     will with exactly these two functions, both sync**).
   - `Session.Abandon()` / logout -> `res.json({status:'true'})` (client drops the token).
3. **Routing.** MVC conventional routing `{controller}/{action}/{id}` and `routes.MapRoute(...)` entries in `App_Start/RouteConfig.cs`.
   - For every action register `router.all('/<prefix>/<ControllerName without "Controller">/<ActionName>/:id?', ...)` with the verb from
     `[HttpGet]/[HttpPost]` (none => `router.all`). `<prefix>` is given in your assignment (e.g. `franchise`).
   - Additionally register the legacy friendly URLs from `RouteConfig.cs` that point at your controllers
     (`url: "franchisee/order-List"` -> `/<prefix>/<url>` mapped to the controller/action named there). Put a `// route-config` comment.
   - `[Route("...")]` attributes keep their paths under `/<prefix>/`.
   - Action method name casing is kept as in C#; params via `req.p` (case-insensitive) exactly like the API port.
4. **Files & modules.** One controller file `X.cs` -> `src/modules/<prefix>/<x-in-kebab-case>.js` exporting an `express.Router()`
   (no `.router` wrapper). File names are kebab-case: drop a trailing `Controller`, split words at underscores, spaces and
   case changes, lower-case everything (`Add_Member_Panel_SubMenu.cs` -> `add-member-panel-sub-menu.js`,
   `KYCAdminController.cs` -> `kyc-admin.js`, `NewPerformanceBonus - Copy.cs` -> `new-performance-bonus-copy.js`). Helpers
   private to a folder go in `_shared/` with kebab-case names too. Start every file with `// Ported from <legacy path>.cs`
   and add the mapping `"<prefix>/<X>.js": "<prefix>/<kebab>.js"` to `scripts/module-name-map.json` (used by
   `scripts/check-coverage.js`). Route URLs are NOT affected by the file name: they keep the legacy controller/action names. `src/modules/<prefix>.js` (written by the coordinator, do not write) mounts every file in that folder.
   Do not write anywhere outside `src/modules/<prefix>/` except as stated in your assignment.
5. **Libs.** The app's non-controller C# (DAL, Models helpers, UtilityClass...) is ported by lib agents to
   `src/lib/<prefix>/<OriginalName>.js` (same class/method names, PascalCase, same signatures). Require them as
   `require('../../lib/<prefix>/DAL_RegistrationOrLogin')`. Shared libs that already exist in `src/lib/` (from the API port) are
   re-exported by the lib agents where the C# is identical, so always require from `src/lib/<prefix>/`.
   If a lib you need is missing at the end, write it inline in your module and list it in your report.
6. **Entity Framework context (`DataBaseContext Db`)**: `Db.Database.SqlQuery<T>(sql)` -> `db.query('affiliate'|'shopping', sql, params)`
   with `mapRows(rows,[PascalProps])` when the C# class has PascalCase properties. Which of the two databases the app uses is stated
   in your assignment. EF DbSet LINQ -> explicit parameterised SQL (find entity class in the app's `Models/`).
7. **Auth exceptions.** Login, registration, forgot password, OTP, captcha, public landing/outer pages, payment-gateway callbacks and
   webhooks (IPN/Success/Fail/Webhook), and anything the legacy code served without a session check stay public. Everything with the
   session check uses `auth`. Mark each route `// public` or `// auth`.
8. **Coverage proof.** Your final report must include a table: C# file -> number of public actions in C# -> number of routes registered.
   They must match (an action may register several routes). Skipped actions need a one-line reason. The coordinator runs a checker.
9. **Never copy secrets** (connection strings, API keys, passwords, SMTP/SMS credentials) into code. Read from `config.app.<Key>`;
   add missing keys to `src/config/index.js`? NO - you may not edit shared files: list the keys in your report and use
   `(config.app.<Key> || '')`.

## Lessons from the Franchise port (apply to every later app)
1. **Express 5.3 syntax**: optional route params are `{/:id}`, NEVER `/:id?` (it throws at load). Arrays of paths are fine.
2. **Database**: take it from the app's `Web.config` (`DataBaseContext` / `DefaultConnection` / `ConnectionString` key `initial catalog=`).
   `Db_Affiliate` => `'affiliate'`, `Db_Shopping` => `'shopping'`. Use ONE constant `const DB = '...'` at the top of each file. Do not guess.
3. **Libs**: lib agents write to `src/lib/<prefix>/`. If a C# lib is logically identical to an existing `src/lib/<Name>.js`
   (API port) write `module.exports = require('../<Name>')` ONLY if it uses the same database; if the DB differs make a copy with the right DB.
4. **Helper/static methods that are not MVC actions** (private/protected/static/Tuple/DataSet-parameter methods, `OnActionExecuting`) are not routed;
   port the logic inline or as an internal function and say so in the coverage table.
5. **Mounting**: `src/modules/<prefix>.js` mounts every file of `src/modules/<prefix>/`. A file named `0_aliases.js` there may forward legacy
   friendly URLs (set `req.url` then `next('router')`).
6. **Friendly URLs**: register `url:` entries from `RouteConfig.cs` for your controllers under `/<prefix>/<url>` (non-commented only).
7. **Session -> JWT**: payload fields read by controllers must be listed in your report so the login port puts them in the token. Login
   actions return the legacy response PLUS `token`.
8. **Auth**: where the C# had no session check but the action acts on a logged-in user's data, use `auth` and say so in the report.
9. **Excel/zip/image packages (exceljs, xlsx, adm-zip, sharp, qrcode)** are NOT installed: `require` them lazily inside the handler that needs them,
   so the module itself always loads.
10. **Config keys** you need: use `(config.app.X || '')`; list them in the report (the coordinator adds them to config).
11. Do not run `npm install`. Do not start servers. Do not kill processes.

## Derived-app workflow (Merchant Panel, and any app that is a fork of an already ported one)
Your batch file has lines `C#path|franchiseModulePath|similarity%` (or `NONE`). When a Franchise module exists:
1. Read BOTH C# files (Merchant and Franchise `Controllers\...\<same name>.cs`) and the finished Franchise JS module.
2. Start from the Franchise JS (copy to `src/modules/merchant/<Name>.js`), then change it so it matches the MERCHANT C# exactly:
   every action/route added, removed or changed, every SQL statement, proc name, parameter, message string, column, folder, session field.
   Differences are the whole point: do NOT assume the files are the same, line-by-line compare. Rename route prefix `/franchise/` -> `/merchant/`,
   require paths `lib/franchise/` -> `lib/merchant/`, `req.user.did/pmid` etc. as the MERCHANT C# reads them.
3. Franchise-specific code that does not exist in the Merchant C# must be removed.
4. Franchise port conventions apply (Express 5 `{/:id}`, lazy-require exceljs/xlsx/adm-zip/sharp, `const DB`, coverage table).
5. If `NONE`, port from the C# as usual.
The Merchant Web.config uses Db_Shopping => `const DB = 'shopping'`. Merchant libs go to `src/lib/merchant/` (lib agents adapt `src/lib/franchise/<Name>.js` the same way).
