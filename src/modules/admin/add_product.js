'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\add_product.cs (class add_productController)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Save_ImageFile = require('../../lib/Save_ImageFile');
const { adminAuth, isAdmin, legacyUrl, getAdminMenu } = require('./_shared/adminSession');
const {
  DB, nint, nstr, nre, reqInt, toInt32, outStr, col, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, mapRow,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'add_product';

const KITFEATURE_PROPS = ['TFMID', 'FeatureShortExplanation', 'FeatureBreifExplanation', 'SurfingSlot', 'IsActive', 'Quantity', 'IsEditable', 'IsShowProductList', 'IsAutoRedeem'];
const ADDPRODUCT_LIST_PROPS = ['ROWNUMBER', 'CATID', 'CATNAME', 'CATACTIVE', 'CATIMGNAME', 'CATDESC', 'ISHot_Links'];
// class editproduct (declared in the C# file, unused): MAINCATID, MAINCATNAME, CATACTIVE, CATIMGNAME, ISHot_Links, Status, CATDESC
const KITDETILS_PROPS = ['kid', 'Type', 'Title', 'Amount', 'PV', 'shippingcharges', 'DirectIncome', 'couriercharges', 'Image', 'treecolor', 'growthrate',
  'newgrowthrate', 'BV', 'DAP', 'DistAmount', 'Capping', 'Status'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Add_Category_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const rows = await db.proc(DB, 'USP_MAINCATEGORYLIST', { MAXROWS: 9999999, STARTROWINDEX: 1 });
  const list = mapRows(rows, ADDPRODUCT_LIST_PROPS);
  if (list.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Add_Category_List.xls', Filename,
      headers: ['S.No.', 'Category Name', 'Description', 'Status'],
      rows: list,
      innerProc: 'ObjKit_Master',
      outerProc: 'ObjKit_Master',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.CATNAME)) + ' \t');
        w(tab(cs(item.CATDESC)) + ' \t');
        w(tab(cs(item.CATACTIVE)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// public string packageimages(string actiontype, string popupimg)
// Config: packageimages (folder, legacy AppSettings["packageimages"])
async function packageimages(actiontype, popupimg) {
  let imgname = '';
  if (popupimg === null || popupimg === undefined) throw nre();
  if (popupimg.trim() !== '') {
    let base64String = '';
    let ImageExt = '';
    const SavePaths = (config.app.packageimages || '');
    if (popupimg !== '') {
      base64String = popupimg;
      if (actiontype === null || actiontype === undefined) throw nre();
      let ProfileImage = actiontype;
      ProfileImage = ProfileImage.trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}]/gu, ''); // Regex.Replace(x, @"[^\w\d]", "")
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '.jpg';
    } else {
      imgname = ' ';
    }
    // Server.MapPath(SavePaths) + "/" + imgname
    const dir = path.join(config.uploadDir, String(SavePaths).replace(/^~?[\\/]*/, ''));
    const strValidFullName = path.join(dir, imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      ImageExt = base64String.substring(IndexNo, lastIndexNo);
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = base64String.substring(IndexNo1);
    }
    void ImageExt;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64String.replace(/\s/g, '')) || base64String.replace(/\s/g, '').length % 4 !== 0) {
      throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
    }
    const b = Buffer.from(base64String, 'base64');
    // System.Drawing.Image.FromStream(ms) => ArgumentException "Parameter is not valid." on a non-image
    if (!Save_ImageFile.IsValidImage(b)) throw new Error('Parameter is not valid.');
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    // (oldimage = "" => no delete; newWidth/newHeight/radio computed but unused in legacy)
    fs.mkdirSync(dir, { recursive: true });
    // PORT-NOTE: img.Save(path) re-encoded the image in its own format; the decoded bytes are written unchanged.
    fs.writeFileSync(strValidFullName, b);
  }
  return imgname;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string btnexel, string sortOrder, string currentFilter, string searchString, string ddlOption, int? page)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/add-product1" -> add_product/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/add-product1'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let btnexel = nstr(req.p.btnexel);
  let page = nint(req.p.page);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  if (dynamicpagging === null) dynamicpagging = 100;
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  const MaxRows = toInt32(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_MAINCATEGORYLIST', { MAXROWS: MaxRows, STARTROWINDEX: page });
  const addproduct_list = mapRows(rows, ADDPRODUCT_LIST_PROPS);
  const TotalRecord = toInt32(outStr(col(rows[0], 'totalcount')) || 'x'); // Convert.ToInt32(DBNull => "") => FormatException
  ViewBag.QUALIFICATIONlis = '';
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = '';
  ViewBag.SearchValue = '';
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/add_product/Index.cshtml', addproduct_list, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Getkitproduct(int CatId)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Getkitproduct{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const CatId = reqInt(req.p.CatId, 'CatId');
  const rows = await db.proc(DB, 'USP_MAINCATEGORYLIST', { MAXROWS: 100, STARTROWINDEX: 1, MAINCATID: CatId });
  if (!rows.length) return res.type('application/json').send(''); // Json(null)
  return res.json(mapRow(rows[0], ADDPRODUCT_LIST_PROPS));
}));

// ---------------------------------------------------------------- JsonResult Getkitfeature(int TFMID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Getkitfeature{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TFMID = reqInt(req.p.TFMID, 'TFMID');
  // legacy concatenated TFMID into the SQL (int => safe); parameterised here
  const row = await db.queryOne(DB, `select tfmid, featureshortexplanation, surfingslot, featurebreifexplanation, isactive, quantity, iseditable,
    isshowproductlist, isautoredeem from tbl_feature_master where tfmid = @TFMID limit 1`, { TFMID });
  if (!row) return res.type('application/json').send('');
  return res.json(mapRow(row, KITFEATURE_PROPS));
}));

// ---------------------------------------------------------------- JsonResult Getkitdetils(double getkid)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Getkitdetils{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const raw = req.p.getkid;
  const getkid = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(getkid)) {
    return res.status(500).json({ message: "The parameters dictionary contains a null entry for parameter 'getkid' of non-nullable type 'System.Double'" });
  }
  const rows = await db.proc(DB, 'USP_EDITPACKAGE', { KID: getkid });
  if (!rows.length) return res.type('application/json').send('');
  return res.json(mapRow(rows[0], KITDETILS_PROPS));
}));

// ---------------------------------------------------------------- JsonResult UpdateKit(string ImageLogoByteCode, string Categoryname, string CategoryDes, string maincatid, string HotLink, int status, string Mode)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateKit{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const status = reqInt(req.p.status, 'status');
  const Categoryname = nstr(req.p.Categoryname);
  let maincatid = nstr(req.p.maincatid);
  let ret = '';
  const imagename = await packageimages(Categoryname, nstr(req.p.ImageLogoByteCode));
  if (nstr(req.p.Mode) === 'Add') maincatid = '0';
  const row = await db.procOne(DB, 'USP_INSERTMAINCATEGORY', {
    CATID: toInt32(maincatid), CATNAME: Categoryname, CATDESC: nstr(req.p.CategoryDes), CATACTIVE: status !== 0, CATIMGNAME: imagename,
    SEQUENCE: toInt32(maincatid), HOTLINK: toInt32(nstr(req.p.HotLink)),
  });
  const r = outStr(col(row, 'result'));
  if (r === 'Save') ret = 'Category inserted successfully.';
  else if (r === 'Update') ret = 'Category updated successfully.';
  else if (r === 'This Category Name Already Exist.') ret = 'This Category Name Already Exist.';
  else ret = 'Some error occured.';
  return res.json(ret);
}));

// ---------------------------------------------------------------- public string packageimages(string actiontype, string popupimg)
// auth (public method => routable in legacy, returns the image name as text; writes a file => adminAuth)
router.all(`/admin/${C}/packageimages{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.type('text/html').send(await packageimages(nstr(req.p.actiontype), nstr(req.p.popupimg)));
}));

// ---------------------------------------------------------------- JsonResult AddOrUpdateFeature(string FeatureShortExplanation, string FeatureBreifExplanation, int Status, int Mode, int TFMID, int Quantity, int IsEditable, int IsShowProductList, int IsAutoRedeem)
// auth-by-check (legacy returned Json("This Page has been expired") - contract kept)
router.all(`/admin/${C}/AddOrUpdateFeature{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Status = reqInt(req.p.Status, 'Status');
  const Mode = reqInt(req.p.Mode, 'Mode');
  const TFMID = reqInt(req.p.TFMID, 'TFMID');
  const Quantity = reqInt(req.p.Quantity, 'Quantity');
  const IsEditable = reqInt(req.p.IsEditable, 'IsEditable');
  const IsShowProductList = reqInt(req.p.IsShowProductList, 'IsShowProductList');
  const IsAutoRedeem = reqInt(req.p.IsAutoRedeem, 'IsAutoRedeem');
  if (!isAdmin(req)) return res.json('This Page has been expired');
  const Kit_Master = require('../../lib/admin/Kit_Master');
  const Obj = new Kit_Master();
  const Ret = await Obj.AddOrUpdateFeature(nstr(req.p.FeatureShortExplanation), nstr(req.p.FeatureBreifExplanation), Status, Mode, TFMID, Quantity,
    IsEditable, IsShowProductList, IsAutoRedeem);
  return res.json(Ret);
}));

// ---------------------------------------------------------------- JsonResult AddOrUpdateProduct(string ProductName, string ProductCode, string ProductDescription, int Status, int Mode, int TKPMID)
// auth-by-check (legacy returned Json("This Page has been expired") - contract kept)
router.all(`/admin/${C}/AddOrUpdateProduct{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Status = reqInt(req.p.Status, 'Status');
  const Mode = reqInt(req.p.Mode, 'Mode');
  const TKPMID = reqInt(req.p.TKPMID, 'TKPMID');
  if (!isAdmin(req)) return res.json('This Page has been expired');
  const Kit_Master = require('../../lib/admin/Kit_Master');
  const Obj = new Kit_Master();
  const Ret = await Obj.AddOrUpdateProduct(nstr(req.p.ProductName), nstr(req.p.ProductCode), nstr(req.p.ProductDescription), Status, Mode, TKPMID);
  return res.json(Ret);
}));

module.exports = router;
