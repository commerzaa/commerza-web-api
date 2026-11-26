'use strict';
/**
 * Helpers private to admin port batch13-02 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports:
 *   ATTRIBUTE_PROPS, KIT_MASTER_PROPS, TBL_EMAILTEMPLATE_PROPS, TBL_EMAILACCOUNT_PUBLIC_PROPS, TBL_SMSTEMPLATE_PROPS
 *   jsonDenyGet(req, res)                              - `return Json(JsonRequestBehavior.AllowGet)` (enum passed as DATA, behavior DenyGet)
 *   jsonNull(res)                                      - `Json(null)` (JsonResult writes nothing)
 *   excelLinkEmpty0(url)                               - USP_EXCEL_LINK with the `v == "" ? "0" : v` test
 *   cleanProfileName(v)                                - ProfileImage cleaning (Trim, &amp; / & => And, Regex [^\w\d] removed, ' ' => '-')
 *   decodeDataUrlImage(base64String)                   - "base64," prefix handling + Convert.FromBase64String + Image.FromStream validation
 *   ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder)  - ProductList / ProductManagement static helper
 *   productIndex(req, res, opts)                       - shared Index(...) of ProductList / ProductManagement
 *   productExportReport(req, res, url, Prcode, prname, PCategory, ViewBag)
 *   productHandlers                                    - BINDATTRIBUTE, Getkitdetils, DeleteProductforhamaramart, Getattribute, Updateattribute
 *   productImage(req, IMAGE)                           - "#region PackageImage" of UpdateProduct (returns imgname)
 *   SendSMS(mobileNo, message, ApiType) / SaveSMSHistory(mobile, message, status) - Controllers/AdminPanel/sendMessageToMobile.cs (not in src/lib)
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('../../../db');
const config = require('../../../config');
const { mapRows, mapRow } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const DataUtility = require('../../../lib/admin/DataUtility');
const Save_ImageFile = require('../../../lib/Save_ImageFile');
const { errorInsert, getAdminMenu } = require('./admin-session');
const {
  DB, nre, nint, nstr, reqInt, toInt32, toDec, outStr, col, view, inlinePerms, excelLink, n2, nowStamp, tab, cs, excelHistory, tsvDownload,
} = require('./batch02-common');
const {
  MAINPRODUCTCATEGORY_PROPS, SUBPRODUCTCATEGORY_PROPS, KEYWORDADD_LIST_PROPS, PRODUCTMANAGEMENT_PROPS,
} = require('./batch02-stock');

/** class attribute (Controllers/AdminPanel/ProductManagement.cs) */
const ATTRIBUTE_PROPS = ['ddl_ID', 'Att_Name', 'DDDID', 'Content', 'Title', 'MPAID'];
/** Models/Kit_Master.cs (dbo.Kit_Master) */
const KIT_MASTER_PROPS = ['kid', 'PCode', 'Title', 'Image', 'Type', 'Amount', 'DAP', 'PV', 'BV', 'DistAmount', 'VatInPer', 'CMGAmount',
  'DirectIncome', 'BinaryIncome', 'Epin_Commission', 'EveryDayTaskIncome', 'Capping', 'SurfingSlot', 'Status', 'ROI', 'NoOfMonth', 'Decription', 'vat'];
/** Models/TBL_EMAILTEMPLATE.cs */
const TBL_EMAILTEMPLATE_PROPS = ['ETID', 'TITLE', 'SUBJECT', 'EMAILCONTENT'];
/** Models/TBL_EMAILACCOUNT.cs WITHOUT PASSWORD (PORT-NOTE: the SMTP password is not sent to the client) */
const TBL_EMAILACCOUNT_PUBLIC_PROPS = ['EAID', 'EMAILID', 'HOSTNAME', 'SMTPPORT', 'SENDERNAME', 'SENDEREMAIL', 'STATUS'];
/** Models/TBL_SMSTEMPLATE.cs */
const TBL_SMSTEMPLATE_PROPS = ['STID', 'TITLE', 'MESSAGE', 'UPDATEDON', 'UPDATEDBY', 'STATUS'];

/** return Json(JsonRequestBehavior.AllowGet): the enum (0) is the DATA and the behavior defaults to DenyGet
 *  => a GET request throws InvalidOperationException (500), any other verb returns 0. */
function jsonDenyGet(req, res) {
  if (req.method === 'GET') {
    return res.status(500).json({ message: 'This request has been blocked because sensitive information could be disclosed to third party web sites when this is used in a GET request. To allow GET requests, set JsonRequestBehavior to AllowGet.' });
  }
  return res.json(0);
}

/** Json(null): JsonResult writes no body */
const jsonNull = (res) => res.type('application/json').send('');

/** USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "" ? "0" : v) */
async function excelLinkEmpty0(url) {
  const er = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ev = outStr(col(er, 'isactive'));
  return toInt32(ev === '' ? '0' : ev);
}

/** ProfileImage.Trim().Replace("&amp;","And").Replace("&"," And "); Regex.Replace(x, @"[^\w\d]", ""); .Replace(" ", "-") */
function cleanProfileName(v) {
  if (v === null || v === undefined) throw nre();
  let s = String(v).trim();
  s = s.split('&amp;').join('And');
  s = s.split('&').join(' And ');
  s = s.replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}]/gu, '');
  return s.split(' ').join('-');
}

/** C# String.Substring(startIndex, length) argument checks */
function csSub(s, startIndex, length) {
  if (startIndex < 0 || length < 0 || startIndex + length > s.length) {
    throw new Error('Index and length must refer to a location within the string.\r\nParameter name: length');
  }
  return s.substr(startIndex, length);
}

/** if (base64String.Contains("base64,")) { ImageExt = ...; base64String = ...; } b = Convert.FromBase64String(...); Image.FromStream(ms) */
function decodeDataUrlImage(base64String) {
  if (base64String === null || base64String === undefined) throw nre();
  let s = String(base64String);
  if (s.includes('base64,')) {
    const IndexNo = s.indexOf('/') + 1;
    const lastIndexNo = s.indexOf(';');
    const ImageExt = csSub(s, IndexNo, lastIndexNo - IndexNo); // eslint-disable-line no-unused-vars
    const IndexNo1 = s.indexOf(',') + 1;
    s = s.substring(IndexNo1);
  }
  const clean = s.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
    throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  const b = Buffer.from(clean, 'base64');
  if (!Save_ImageFile.IsValidImage(b)) throw new Error('Parameter is not valid.'); // Image.FromStream
  return b;
}

/** public static void ResizeImage(string FullName, double scaleFactor, double filesize, MemoryStream fromstream, string Folder) (static => not an action) */
async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  if (!Save_ImageFile.IsValidImage(fromstream)) throw new Error('Parameter is not valid.'); // Image.FromStream
  fs.mkdirSync(path.dirname(FullName), { recursive: true });
  if (filesize > 100) {
    let out = fromstream;
    if (Folder === 'ThumbNail') {
      // PORT-NOTE: GetThumbnailImage(same size) saved as JPEG + Graphics redraw (System.Drawing) => sharp (lazy). Without sharp the original bytes are written.
      try { const sharp = require('sharp'); out = await sharp(fromstream).jpeg().toBuffer(); } catch (e) { out = fromstream; } // eslint-disable-line global-require
    }
    fs.writeFileSync(FullName, out);
  } else {
    fs.writeFileSync(FullName, fromstream); // image.Save(FullName)
  }
}

/** "#region PackageImage" of ProductList / ProductManagement UpdateProduct. Config: PackageImage */
async function productImage(req, IMAGE) {
  const regNo = req.user.emp_id;
  const loginid = req.user.emp_loginid;
  let imgname = '';
  if (IMAGE === null || IMAGE === undefined) throw nre(); // IMAGE.Trim()
  if (IMAGE.trim() !== '') {
    let base64String = '';
    const timestamp = await UtilityClass.GetTimestamp(new Date());
    const SavePaths = (config.app.PackageImage || '');
    if (IMAGE !== '') {
      base64String = IMAGE;
      const ProfileImage = cleanProfileName(loginid);
      imgname = ProfileImage + '-' + regNo + '_' + timestamp + '.png';
    } else {
      imgname = ' ';
    }
    const dir = path.join(config.uploadDir, String(SavePaths).replace(/^~?[\\/]*/, ''));
    const strValidFullName = path.join(dir, imgname);
    const b = decodeDataUrlImage(base64String);
    const filesize = b.length / 1024;
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const scaleFactor = 0.25;
    const oldimage = '';
    if (oldimage !== '') {
      // (unreachable in legacy: oldimage is always "")
    } else {
      await ResizeImage(strValidFullName, scaleFactor, filesize, b, 'ThumbNail');
    }
  }
  return imgname;
}

/** public void ExportReport(string Prcode, string prname, string PCategory) of ProductList / ProductManagement */
async function productExportReport(req, res, url, Prcode, prname, PCategory, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'ManageProductMaster_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const rows = await db.proc(DB, 'USP_CREATE_NEW_PIN_Product_List', {
    TKPMID: '0', STARTROWINDEX: 1, MAXROWS: 999999, Prcode, prname, CATEGORY: PCategory,
  });
  const ObjKit_Master = mapRows(rows, PRODUCTMANAGEMENT_PROPS);
  if (ObjKit_Master.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'ManageProductMaster.xls', Filename,
      headers: ['S.No.', 'Package Name', 'MRP', 'Purchase Cost(INC Cart.)', 'Our DAP', 'Business Volume (BV)', 'PV'],
      rows: ObjKit_Master,
      innerProc: 'ObjKit_Master',
      outerProc: 'ObjKit_Master',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.ProductName)) + ' \t');
        w(tab(n2(item.MRP)) + ' \t');
        w(tab(n2(item.ACTUALPRICE)) + ' \t');
        w(tab(n2(item.DISCOUNT)) + ' \t');
        w(tab(n2(item.DP)) + ' \t');
        w(tab(n2(item.BV)) + ' \t');
        const bv = Number(item.BV) / 350; // decimal bv = Convert.ToDecimal(item.BV / 350) (unused)
        void bv;
      },
    });
  }
  return { sent: false };
}

/**
 * Index(int? dynamicpagging, int? page, string Prcode, string prname, string PCategory, string btnexel) of ProductList / ProductManagement.
 * opts: { url (already set by the module), viewPath, excelEmpty0 (true: `v == "" ? "0" : v`, false: `v == "0" ? "0" : v`) }
 */
async function productIndex(req, res, opts) {
  const { url } = opts;
  let dynamicpagging = nint(req.p.dynamicpagging);
  let page = nint(req.p.page);
  let Prcode = nstr(req.p.Prcode);
  let prname = nstr(req.p.prname);
  let PCategory = nstr(req.p.PCategory);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = opts.excelEmpty0 ? await excelLinkEmpty0(url) : await excelLink(url);
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  if (dynamicpagging === null) dynamicpagging = 100;
  const MaxRows = toInt32(dynamicpagging);
  if (page === null) page = 1;
  if (Prcode === null) Prcode = '';
  if (PCategory === null) PCategory = '';
  if (btnexel === null) btnexel = '';
  if (prname === null) prname = '';
  const rows = await db.proc(DB, 'USP_CREATE_NEW_PIN_Product_List', {
    TKPMID: '0', STARTROWINDEX: page, MAXROWS: 100, Prcode, prname, CATEGORY: PCategory,
  });
  const ObjKit_Master = mapRows(rows, PRODUCTMANAGEMENT_PROPS);
  const tc = outStr(col(rows[0], 'totalcount'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.CurrentPage = page;
  ViewBag.Logintype = 'Admin';
  // [DBO].DDLBIND 1,0,'TBL_MAIN_CATEGORY' / 2,0,'TBL_CATEGORY' / 3,0,'TBL_SUB_CATEGORY'
  ViewBag.category = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 1, DDLID: 0, DDLTABLETYPE: 'TBL_MAIN_CATEGORY' }), MAINPRODUCTCATEGORY_PROPS);
  ViewBag.subcategory = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 2, DDLID: 0, DDLTABLETYPE: 'TBL_CATEGORY' }), SUBPRODUCTCATEGORY_PROPS);
  ViewBag.subsubcategory = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 3, DDLID: 0, DDLTABLETYPE: 'TBL_SUB_CATEGORY' }), KEYWORDADD_LIST_PROPS);
  if (btnexel === 'Export Excel') {
    const r = await productExportReport(req, res, url, Prcode, prname, PCategory, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, opts.viewPath, ObjKit_Master, ViewBag);
}

/** Identical JSON actions of ProductList / ProductManagement (handlers; routes are registered by each module). */
const productHandlers = {
  /** JsonResult BINDATTRIBUTE(int Main, int Category, int subcategory, int Mode, int DDID) */
  async BINDATTRIBUTE(req, res) {
    const MAINID = reqInt(req.p.Main, 'Main');
    const CATID = reqInt(req.p.Category, 'Category');
    const SUBCATID = reqInt(req.p.subcategory, 'subcategory');
    const MODE = reqInt(req.p.Mode, 'Mode');
    const DDID = reqInt(req.p.DDID, 'DDID');
    const attr = mapRows(await db.proc(DB, 'USP_ATTRIBUTESBIND', { MAINID, CATID, SUBCATID, MODE, DDID }), ATTRIBUTE_PROPS);
    return res.json(attr);
  },
  /** JsonResult Getkitdetils(int TKPMID) */
  async Getkitdetils(req, res) {
    const TKPMID = reqInt(req.p.TKPMID, 'TKPMID');
    const rows = await db.proc(DB, 'USP_CREATE_NEW_PIN_Product_List', { TKPMID });
    if (!rows.length) return jsonNull(res);
    return res.json(mapRow(rows[0], PRODUCTMANAGEMENT_PROPS));
  },
  /** JsonResult DeleteProductforhamaramart(string PrCode) */
  async DeleteProductforhamaramart(req, res) {
    const PrCode = nstr(req.p.PrCode);
    // DbObj._Purchase_Bill (dbo.TBL_PURCHASE_BILL).Where(s => s.SubPrCode == PrCode).FirstOrDefault()  (null PrCode => IS NULL in EF)
    const subrow = await db.queryOne(DB, 'select sprid, isdelete from tbl_purchase_bill where subprcode is not distinct from @PrCode limit 1', { PrCode });
    if (!subrow) return res.json('No Such Sub Product Exists');
    if (col(subrow, 'isdelete') === true) return res.json('ok');
    await db.exec(DB, 'update tbl_purchase_bill set isdelete = true, status = false where sprid = @id', { id: col(subrow, 'sprid') });
    return res.json('ok');
  },
  /** JsonResult Getattribute(int TKPMID) */
  async Getattribute(req, res) {
    const TKPMID = reqInt(req.p.TKPMID, 'TKPMID');
    let attrt = [];
    if (TKPMID !== 0) {
      try {
        attrt = mapRows(await db.proc(DB, 'USP_GETATTRIBUTE', { TKPMID }), ATTRIBUTE_PROPS);
      } catch (e) {
        return jsonDenyGet(req, res); // catch { return Json(JsonRequestBehavior.AllowGet); }
      }
    }
    return res.json(attrt);
  },
  /** JsonResult Updateattribute(string MPAID, int Category, int PSCID, int PSSCID, string attr_name) */
  async Updateattribute(req, res) {
    const Category = reqInt(req.p.Category, 'Category');
    const PSCID = reqInt(req.p.PSCID, 'PSCID');
    const PSSCID = reqInt(req.p.PSSCID, 'PSSCID');
    const MPAID = nstr(req.p.MPAID);
    const attr_name = nstr(req.p.attr_name);
    const Ret = '0';
    if (MPAID === null) throw nre(); // MPAID.ToString()
    const ID = MPAID.split('^');
    if (attr_name === null) throw nre();
    const str1 = attr_name.split('^');
    for (let i = 0; i < ID.length; i++) {
      if (i >= str1.length) throw new Error('Index was outside the bounds of the array.');
      const DDLID = str1[i].split('~');
      const MPAIDv = toInt32(ID[i]);
      if (DDLID.length < 2) throw new Error('Index was outside the bounds of the array.');
      // [DBO].[UPS_UPDATEATTRIBUTE] @MPAID,@title,@Value,@MAINCATID,@PSCID,@PSSCID,@SP_OUT out
      await db.proc(DB, 'UPS_UPDATEATTRIBUTE', {
        MPAID: MPAIDv, title: DDLID[0], Value: toInt32(DDLID[1]), MAINCATID: Category, PSCID, PSSCID,
      });
    }
    return res.json(Ret);
  },
};

/** sendMessageToMobile.SaveSMSHistory(string mobile, string message, int status) : int */
async function SaveSMSHistory(mobile, message, status) {
  let result = 0;
  if (mobile === null || mobile === undefined) throw nre();
  const mobiles = String(mobile).split(',');
  const objdut = new DataUtility();
  if (message === null || message === undefined) throw new Error('Value cannot be null.\r\nParameter name: input');
  const messageWithStar = String(message).replace(/[0-9]/g, '*');
  for (let i = 0; i < mobiles.length; i++) {
    const param = [
      DataUtility.SqlParameter('@MOBILE', mobiles[i]),
      DataUtility.SqlParameter('@MESSAGE', messageWithStar),
      DataUtility.SqlParameter('@STATUS', status),
      DataUtility.SqlParameter('@INTRESULT', 0, 'Output'),
      DataUtility.SqlParameter('@mode', 1),
    ];
    result = await objdut.ExecuteSqlSP(param, '[USP_MANAGESMSHISTORY]');
  }
  return result;
}

/** HttpWebRequest GET + GetResponse() (non-2xx / empty / relative URL => exception like WebRequest.Create / GetResponse) */
async function webGet(API) {
  if (API === null || API === undefined) throw nre();
  if (String(API) === '') throw new Error('Invalid URI: The URI is empty.');
  await axios.get(String(API), { responseType: 'text', transformResponse: (x) => x });
}

/** Controllers/AdminPanel/sendMessageToMobile.cs SendSMS(string mobileNo, string message, string ApiType = "0") (static helper, not ported to src/lib) */
async function SendSMS(mobileNo, message, ApiType = '0') {
  let TranAPI = '';
  const PromoAPI = '';
  let API = '';
  const objapidata = await db.query(DB, 'select said, prom_api, tran_api from tbl_smsapi', {});
  TranAPI = objapidata.length ? col(objapidata[0], 'tran_api') : null;
  try {
    if (ApiType === '1') {
      if (TranAPI === null || TranAPI === undefined) throw nre();
      API = String(TranAPI).split('1111111111').join(mobileNo === null || mobileNo === undefined ? '' : mobileNo);
      API = API.split('DummyText').join(message === null || message === undefined ? '' : message);
      await webGet(API);
    } else {
      if (mobileNo === null || mobileNo === undefined) throw nre();
      const mobileNos = String(mobileNo).split(',');
      for (let i = 0; i < mobileNos.length; i++) {
        API = PromoAPI;
        API = API.split('1111111111').join(mobileNos[i]);
        API = API.split('DummyText').join(message === null || message === undefined ? '' : message);
        // PORT-NOTE: legacy PromoAPI is always "" => WebRequest.Create("") threw UriFormatException => "SMS Sending Fail" (kept).
        await webGet(API);
        await SaveSMSHistory(mobileNo, message, 1);
        API = '';
      }
    }
    return 'SMS Sent Successfully';
  } catch (ExpObj) {
    try {
      await new DataUtility().ErrorInsert(0, ExpObj.message, 'SendSMS', 0, 'Controllers/AdminPanel/sendMessageToMobile');
    } catch (e) { console.error('[admin] ErrorInsert failed:', e.message); }
    await SaveSMSHistory(mobileNo, message, 2);
    return 'SMS Sending Fail';
  }
}

module.exports = {
  ATTRIBUTE_PROPS, KIT_MASTER_PROPS, TBL_EMAILTEMPLATE_PROPS, TBL_EMAILACCOUNT_PUBLIC_PROPS, TBL_SMSTEMPLATE_PROPS,
  jsonDenyGet, jsonNull, excelLinkEmpty0, cleanProfileName, decodeDataUrlImage, ResizeImage, productImage, productExportReport, productIndex,
  productHandlers, SendSMS, SaveSMSHistory, errorInsert, toDec,
};
