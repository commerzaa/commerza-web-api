# Porting guide: ClusterOfferAPI (ASP.NET Web API, SQL Server) -> commerza-web-api (Express, PostgreSQL)

Source root (read-only, never modify): `C:\Users\MY ASUS\cluster\ClusterOfferAPI\ClusterOfferAPI`
Target root: `d:\old commerza\commerza-web-api`
SQL Server schema dumps (for table/column/stored-procedure lookups, grep them, they are ~6MB):
`d:\old commerza\db\dbshopping.sql` (Db_Shopping) and `d:\old commerza\db\affilate.sql` (Db_Affiliate).

GOAL: **zero logic loss.** Every endpoint, branch, validation, SQL statement, stored-procedure call, side effect
(SMS / mail / push / HTTP call to 3rd party), status string and JSON response shape of the C# code must be reproduced.
Do not simplify, skip "unused-looking" code, or invent behaviour. Commented-out C# code stays commented out
(you may drop it). If something truly cannot be ported (e.g. Windows-only API), port the closest equivalent and
add a `// PORT-NOTE:` comment describing the difference; list every PORT-NOTE in your final report.

## Already built (do not rewrite, only use)
| File | Purpose |
|---|---|
| `src/config/index.js` | env config. Legacy `ConfigurationManager.AppSettings["X"]` => `config.app.X` (same key names). **Never copy secrets/passwords/keys from Web.config** - read them from config/env. If a key is missing in `config.app`, add it there AND to `.env.example` with an empty value. |
| `src/db/index.js` | PostgreSQL: `query / queryOne / scalar / exec / proc / procOne / tx`. First arg is the database: `'affiliate'` (legacy `DataBaseContext`, `Db_Affiliate`) or `'shopping'` (legacy `Cart_Entity`/`shoppingConnection`, `Db_Shopping`). Keep T-SQL `@name` parameters; pass an object `{name: value}`. Stored procs: `proc(db, 'usp_name', {param: value})` (named notation, lower-case names, no `@`). |
| `src/utils/crypto.js` | `Encryptword`, `Decryptword` (byte-compatible with UtilityClass). |
| `src/utils/shape.js` | `mapRow/mapRows(rows, ['PropName',...])` restore the C# model PascalCase property names (PostgreSQL returns lower-case columns; legacy JSON used the C# class property names - **keep the legacy JSON keys/casing exactly**). `netDate()` for .NET-style dates. |
| `src/middleware/auth.js` | `signToken(payload)`, `auth` (JWT guard, sets `req.user`), `optionalAuth`, `requireType(...)`. |
| `src/middleware/params.js` | `req.p.<Name>` = ASP.NET-style case-insensitive binding from query string + route + body. Use it for every simple-typed action parameter (`req.p.LoginID`). Complex `[FromBody]` objects => `req.body`. |
| `src/middleware/asyncHandler.js` | wrap every async handler: `router.post('/api/x', auth, asyncHandler(async (req,res)=>{...}))` |
| `src/routes/index.js` | auto-mounts every `src/modules/*.js` at `/` (must `module.exports = router`). |

## Conventions (MUST follow - other agents are writing sibling files in parallel and rely on them)
1. **Routes**: one controller => one file `src/modules/<ControllerName>.js` (e.g. `ProductsController.js`) exporting an `express.Router()`.
   Use the *absolute* path from `[Route("api/...")]` (`{id}` => `:id`; `{id?}` / optional => register both forms). Keep the verb from
   `[HttpGet]/[HttpPost]/...`; no verb attribute => `router.all(...)`. Conventional routes with no `[Route]` (`api/{controller}/{id}`)
   => `/api/<ControllerWithoutSuffix>/:id?` following Web API action-name convention.
2. **Responses**: reproduce exactly what `Json(...)`, `Ok(...)`, `BadRequest(...)`, `Content(...)` returned (including arrays like
   `List<object> res` wrapping, `status = "true"` (string) vs `true` (bool), message texts, typos included). Use `res.json(...)`.
   HTTP status codes: legacy `Json()` is always 200; `BadRequest()` is 400, `NotFound()` 404, `InternalServerError` 500.
3. **Authentication (JWT)**: Login/registration/forgot-password/OTP/product & shop browsing/home/cms/master-data/payment-gateway
   callbacks (success/fail/webhook/hash)/scheduler/app-version endpoints are **public**. Every endpoint that acts on a logged-in
   member/customer (takes `plid`, `clid`, `CLID`, `PLID`, `MemberId`, wallet, orders, cart, checkout, profile, withdrawal, topup,
   KYC, tickets, earnings, community, recharge ...) is protected with `auth`. Do NOT change the request/response contract of
   protected endpoints (clients still send `plid` etc.); JWT is an additional layer. Login endpoints keep their legacy response
   and ADD `token` (use `signToken({ plid, userName, userType: 'member' })` or `userType: 'customer'` with `clid`) - add it at the
   top level of the response object (if the legacy response is an array wrapper, add `token` inside the first element).
   Put a one-line comment `// public` or `// auth` before each route registration.
4. **Shared libs (`src/lib/<OriginalClassName>.js`)**: the non-controller C# code (DAL/*.cs, Models/*.cs helpers, Repository/Helper.cs,
   `UtilityClass`, `DataUtility`, ...) is ported by dedicated agents into `src/lib/` **using the original file/class name and the
   original method names (PascalCase, unchanged)**, e.g. `const DAL_RegistrationOrLogin = require('../lib/DAL_RegistrationOrLogin');`
   `await DAL_RegistrationOrLogin.Login_Check(loginId, password, ip)`. Static members stay as `module.exports = { Name1, Name2 }`.
   Instance classes (`new Foo().Bar()`) are exported as a class: `const Foo = require('../lib/Foo'); new Foo().Bar()`.
   Exceptions: `Repository/Helper.cs` => `src/lib/Helper.js`; `Models/UtilityClass.cs` => `src/lib/UtilityClass.js`;
   C# model/entity classes (plain property bags) are NOT ported as classes - controllers just build plain objects with the same
   property names (use `mapRows` with the property list when selecting with `SqlQuery<T>`).
   **Every lib call must be `await`ed** (even ones that look pure; they may be async). Lib functions keep their C# parameter order
   and return the same shape the C# return type would serialise to. Controller agents: use libs by contract, do not
   reimplement them; if a lib method you need seems missing at the end, write it in your own module file and report it.
5. **Lib porting rule**: if the lib file does not exist yet when you need it, assume it will (original names) - do not stub it.
   Lib authors: first line of each lib file is a `/** Exports: ... */` comment listing every export + its C# signature.
6. **SQL porting (T-SQL -> PostgreSQL)**: identifiers unquoted lower-case; `TOP n` => `LIMIT n`; `GETDATE()` => `now()`;
   `ISNULL(a,b)` => `coalesce`; `+` string concat => `||`; `CONVERT/CAST` => `::`; `LEN` => `length`; `CHARINDEX` => `position`;
   `IIF` => `CASE`; `SCOPE_IDENTITY()`/`OUTPUT INSERTED.x` => `INSERT ... RETURNING x`; `[dbo].` prefix dropped; `NOLOCK` removed;
   paging `OFFSET x ROWS FETCH NEXT y ROWS ONLY` => `OFFSET x LIMIT y`; `DATEADD/DATEDIFF` => interval maths;
   `@@ROWCOUNT` => the `exec()` row count. **Always use bound `@param` parameters - never string-concatenate request values into SQL
   (the legacy code did, that was a SQL-injection hole; the replacement must be parameterised but behave identically).**
   Entity Framework LINQ (`db.TBL_X.Where(...)`) => equivalent parameterised SELECT/INSERT/UPDATE (look at the entity class in
   `Models/` / `EntityModels/` / `CartProduct/` for table & column names; EF `SaveChanges` => explicit INSERT/UPDATE).
   Multi-statement operations that were in a `TransactionScope`/`BeginTransaction` => `db.tx`.
   Stored procedures with OUTPUT params: the function returns them as columns of the single result row.
7. **HTTP calls** (`HttpWebRequest/WebClient/HttpClient/RestClient`) => `axios`; keep URLs, headers, payloads, timeouts, TLS behaviour.
   **Mail** => `nodemailer`; **file/image saves** => `fs` under `config.uploadDir/<LegacyFolder>`; multipart uploads =>
   `multer` (memory storage); base64 image payloads handled like the C# did.
8. **Quality bar**: run `node --check` on every file you create. When all your files exist run
   `node -e "require('./src/modules/<YourFile>.js')"` from the target root (missing libs owned by other agents may not exist yet -
   that specific failure is acceptable, anything else is not). No `console.log` noise; use `console.error` for caught errors only.
9. Write only your own files (listed in your assignment). Do not edit shared files above; if you need a change in one, describe it in
   your report. Add any new npm dependency to your report (do not run `npm i` for packages not already installed:
   express pg jsonwebtoken cors helmet morgan dotenv multer nodemailer axios compression express-rate-limit razorpay).
10. **Final report format** (keep it < 40 lines): files written, route count ported vs route count in the C# source (they must match),
    every `PORT-NOTE`, every stored procedure / table you depend on, every lib function you needed from other agents, anything skipped and why.
