'use strict';
/**
 * Shared logic of Controllers/AdminPanel/add_stock.cs (add_stockController) and Add_Purchase_Stock.cs (Add_Purchase_StockController):
 * the two C# controllers are line-by-line identical except the view path and the upper/lower case spelling of the
 * edit/delete procedure names and parameter names (case-insensitive in PostgreSQL). Not a router (lives in _shared/).
 * Exports: registerStockRoutes(router, C, viewPath, routeConfigUrls[]), model prop lists, bindAddStockDetails, bindEditStockDetails
 * Models (declared in add_stock.cs): AddStockDetails, CartStockList, EditStockDetails, CartStockList_Edit, productFromBatchno, img_gallary,
 *   DDLPRODUCTMASTER, ChallanCheck. Models from other C# files: mainPRODUCTCATEGORY / subPRODUCTCATEGORY / keywordadd_list (keyword_add.cs),
 *   ProductManagement / GST (ProductManagement.cs).
 */
const db = require('../../../db');
const { optionalAuth } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, isAdmin } = require('./admin-session');
const { DB, nstr, nre, toInt32, outStr, col, view, mapRows, mapRow } = require('./batch02-common');

const MAINPRODUCTCATEGORY_PROPS = ['CATID', 'CATNAME'];
const SUBPRODUCTCATEGORY_PROPS = ['SCATID', 'SCATNAME'];
const KEYWORDADD_LIST_PROPS = ['ROWNUMBER', 'KMID', 'KEYWORDNAME', 'KACTIVE', 'CATNAME', 'SCATNAME', 'CATID', 'MAINCATID'];
const PRODUCTMANAGEMENT_PROPS = ['TKPMID', 'NAME', 'CODE', 'MRP', 'DISCOUNT', 'DP', 'BV', 'RBV', 'DISCRIPTION', 'IMAGES', 'ACTIVE', 'STATUS', 'GST',
  'HANDLINGFEE', 'PCMID', 'CATEGORY', 'BARCODE', 'COLOR', 'SIZE', 'UNITID', 'UNIT', 'BRANDID', 'HSNCODE', 'PSCID', 'PSSCID', 'prcode', 'PRSHORTNAME',
  'SubCatName', 'ProductName', 'ROWNUMBER', 'Productcode', 'Discounttype', 'KeyFeatures', 'ACTUALPRICE', 'GSTVALUE', 'AVAILABLE', 'INSTOCK',
  'OUTSTOCK', 'isnewoffer', 'isnewarrival', 'isbigsaving', 'isfestivaloffer', 'isquickshop', 'Purchaseprice', 'PrCount', 'PR_TYPE'];
const GST_PROPS = ['GSTID', 'VALUE', 'Name'];
const CHALLANCHECK_PROPS = ['vendorid', 'challanno', 'challandate', 'IsVatInc', 'Total_Cortage', 'total_PuchaseCost', 'ShipChg', 'Gst_vat', 'FRID'];

/** C# decimal model property: missing => 0 */
function dec(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`The value '${v}' is not valid for Decimal.`);
  return n;
}
/** decimal.ToString() inside string concatenation. PORT-NOTE: a numeric string keeps its scale ("10.50"), a JSON number prints as JS does. */
function decStr(v) {
  if (v === undefined || v === null || v === '') return '0';
  if (typeof v === 'string' && Number.isFinite(Number(v))) return v.trim().replace(/^\+/, '');
  return String(dec(v));
}
const sstr = (v) => (v === undefined || v === null ? null : String(v)); // string property (JSON binding keeps "")
const cat = (v) => (v === null || v === undefined ? '' : String(v)); // C# null in string concatenation => ""
function int(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`The value '${v}' is not valid for Int32.`);
  return n;
}

/** List<T> things model binding (JSON body {things:[...]} / [...] / form things[0].x is not supported) */
function bindList(req) {
  const b = req.body;
  if (Array.isArray(b)) return b;
  if (b && Array.isArray(b.things)) return b.things;
  if (b && typeof b.things === 'string') { try { const x = JSON.parse(b.things); if (Array.isArray(x)) return x; } catch (_) { /* ignore */ } }
  return null;
}

/** Concatenation fields of one cart row */
const rowHead = (item) => [cat(item.PRNAME === null || item.PRNAME === undefined ? (() => { throw nre(); })() : String(item.PRNAME).split('|').join(' ')),
  cat(item.PRID), decStr(item.QTY), decStr(item.Disc_After_Vat), cat(item.BatchNo), decStr(item.PurchaseCost), decStr(item.COST), decStr(item.BV),
  decStr(item.DAP), decStr(item.VatPerc), decStr(item.MRP), String(int(item.Vcid)), decStr(item.freeQty), decStr(item.GCost), decStr(item.DAP_T)];

/** "dd-MM-yyyy" => "yyyy-MM-dd" by split (IndexOutOfRange => catch) */
function flipDate(s) {
  const arr = s.split('-');
  if (arr.length < 3) throw new Error('Index was outside the bounds of the array.');
  return arr[2] + '-' + arr[1] + '-' + arr[0];
}

function registerStockRoutes(router, C, viewPath, routeConfigUrls = []) {
  // ---------------------------------------------------------------- Index()
  // auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, ...routeConfigUrls], adminAuth, asyncHandler(async (req, res) => {
    const PRODUCTCATEGORY = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 1, DDLID: 0, DDLTABLETYPE: 'TBL_MAIN_CATEGORY' }), MAINPRODUCTCATEGORY_PROPS);
    const subPRODUCTCATEGORY = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 2, DDLID: 0, DDLTABLETYPE: 'TBL_CATEGORY' }), SUBPRODUCTCATEGORY_PROPS);
    const subsubproductcategory = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 3, DDLID: 0, DDLTABLETYPE: 'TBL_SUB_CATEGORY' }), KEYWORDADD_LIST_PROPS);
    return view(res, viewPath, undefined, { category: PRODUCTCATEGORY, subcategory: subPRODUCTCATEGORY, subsubcategory: subsubproductcategory });
  }));

  // ---------------------------------------------------------------- JsonResult Getkitdetils(string PRCODE)
  // auth (legacy had no session check; admin data => adminAuth)
  router.all(`/admin/${C}/Getkitdetils{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const rows = await db.proc(DB, 'USP_CREATE_NEW_PIN_Product_List', {
      TKPMID: '0', STARTROWINDEX: 1, MAXROWS: 100, Prcode: nstr(req.p.PRCODE), prname: '', CATEGORY: '', mode: '2',
    });
    if (!rows.length) return res.type('application/json').send(''); // Json(null)
    return res.json(mapRow(rows[0], PRODUCTMANAGEMENT_PROPS));
  }));

  // ---------------------------------------------------------------- JsonResult insertStockFromVendor(List<AddStockDetails> things)
  // auth-by-check (legacy returned Json("Session Expired. Please login again"))
  router.all(`/admin/${C}/insertStockFromVendor{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
    let IsVatInc = '0';
    let OutputResult = '';
    if (!isAdmin(req)) return res.json('Session Expired. Please login again');
    const Emp_Code = req.user.emp_code;
    const things = bindList(req);
    if (!things || !things.length) throw (things ? new Error('Index was out of range. Must be non-negative and less than the size of the collection.') : nre());
    const t0 = things[0] || {};
    IsVatInc = sstr(t0.IsVatInc);
    if (IsVatInc === '' || IsVatInc === null) IsVatInc = '1';
    if (IsVatInc !== '1' && IsVatInc !== '0') return res.json('Please select vat type !');
    const branch = sstr(t0.branch);
    const vendor = sstr(t0.vendor);
    const challanno = sstr(t0.challanno);
    const challandate = sstr(t0.challandate);
    const invoicetype = String(int(t0.invoicetype));
    const OtherAmt = dec(t0.OtherAmt);
    let remarks = sstr(t0.remarks);
    const totalPurchaseCosts = dec(t0.totalPurchaseCost);
    const TotalCartages = dec(t0.TotalCartage);
    const TotalDiscAfterVat = dec(t0.TotalDiscAfterVat);
    const cartageInPercents = dec(t0.cartageInPercent);
    const vat_gst = sstr(t0.vat_gst);
    const manualpurchasecost = dec(t0.manualpurchasecost);
    let prodrow = '';
    let Exp = '';
    if (remarks === null) remarks = '';
    const list = t0.CartStockList;
    if (!Array.isArray(list)) throw nre(); // foreach over null
    for (const item0 of list) {
      const item = item0 || {};
      try {
        if (sstr(item.ExpiredOn) !== '') {
          if (item.ExpiredOn === null || item.ExpiredOn === undefined) throw nre();
          Exp = flipDate(String(item.ExpiredOn).split('|').join(' '));
        }
      } catch (ex) {
        Exp = '';
      }
      if (prodrow === '') {
        prodrow = [...rowHead(item), decStr(item.Vat_Amt), Exp, decStr(item.unitpricewithoutcartage)].join('|');
      } else {
        prodrow = prodrow + '~' + [...rowHead(item), decStr(item.Vat_Amt), Exp].join('|');
      }
      const gst_id = int(item.Vcid);
      try {
        let chanendate = '';
        try {
          if (cat(challandate) !== '') chanendate = flipDate(challandate);
        } catch (ex) {
          chanendate = '';
        }
        const row = await db.procOne(DB, 'USP_INSERTSTOCKTOSTOREFROMVENDOR', {
          branch, vendor, challanno, challandate: chanendate, invoicetype, OtherAmt, remarks, prodrow, sessionID: Emp_Code,
          totalPurchaseCost: totalPurchaseCosts, TotalCartage: TotalCartages, cartageInPercent: cartageInPercents, IsVatInc: toInt32(IsVatInc),
          TotalDiscAfterVat, vat_gst, GSTID: gst_id, MANUALPURCHASECOST: manualpurchasecost,
        });
        OutputResult = outStr(col(row, 'strresult'));
        prodrow = '';
        const Retvalue = OutputResult.split('^');
        if (Retvalue[0] === 'ok') {
          if (Retvalue.length < 2) throw new Error('Index was outside the bounds of the array.');
          OutputResult = 'ok^' + (await UtilityClass.Encryptword(Retvalue[1]));
        }
      } catch (ex) {
        OutputResult = 'Something went wrong. Please try later';
      }
    }
    return res.json(OutputResult);
  }));

  // ---------------------------------------------------------------- JsonResult EditAddedStockFromVendor(List<EditStockDetails> things)
  // auth-by-check (legacy returned Json("Session Expired. Please login again"))
  router.all(`/admin/${C}/EditAddedStockFromVendor{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
    if (!isAdmin(req)) return res.json('Session Expired. Please login again');
    const things = bindList(req);
    if (!things || !things.length) throw (things ? new Error('Index was out of range. Must be non-negative and less than the size of the collection.') : nre());
    const t0 = things[0] || {};
    let IsVatInc = sstr(t0.IsVatInc);
    if (IsVatInc === '' || IsVatInc === null) IsVatInc = '1';
    if (IsVatInc !== '1' && IsVatInc !== '0') return res.json('Please select vat type !');
    let ref_no = sstr(t0.ref_no);
    // `if (ref_no != "" || ref_no != null)` is always true
    ref_no = await UtilityClass.Decryptword(ref_no);
    const challanno = sstr(t0.challanno);
    let challandate = sstr(t0.challandate);
    const invoicetype = String(int(t0.invoicetype));
    const OtherAmt = dec(t0.OtherAmt);
    let remarks = sstr(t0.remarks);
    const totalPurchaseCosts = dec(t0.totalPurchaseCost);
    const TotalCartages = dec(t0.TotalCartage);
    const TotalDiscAfterVat = dec(t0.TotalDiscAfterVat);
    const cartageInPercents = dec(t0.cartageInPercent);
    let vat_gst = sstr(t0.vat_gst);
    let prodrow = '';
    let Exp = '';
    if (remarks === null) remarks = '';
    if (vat_gst === null) vat_gst = '';
    const list = t0.CartStockList;
    if (!Array.isArray(list)) throw nre();
    for (const item0 of list) {
      const item = item0 || {};
      try {
        if (sstr(item.ExpiryDate) !== '') {
          if (item.ExpiryDate === null || item.ExpiryDate === undefined) throw nre();
          Exp = flipDate(String(item.ExpiryDate).split('|').join(' '));
        }
      } catch (ex) {
        Exp = '';
      }
      const part = [...rowHead(item), cat(item.pfvid === undefined || item.pfvid === null ? 0 : item.pfvid), decStr(item.Vat_Amt), decStr(item.Gst_vat), Exp,
        decStr(item.unitpricewithoutcartage)].join('|');
      prodrow = prodrow === '' ? part : prodrow + '~' + part;
    }
    const au = req.user;
    try {
      let OutputResult = '';
      try {
        if (cat(challandate) !== '') challandate = flipDate(challandate);
      } catch (ex) {
        challandate = '';
      }
      const row = await db.procOne(DB, 'USP_EDITADDEDSTOCKFROMVENDOR', {
        REF_NO: ref_no, BRANCH: '0', VENDOR: '0', CHALLANNO: challanno, CHALLANDATE: challandate, INVOICETYPE: invoicetype, OTHERAMT: OtherAmt,
        REMARKS: remarks, PRODROW: prodrow, SESSIONID: au.emp_code, TOTALPURCHASECOST: totalPurchaseCosts, TOTALCARTAGE: TotalCartages,
        CARTAGEINPERCENT: cartageInPercents, ISVATINC: IsVatInc, TOTALDISCAFTERVAT: TotalDiscAfterVat, VAT_GST: vat_gst,
      });
      OutputResult = outStr(col(row, 'strresult'));
      prodrow = '';
      const Retvalue = OutputResult.split('^');
      if (Retvalue[0] === 'ok') {
        if (Retvalue.length < 2) throw new Error('Index was outside the bounds of the array.');
        OutputResult = 'ok^' + (await UtilityClass.Encryptword(Retvalue[1]));
      }
      return res.json(OutputResult);
    } catch (ex) {
      return res.json('Something went wrong. Please try later');
    }
  }));

  // ---------------------------------------------------------------- JsonResult DeleteAddedStockFromVendor(string refno)
  // auth-by-check (legacy returned Json("") without a session)
  router.all(`/admin/${C}/DeleteAddedStockFromVendor{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
    try {
      if (!isAdmin(req)) return res.json('');
      const refno = await UtilityClass.Decryptword(nstr(req.p.refno));
      const row = await db.procOne(DB, 'USP_DELETEADDEDSTOCKFROMVENDOR', { REF_NO: refno, SESSIONID: req.user.emp_code });
      return res.json(outStr(col(row, 'strresult')));
    } catch (ex) {
      return res.json('error^' + ex.message);
    }
  }));

  // ---------------------------------------------------------------- JsonResult Fetch_ChallanNo(string ChallanNo, string ChallanDate, string venderid)
  // auth (legacy had no session check; admin data => adminAuth)
  router.all(`/admin/${C}/Fetch_ChallanNo{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const outPutResult = 0;
    try {
      const venderid = toInt32(nstr(req.p.venderid));
      // convert(varchar(100),challandate,105) = dd-mm-yyyy ; legacy concatenated the values (SQL injection) => parameterised
      // PORT-NOTE: tbl_stock_from_vendor is not in the Db_Affiliate schema dump (only referenced by procedures).
      const obj = await db.queryOne(DB, `select frid, vendorid, to_char(challandate, 'DD-MM-YYYY') as challandate,
          coalesce(manualpurchasecost, 0) as total_puchasecost, coalesce(total_cortage, 0) as total_cortage, shipchg, gst_vat, isvatinc
        from tbl_stock_from_vendor where to_char(challandate, 'DD-MM-YYYY') = @ChallanDate and challanno = @ChallanNo and vendorid = @venderid limit 1`, {
        ChallanDate: cat(nstr(req.p.ChallanDate)), ChallanNo: cat(nstr(req.p.ChallanNo)), venderid,
      });
      if (obj) return res.json(mapRow(obj, CHALLANCHECK_PROPS));
      return res.json(outPutResult);
    } catch (ex) {
      return res.json('');
    }
  }));

  // ---------------------------------------------------------------- JsonResult Taxtype(string taxType)
  // auth (legacy had no session check; admin data => adminAuth)
  router.all(`/admin/${C}/Taxtype{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    try {
      const taxType = nstr(req.p.taxType);
      // legacy: "... and TTTID=" + taxType  (SQL injection; a non-numeric value was an SQL error => catch => "")
      if (taxType === null || !Number.isFinite(Number(taxType)) || taxType.trim() === '') throw new Error('Incorrect syntax');
      const rows = await db.query(DB, `select gstid, (name || '(' || (value)::varchar(100) || ')') as name, coalesce(value, 0) as value
        from tbl_gstgroup where active = 1 and tttid = @t`, { t: Number(taxType) });
      return res.json(mapRows(rows, GST_PROPS));
    } catch (ex) {
      return res.json('');
    }
  }));
}

module.exports = {
  registerStockRoutes, MAINPRODUCTCATEGORY_PROPS, SUBPRODUCTCATEGORY_PROPS, KEYWORDADD_LIST_PROPS, PRODUCTMANAGEMENT_PROPS, GST_PROPS, CHALLANCHECK_PROPS,
};
