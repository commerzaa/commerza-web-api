'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\AddProduct.cs (class AddProductController)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Save_ImageFile = require('../../lib/Save_ImageFile');
const { adminAuth, errorInsert, legacyUrl, getAdminMenu } = require('./_shared/adminSession');
const {
  DB, nint, nstr, nre, reqInt, toInt32, toDec, outStr, col, view, inlinePerms, n2, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, mapRow,
} = require('./_shared/batch02_common');
const {
  MAINPRODUCTCATEGORY_PROPS, SUBPRODUCTCATEGORY_PROPS, KEYWORDADD_LIST_PROPS, PRODUCTMANAGEMENT_PROPS,
} = require('./_shared/batch02_stock');

const router = express.Router();
const C = 'AddProduct';

/** class attribute (Controllers/AdminPanel/ProductManagement.cs) */
const ATTRIBUTE_PROPS = ['ddl_ID', 'Att_Name', 'DDDID', 'Content', 'Title', 'MPAID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** base64 data-url handling + Image.FromStream validation shared by ImageSave */
function decodeImage(base64String) {
  if (base64String.includes('base64,')) {
    const IndexNo1 = base64String.indexOf(',') + 1;
    base64String = base64String.substring(IndexNo1);
  }
  const clean = base64String.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
    throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  const b = Buffer.from(clean, 'base64');
  if (!Save_ImageFile.IsValidImage(b)) throw new Error('Parameter is not valid.'); // Image.FromStream
  return b;
}

// public void ExportReport(string Prcode, string prname, string PCategory)
async function ExportReport(req, res, Prcode, prname, PCategory, ViewBag) {
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
        const bv = Number(item.BV) / 350; // computed, unused (legacy)
        void bv;
      },
    });
  }
  return { sent: false };
}

// public string ImageSave(string IMAGE)
// Config: PackageImage (folder, legacy AppSettings["PackageImage"])
async function ImageSave(req, IMAGE) {
  const regNo = req.user.emp_id;
  const loginid = req.user.emp_loginid;
  let imgname = '';
  let base64String = '';
  const timestamp = await UtilityClass.GetTimestamp(new Date());
  const SavePaths = (config.app.PackageImage || '');
  if (IMAGE !== '') {
    if (IMAGE === null || IMAGE === undefined) throw nre(); // base64String.Contains on null
    base64String = IMAGE;
    if (loginid === null || loginid === undefined) throw nre();
    let ProfileImage = String(loginid);
    ProfileImage = ProfileImage.trim();
    ProfileImage = ProfileImage.split('&amp;').join('And');
    ProfileImage = ProfileImage.split('&').join(' And ');
    ProfileImage = ProfileImage.replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}]/gu, '');
    ProfileImage = ProfileImage.split(' ').join('-');
    imgname = ProfileImage + '-' + regNo + '_' + timestamp + '.png';
  } else {
    imgname = ' ';
  }
  const dir = path.join(config.uploadDir, String(SavePaths).replace(/^~?[\\/]*/, ''));
  const strValidFullName = path.join(dir, imgname);
  const b = decodeImage(base64String);
  if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
  // oldimage == "" => img.Save(strValidFullName)
  // PORT-NOTE: Image.Save(path) re-encoded the image in its own format; the decoded bytes are written unchanged.
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(strValidFullName, b);
  return imgname;
}

// public static void ResizeImage(string FullName, double scaleFactor, double filesize, MemoryStream fromstream, string Folder)  (static => not an action; unused)
async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  if (!Save_ImageFile.IsValidImage(fromstream)) throw new Error('Parameter is not valid.'); // Image.FromStream
  if (filesize > 100) {
    let out = fromstream;
    if (Folder === 'ThumbNail') {
      // PORT-NOTE: GetThumbnailImage(same size) saved as JPEG => sharp (lazy). Without sharp the original bytes are written.
      try { const sharp = require('sharp'); out = await sharp(fromstream).jpeg().toBuffer(); } catch (e) { out = fromstream; }
    }
    fs.writeFileSync(FullName, out);
  } else {
    fs.writeFileSync(FullName, fromstream);
  }
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, int? page, string Prcode, string prname, string PCategory, string btnexel, int? TKPMID)
// auth (reads Session["Admin_User"] first; then Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/AddProduct" -> AddProduct/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/AddProduct'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let page = nint(req.p.page);
  let Prcode = nstr(req.p.Prcode);
  let prname = nstr(req.p.prname);
  let PCategory = nstr(req.p.PCategory);
  let btnexel = nstr(req.p.btnexel);
  const TKPMID = nint(req.p.TKPMID);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (TKPMID !== null) ViewBag.TKPMID = TKPMID;
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out  => Convert.ToInt32(v == "" ? "0" : v)  (this controller tests "" instead of "0")
  const er = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ev = outStr(col(er, 'isactive'));
  ViewBag.excelactive = toInt32(ev === '' ? '0' : ev);
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
  ViewBag.category = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 1, DDLID: 0, DDLTABLETYPE: 'TBL_MAIN_CATEGORY' }), MAINPRODUCTCATEGORY_PROPS);
  ViewBag.subcategory = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 2, DDLID: 0, DDLTABLETYPE: 'TBL_CATEGORY' }), SUBPRODUCTCATEGORY_PROPS);
  ViewBag.subsubcategory = mapRows(await db.proc(DB, 'DDLBIND', { MODE: 3, DDLID: 0, DDLTABLETYPE: 'TBL_SUB_CATEGORY' }), KEYWORDADD_LIST_PROPS);
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, Prcode, prname, PCategory, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/AddProduct/Index.cshtml', ObjKit_Master, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(string Prcode, string prname, string PCategory)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nstr(req.p.Prcode), nstr(req.p.prname), nstr(req.p.PCategory), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult BINDATTRIBUTE(int Main, int Category, int subcategory, int Mode, int DDID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/BINDATTRIBUTE{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const MAINID = reqInt(req.p.Main, 'Main');
  const CATID = reqInt(req.p.Category, 'Category');
  const SUBCATID = reqInt(req.p.subcategory, 'subcategory');
  const MODE = reqInt(req.p.Mode, 'Mode');
  const DDID = reqInt(req.p.DDID, 'DDID');
  const attr = mapRows(await db.proc(DB, 'USP_ATTRIBUTESBIND', { MAINID, CATID, SUBCATID, MODE, DDID }), ATTRIBUTE_PROPS);
  return res.json(attr);
}));

// ---------------------------------------------------------------- JsonResult Getkitdetils(int TKPMID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Getkitdetils{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TKPMID = reqInt(req.p.TKPMID, 'TKPMID');
  const rows = await db.proc(DB, 'USP_CREATE_NEW_PIN_Product_List', { TKPMID });
  if (!rows.length) return res.type('application/json').send(''); // Json(null)
  return res.json(mapRow(rows[0], PRODUCTMANAGEMENT_PROPS));
}));

// ---------------------------------------------------------------- JsonResult BINDATTRIBUTE_Values(int TKPMID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/BINDATTRIBUTE_Values{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TKPMID = reqInt(req.p.TKPMID, 'TKPMID');
  // legacy concatenated the int TKPMID into the SQL; parameterised here
  const rows = await db.query(DB, `select title, dd.dddid from ims_masterproductattribute as at
      inner join tbl_dropdowndetails as dd on at.value = dd.dddid
    where at.status = 1 and prid = @TKPMID and title in (select title from ims_masterproductattribute where prid = @TKPMID and status = 1)
    order by at.mpaid desc`, { TKPMID });
  return res.json(mapRows(rows, ATTRIBUTE_PROPS).map((r) => ({ ...r, ddl_ID: r.ddl_ID ?? 0, MPAID: r.MPAID ?? 0 })));
}));

// ---------------------------------------------------------------- JsonResult DeleteProductforhamaramart(string PrCode)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/DeleteProductforhamaramart{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const PrCode = nstr(req.p.PrCode);
  // DbObj._Purchase_Bill (dbo.TBL_PURCHASE_BILL).Where(s => s.SubPrCode == PrCode).FirstOrDefault()  (null PrCode => "IS NULL" in EF)
  const subrow = await db.queryOne(DB, 'select sprid, isdelete from tbl_purchase_bill where subprcode is not distinct from @PrCode limit 1', { PrCode });
  if (!subrow) return res.json('No Such Sub Product Exists');
  if (col(subrow, 'isdelete') === true) return res.json('ok');
  await db.exec(DB, 'update tbl_purchase_bill set isdelete = true, status = false where sprid = @id', { id: col(subrow, 'sprid') });
  return res.json('ok');
}));

// ---------------------------------------------------------------- JsonResult Getattribute(int TKPMID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Getattribute{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TKPMID = reqInt(req.p.TKPMID, 'TKPMID');
  let attrt = [];
  if (TKPMID !== 0) {
    try {
      attrt = mapRows(await db.proc(DB, 'USP_GETATTRIBUTE', { TKPMID }), ATTRIBUTE_PROPS);
    } catch (e) {
      // return Json(JsonRequestBehavior.AllowGet): the enum (0) is the DATA and the behavior defaults to DenyGet
      // => a GET request throws InvalidOperationException (500), a POST returns 0.
      if (req.method === 'GET') {
        return res.status(500).json({ message: 'This request has been blocked because sensitive information could be disclosed to third party web sites when this is used in a GET request. To allow GET requests, set JsonRequestBehavior to AllowGet.' });
      }
      return res.json(0);
    }
  }
  return res.json(attrt);
}));

// ---------------------------------------------------------------- JsonResult Updateattribute(string MPAID, int Category, int PSCID, int PSSCID, string attr_name)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/Updateattribute{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Category = reqInt(req.p.Category, 'Category');
  const PSCID = reqInt(req.p.PSCID, 'PSCID');
  const PSSCID = reqInt(req.p.PSSCID, 'PSSCID');
  const MPAID = nstr(req.p.MPAID);
  const attr_name = nstr(req.p.attr_name);
  const Ret = '0';
  if (MPAID === null) throw nre();
  const ID = MPAID.split('^');
  if (attr_name === null) throw nre();
  const str1 = attr_name.split('^');
  for (let i = 0; i < ID.length; i++) {
    if (i >= str1.length) throw new Error('Index was outside the bounds of the array.');
    const DDLID = str1[i].split('~');
    if (DDLID.length < 2) throw new Error('Index was outside the bounds of the array.');
    await db.proc(DB, 'UPS_UPDATEATTRIBUTE', {
      MPAID: toInt32(ID[i]), title: DDLID[0], Value: toInt32(DDLID[1]), MAINCATID: Category, PSCID, PSSCID,
    });
  }
  return res.json(Ret);
}));

// ---------------------------------------------------------------- public string ImageSave(string IMAGE)
// auth (public method => routable in legacy, returns the file name as text; reads Session["Admin_User"])
router.all(`/admin/${C}/ImageSave{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.type('text/html').send(await ImageSave(req, nstr(req.p.IMAGE)));
}));

// ---------------------------------------------------------------- JsonResult UpdateProduct(string TKPMID, ..., int Discounttype, ..., string Purchaseprice, int PrType = 1)
// auth (legacy dereferenced Session["Admin_User"] BEFORE its null check => NullReferenceException without a session;
//       the "This Page Has Been Expired" branch was unreachable)
router.all(`/admin/${C}/UpdateProduct{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = (k) => nstr(req.p[k]);
  const Discounttype = reqInt(req.p.Discounttype, 'Discounttype');
  const PrType = nint(req.p.PrType) === null ? 1 : nint(req.p.PrType);
  let TKPMID = P('TKPMID');
  let PACKAGENAME = P('PACKAGENAME');
  let SUBSCRIPTIONDETAILS = P('SUBSCRIPTIONDETAILS');
  let FeaturesSUBSCRIPTIONDETAILS = P('FeaturesSUBSCRIPTIONDETAILS');
  let RBV = P('RBV');
  let BUSINESSVOLUME = P('BUSINESSVOLUME');
  let HANDLINGFEE = P('HANDLINGFEE');
  let Ret = '0';
  if (PACKAGENAME === null || SUBSCRIPTIONDETAILS === null || FeaturesSUBSCRIPTIONDETAILS === null) throw nre();
  PACKAGENAME = PACKAGENAME.split("'").join('');
  SUBSCRIPTIONDETAILS = SUBSCRIPTIONDETAILS.split('lessthan').join('<').split('greatthan').join('>');
  FeaturesSUBSCRIPTIONDETAILS = FeaturesSUBSCRIPTIONDETAILS.split('lessthan').join('<').split('greatthan').join('>');
  if (RBV === '') RBV = '0';
  if (BUSINESSVOLUME === '') BUSINESSVOLUME = '0';
  if (HANDLINGFEE === '') HANDLINGFEE = '0';
  let imgname = '';
  for (const k of ['ImgPreviewFirst', 'ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth']) {
    const v = P(k);
    if (v === null) throw nre(); // .Trim() on null
    if (v.trim() !== '') {
      const n = await ImageSave(req, v);
      imgname = imgname !== '' ? imgname + ',' + n : n;
    }
  }
  if (TKPMID === '') TKPMID = '0';
  const BarCode = P('BarCode');
  if (BarCode === null) throw nre();
  // PORT-NOTE: legacy also did `new Kit_Master()` here (object unused).
  const row = await db.procOne(DB, 'USP_CREATE_NEW_PIN_Product', {
    TKPMID: toInt32(TKPMID), PACKAGENAME, MRP: toDec(P('MRP')), DISCOUNT: toDec(P('DISCOUNT')), DP: toDec(P('DP')),
    BUSINESSVOLUME: toDec(BUSINESSVOLUME), RBV: toDec(RBV), SUBSCRIPTIONDETAILS, GST: toInt32(P('GST')), IMAGE: imgname,
    STATUS: toInt32(P('STATUS')), HANDLINGFEE: toDec(HANDLINGFEE),
    PRCODE: 'PR-' + String(await UtilityClass.GetRandom(99999, 999999)),
    CATEGORY: P('Category'), BARCODE: BarCode.trim(), COLOR: P('color'), SIZE: P('size'), UNITID: P('ddlUnit'), UNIT: P('Unit'),
    BRANDID: P('DDLBrand'), HSNCODE: P('HSNCode'), PSCID: P('PSCID'), PSSCID: P('PSSCID'), allAttributes: P('attr_name'),
    KeyFeatures: FeaturesSUBSCRIPTIONDETAILS, Discounttype, Productcode: P('productcode'), Purchaseprice: toDec(P('Purchaseprice')),
    PR_Type: PrType,
  });
  Ret = outStr(col(row, 'strresult'));
  return res.json(Ret);
}));

router.helpers = { ResizeImage, errorInsert };

module.exports = router;
