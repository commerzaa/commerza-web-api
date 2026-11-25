'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\keyword_add.cs (class keyword_addController => /admin/keyword_add/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth, legacyUrl, getAdminMenu } = require('./_shared/admin-session');
const B = require('./_shared/batch08-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'keyword_add';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class mainPRODUCTCATEGORY / subPRODUCTCATEGORY / keywordadd_list / editsubsubcatproduct */
const MAIN_CAT_PROPS = ['CATID', 'CATNAME'];
const SUB_CAT_PROPS = ['SCATID', 'SCATNAME'];
const KEYWORD_LIST_PROPS = ['ROWNUMBER', 'KMID', 'KEYWORDNAME', 'KACTIVE', 'CATNAME', 'SCATNAME', 'CATID', 'MAINCATID'];
const EDIT_PROPS = ['KMID', 'KEYWORDNAME', 'KACTIVE', 'CATID', 'SCATID', 'ADMINCHARGE', 'DelieveryCharge', 'HandlingCharge', 'FixedFee',
  'BVPER', 'SubCatName'];

/** Convert.ToInt16(x.Value.ToString() == "" ? "0" : x.Value.ToString()) */
const toInt16Out = (row, name) => { const s = B.outStr(row, name); return B.cvtInt(s === '' ? '0' : s); };

/** USP_KEYWORD list call (@MODE 0) */
async function keywordList(page, MaxRows) {
  return db.proc(DB, 'USP_KEYWORD', {
    MODE: 0, SEQUENCE: 0, CATID: 0, SCATID: 0, KMID: 0, KEYWORDNAME: '', KEYWORDDESC: '', KEYWORDACTIVE: 0, KEYWORDIMGNAME: '',
    STARTROWINDEX: page, MAXROWS: MaxRows,
  });
}

/** public void ExportReport() - returns { sent } (ViewBag.filepath is written into the caller's ViewBag) */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Add_Sub_Sub_Category_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const keywordaddlist = mapRows(await keywordList(1, 999999), KEYWORD_LIST_PROPS);
  if (keywordaddlist.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Add_Sub_Sub_Category.xls', Filename,
      headers: ['S.No.', 'Category Name', 'Sub-Category Name', 'Sub-Sub-Category Name', 'Status'],
      rows: keywordaddlist,
      innerProc: 'ObjKit_Master',
      outerProc: 'ObjKit_Master',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'CATNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'SCATNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'KEYWORDNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'KACTIVE')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string btnexel, string sortOrder, string currentFilter, string searchString, string ddlOption, int? page)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/keyword-add" -> keyword_add/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/keyword-add'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let btnexel = B.nStr(req.p.btnexel);
  let page = B.nInt(req.p.page);
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) dynamicpagging = 100;
  const perm = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  ViewBag.isactive = toInt16Out(perm, 'EXCELSTATUS');
  ViewBag.isedit = toInt16Out(perm, 'ISEDIT');
  if (btnexel === null) btnexel = '';
  const er = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ev = B.outStr(er, 'ISACTIVE');
  ViewBag.excelactive = B.cvtInt(ev === '0' ? '0' : ev); // Convert.ToInt32("") => FormatException (as legacy)
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await keywordList(page, MaxRows);
  const keywordaddlist = mapRows(rows, KEYWORD_LIST_PROPS);
  // int.Parse(spOutput.Value.ToString()) - OUT param returned as a result column.
  // PORT-NOTE: with an empty result set the OUT column is not available (PostgreSQL) => 0 is used.
  const TotalRecord = rows.length ? B.outInt(rows[0], 'INTRESULT') : 0;
  const PRODUCTCATEGORY = mapRows(await db.query(DB, 'select maincatid as catid, maincatname as catname from tbl_main_category where status = 1', {}), MAIN_CAT_PROPS);
  const subPRODUCTCATEGORY = mapRows(await db.query(DB, 'select catid as scatid, catname as scatname from tbl_category where status = 1', {}), SUB_CAT_PROPS);
  ViewBag.category = PRODUCTCATEGORY;
  ViewBag.subcategory = subPRODUCTCATEGORY;
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
  return res.json({ view: '~/Views/AdminPanel/keyword_add/Index.cshtml', Model: keywordaddlist, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult getpackagelist(Int64 urid)
// public (legacy had no session check)
router.all(`/admin/${C}/getpackagelist{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const urid = B.reqInt(req.p.urid, 'urid');
  // PORT-NOTE: legacy concatenated urid into the SQL text; parameterised here.
  const ObjbankDetails = mapRows(await db.query(DB, 'select catid as scatid, catname as scatname from tbl_category where status = 1 and maincatid = @urid', { urid }), SUB_CAT_PROPS);
  return res.json(ObjbankDetails);
}));

// ---------------------------------------------------------------- JsonResult Getkitproduct(int KMID)
// public (legacy had no session check)
router.all(`/admin/${C}/Getkitproduct{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const KMID = B.reqInt(req.p.KMID, 'KMID');
  const rows = await db.proc(DB, 'USP_KEYWORD', {
    MODE: 1, SEQUENCE: 0, CATID: 0, SCATID: 0, KMID, KEYWORDNAME: '', KEYWORDDESC: '', KEYWORDACTIVE: 0, KEYWORDIMGNAME: '',
  });
  const productscla = rows.length ? mapRow(rows[0], EDIT_PROPS) : null; // FirstOrDefault()
  if (productscla === null) return res.type('application/json').send(''); // Json(null) writes an empty body
  return res.json(productscla);
}));

// ---------------------------------------------------------------- JsonResult UpdateKit(string ImageLogoByteCode, int Category, int subCategory, string subsubCategoryname, int status, string Mode, int KMID, string AdminCommission, string DelieveryCharges, string HandlingCharges, string FixedFee, string BusinessVolume, string ddlgst)
// public (legacy had no session check - see security notes)
router.all(`/admin/${C}/UpdateKit{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Category = B.reqInt(p.Category, 'Category');
  const subCategory = B.reqInt(p.subCategory, 'subCategory');
  const status = B.reqInt(p.status, 'status');
  const KMID = B.reqInt(p.KMID, 'KMID');
  const Mode = B.nStr(p.Mode);
  let ret = '';
  const ObjDUT = new DataUtility();
  const SP = DataUtility.SqlParameter;
  const Param = new Array(16);
  if (Mode === 'Add') {
    Param[0] = SP('@MODE', 3);
    Param[5] = SP('@KMID', 0);
  } else {
    Param[0] = SP('@MODE', 2);
    Param[5] = SP('@KMID', KMID);
  }
  Param[1] = SP('@SEQUENCE', 0);
  Param[2] = SP('@INTRESULT', null, 'Output');
  Param[3] = SP('@CATID', Category);
  Param[4] = SP('@SCATID', subCategory);
  Param[6] = SP('@KEYWORDNAME', B.nStr(p.subsubCategoryname));
  Param[7] = SP('@KEYWORDDESC', '');
  Param[8] = SP('@KEYWORDACTIVE', status);
  Param[9] = SP('@KEYWORDIMGNAME', '');
  Param[10] = SP('@AdminCommission', B.nStr(p.AdminCommission));
  Param[11] = SP('@DelieveryCharges', B.nStr(p.DelieveryCharges));
  Param[12] = SP('@HandlingCharges', B.nStr(p.HandlingCharges));
  Param[13] = SP('@FixedFee', B.nStr(p.FixedFee));
  Param[14] = SP('@BusinessVolume', B.nStr(p.BusinessVolume));
  Param[15] = SP('@gst', B.nStr(p.ddlgst));
  const Reply = await ObjDUT.ExecuteSqlSP(Param, '[USP_KEYWORD]'); // returns the @INTRESULT OUT value
  const Result = String(Reply); // Param[2].Value.ToString()
  if (Result === '4') ret = 'Sub Category inserted successfully.';
  else if (Result === '3') ret = 'Sub Category updated successfully.';
  else if (Result === '5') ret = 'Sub Sub Category Already Exist.';
  else ret = 'Some error occured.';
  return res.json(ret);
}));

/** public string packageimages(string actiontype, string popupimg) */
async function packageimages(actiontype, popupimg) {
  let imgname = '';
  if (popupimg === null || popupimg === undefined) throw B.nullRef();
  if (String(popupimg).trim() !== '') {
    let SavePaths = '';
    let base64String = '';
    // eslint-disable-next-line no-unused-vars
    let ImageExt = '';
    SavePaths = (config.app.packageimages || ''); // ConfigurationManager.AppSettings["packageimages"]
    if (popupimg !== '') {
      base64String = popupimg;
      imgname = B.cleanName(actiontype) + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = B.mapPath(SavePaths + '/' + imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      if (lastIndexNo - IndexNo < 0) throw new Error('Length cannot be less than zero.\r\nParameter name: length');
      ImageExt = base64String.substring(IndexNo, lastIndexNo);
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = base64String.substring(IndexNo1);
    }
    const b = B.decodeBase64Image(base64String);
    const sharp = require('sharp');
    await sharp(b).metadata(); // System.Drawing.Image.FromStream (throws on an invalid image)
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    // (oldimage = "" => no delete; scale/ratio maths computed but unused)
    fs.mkdirSync(require('path').dirname(strValidFullName), { recursive: true });
    // PORT-NOTE: img.Save(path) re-encoded the decoded image in its raw format; the original bytes are written.
    fs.writeFileSync(strValidFullName, b);
  }
  return imgname;
}

// ---------------------------------------------------------------- string packageimages(string actiontype, string popupimg)
// public (public method => routable in legacy; no session check - writes a file, see security notes)
router.all(`/admin/${C}/packageimages{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await packageimages(B.nStr(req.p.actiontype), B.nStr(req.p.popupimg));
  res.type('text/html').send(r); // string action => Content(r)
}));

module.exports = router;
