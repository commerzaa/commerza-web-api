/** Exports (C# BAL/CheckPermissions.cs `public class CheckPermissions`, MLM Admin, database 'affiliate'):
 *   static async GetExcelPermission(string _pURL) : int
 *   static async GetPageActionPermission(string _pURL, int _pEmployeeID) : { _opIsDownloadAllowed: int, _opIsEditAllowed: int }   (C# `out` params)
 *   static middleware(options?) : Express middleware (convenience, no C# equivalent) - see below
 *   static legacyUrl(req, prefix = '/admin') : string  ("~" + Request.Url.AbsolutePath as the legacy app saw it)
 *
 * WHAT IT IS: NOT an MVC action filter/attribute. It is a static helper the controllers call at the top of Index-like actions
 * to fill ViewBag; it never blocks a request. No Member/API equivalent exists => ported.
 *
 * HOW CONTROLLERS USE IT (legacy pattern, 100+ controllers):
 *     url = "~" + Request.Url.AbsolutePath;
 *     CheckPermissions.GetPageActionPermission(url, Empid, out _opIsDownloadAllowed, out _opIsEditAllowed);
 *     ViewBag.isactive = _opIsDownloadAllowed; ViewBag.isedit = _opIsEditAllowed;
 *     ViewBag.excelactive = CheckPermissions.GetExcelPermission(url);
 *   (a) plain calls (preferred, identical order of DB calls):
 *     const CheckPermissions = require('../../lib/admin/CheckPermissions');
 *     const url = legacyUrl(req);  // from ./_shared/adminSession, or CheckPermissions.legacyUrl(req)
 *     const { _opIsDownloadAllowed, _opIsEditAllowed } = await CheckPermissions.GetPageActionPermission(url, req.user.emp_id);
 *     ViewBag.isactive = _opIsDownloadAllowed; ViewBag.isedit = _opIsEditAllowed;
 *     ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
 *   (b) middleware (after adminAuth):  router.all('/admin/X/Index{/:id}', adminAuth, CheckPermissions.middleware(), asyncHandler(async (req, res) => {
 *         // req.permissions = { url, isactive, isedit, excelactive }  -> spread into the response ViewBag
 *       }));
 *     options: { getUrl(req) (default legacyUrl(req)), getEmpId(req) (default req.user.emp_id), excel: true (also run GetExcelPermission),
 *                pageAction: true (also run GetPageActionPermission) }. DB exceptions are passed to next(err) (legacy: unhandled => 500).
 *     Use (a) when the legacy action computed these inside its own try/catch or after other work (exception handling / ordering must match).
 *
 * PORT-NOTE: GetExcelPermission: Convert.ToInt32(@ISACTIVE.Value.ToString()) throws FormatException when the OUT value is NULL ("") - kept
 *   (throws Error('Input string was not in a correct format.')). GetPageActionPermission maps NULL/"" to 0 like the C#.
 * PORT-NOTE: OUT parameters (@ISACTIVE, @EXCELSTATUS, @ISEDIT) are read from the result row of the PostgreSQL function (lower-case columns).
 */
'use strict';
const { procOne } = require('../../db');

const DB = 'affiliate';

function outCol(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : row[k];
}
const netStr = (v) => (v === null || v === undefined ? '' : String(v)); // SqlParameter.Value.ToString() (DBNull => "")
function toInt(s, bits) { // Convert.ToInt32 / ToInt16(string)
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(t, 10);
  const lim = bits === 16 ? 32767 : 2147483647;
  if (n > lim || n < -lim - 1) throw new Error(`Value was either too large or too small for an Int${bits}.`);
  return n;
}

class CheckPermissions {
  /**
   * Pass the URL of any page of admin,
   * it will return you Excel permission is allowed for this page or not.
   * Legacy: USP_EXCEL_LINK @url,@ISACTIVE out (CommandTimeout 1000)
   */
  static async GetExcelPermission(_pURL) {
    let _rResult = 0;
    const row = await procOne(DB, 'usp_excel_link', { url: _pURL });
    const v = netStr(outCol(row, 'ISACTIVE'));
    const isactive = toInt(v === '0' ? '0' : v, 32);
    _rResult = isactive;
    return _rResult;
  }

  /** Legacy: USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out  => out _opIsDownloadAllowed, out _opIsEditAllowed */
  static async GetPageActionPermission(_pURL, _pEmployeeID) {
    const row = await procOne(DB, 'usp_getexcelpermisionstatus', { empid: _pEmployeeID, herf: _pURL });
    const excel = netStr(outCol(row, 'EXCELSTATUS'));
    const edit = netStr(outCol(row, 'ISEDIT'));
    const _opIsDownloadAllowed = toInt(excel === '' ? '0' : excel, 16);
    const _opIsEditAllowed = toInt(edit === '' ? '0' : edit, 16);
    return { _opIsDownloadAllowed, _opIsEditAllowed };
  }

  /** "~" + Request.Url.AbsolutePath, with the Express mount prefix ('/admin') removed. */
  static legacyUrl(req, prefix = '/admin') {
    const p = String((req && (req.originalUrl || req.url)) || '').split('?')[0];
    const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=/|$)', 'i');
    return '~' + (p.replace(re, '') || '/');
  }

  /** Express middleware factory: sets req.permissions = { url, isactive, isedit, excelactive } (the legacy ViewBag names). */
  static middleware(options = {}) {
    const getUrl = options.getUrl || ((req) => CheckPermissions.legacyUrl(req));
    const getEmpId = options.getEmpId || ((req) => (req.user ? req.user.emp_id : undefined));
    const pageAction = options.pageAction !== false;
    const excel = options.excel !== false;
    return async function checkPermissionsMiddleware(req, res, next) {
      try {
        const url = getUrl(req);
        const perm = { url };
        if (pageAction) {
          const r = await CheckPermissions.GetPageActionPermission(url, getEmpId(req));
          perm.isactive = r._opIsDownloadAllowed;
          perm.isedit = r._opIsEditAllowed;
        }
        if (excel) perm.excelactive = await CheckPermissions.GetExcelPermission(url);
        req.permissions = perm;
        next();
      } catch (e) {
        next(e);
      }
    };
  }
}

module.exports = CheckPermissions;
