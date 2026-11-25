'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\subcatmaster.cs (class subcatmasterController => /admin/subcatmaster/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_SUBCATEGORY, USP_EXCEL_DOWNLOAD_HISTORY. Table tbl_main_category.
const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, getAdminMenu } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, reqDec, col, str, cellStr, tab, nowStamp, excelHistory, writeXlsExport, excelLink, inlinePerms, mapPath, cleanName,
  nullRef,
} = require('./_shared/batch11-common');
const { viewRes, outStrictInt, execSpRow, legacyBase64Bytes, loadImage, saveImageAsIs } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'subcatmaster';

/** class subcatmaster_list */
const LIST_PROPS = ['ROWNUMBER', 'SCATID', 'SCATNAME', 'SCATDESC', 'CATNAME', 'SCAT_CODE', 'SCATACTIVE', 'ADMINCHARGE', 'DelieveryCharge',
  'HandlingCharge', 'CATID'];
/** class editsubcatproduct */
const EDIT_PROPS = ['SCATID', 'SCATNAME', 'SCATDESC', 'CATNAME', 'SCATACTIVE', 'SCAT_CODE', 'CATID', 'ADMINCHARGE', 'DelieveryCharge',
  'HandlingCharge', 'FixedFee'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** USP_SUBCATEGORY list call (MODE 0) */
const listProc = (page, maxRows) => db.proc(DB, 'USP_SUBCATEGORY', {
  MODE: 0, SEQUENCE: 0, CATID: 0, SCATID: 0, SCATNAME: '', SCATDESC: '', SCATACTIVE: 0, SCATIMGNAME: '', STARTROWINDEX: page, MAXROWS: maxRows,
  AdminCommission: 0, DelieveryCharges: 0, HandlingCharges: 0,
});

// public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Add_Subcategory_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const subcatmasterlist = mapRows(await listProc(1, 99999999), LIST_PROPS);
  if (subcatmasterlist.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Add_Subcategory.xls', Filename,
      headers: ['S.No.', 'Category Name', 'Sub-Category Name', 'Description', 'Status'],
      rows: subcatmasterlist,
      innerProc: 'ObjKit_Master',
      outerProc: 'ObjKit_Master',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'CATNAME')) + ' \t');
        w(tab(cellStr(item, 'SCATNAME')) + ' \t');
        w(tab(cellStr(item, 'SCATDESC')) + ' \t');
        w(tab(cellStr(item, 'SCATACTIVE')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string btnexel, string sortOrder, string currentFilter, string searchString, string ddlOption, int? page)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/subcatmaster" -> subcatmaster/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/subcatmaster'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let btnexel = nStr(req.p.btnexel);
  let page = nInt(req.p.page);
  // sortOrder, currentFilter, searchString, ddlOption: bound but unused (legacy)
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (btnexel === null) btnexel = '';
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await listProc(page, MaxRows);
  const subcatmasterlist = mapRows(rows, LIST_PROPS);
  const TotalRecord = outStrictInt(rows, 'INTRESULT'); // int.Parse(spOutput.Value.ToString())
  // SELECT MAINCATID,MainCatName FROM tbl_main_category WHERE Status = 1  => List<PRODUCTCATEGORY>
  const cats = await db.query(DB, 'select maincatid, maincatname from tbl_main_category where status = 1', {});
  ViewBag.category = cats.map((r) => ({ CATID: 0, MAINCATID: col(r, 'maincatid'), MainCatName: col(r, 'maincatname'), CATNAME: null }));
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
  return viewRes(res, '~/Views/AdminPanel/subcatmaster/Index.cshtml', subcatmasterlist, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Getkitproduct(int SCATID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Getkitproduct{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SCATID = reqInt(req.p.SCATID, 'SCATID');
  const rows = await db.proc(DB, 'USP_SUBCATEGORY', {
    MODE: 1, SEQUENCE: 0, CATID: 0, SCATID, SCATNAME: '', SCATDESC: '', SCATACTIVE: 0, SCATIMGNAME: '', STARTROWINDEX: 1, MAXROWS: 100,
    AdminCommission: 0, DelieveryCharges: 0, HandlingCharges: 0,
  });
  return res.json(rows.length ? mapRow(rows[0], EDIT_PROPS) : null);
}));

// ---------------------------------------------------------------- JsonResult UpdateKit(string ImageLogoByteCode, int Category, string subCategoryname, string subCategorydes, decimal AdminComm, decimal DelieveryChar, decimal HandlingChar, int status, string Mode, int SCATID, string FixedFee)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateKit{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  void nStr(req.p.ImageLogoByteCode); // (packageimages call commented out in legacy)
  const Category = reqInt(req.p.Category, 'Category');
  const subCategoryname = nStr(req.p.subCategoryname);
  const subCategorydes = nStr(req.p.subCategorydes);
  const AdminComm = reqDec(req.p.AdminComm, 'AdminComm');
  const DelieveryChar = reqDec(req.p.DelieveryChar, 'DelieveryChar');
  const HandlingChar = reqDec(req.p.HandlingChar, 'HandlingChar'); void HandlingChar; // Param[13] overwritten by @FixedFee => not sent
  const status = reqInt(req.p.status, 'status');
  const Mode = nStr(req.p.Mode);
  const SCATID = reqInt(req.p.SCATID, 'SCATID');
  const FixedFee = nStr(req.p.FixedFee);
  let ret = '';
  const args = {
    MODE: Mode === 'Add' ? 3 : 2,
    SCATID: Mode === 'Add' ? 0 : SCATID,
    SEQUENCE: 0, CATID: Category, SCATNAME: subCategoryname, SCATDESC: subCategorydes, SCATACTIVE: status, SCATIMGNAME: '',
    STARTROWINDEX: 1, MAXROWS: 100, AdminCommission: AdminComm, DelieveryCharges: DelieveryChar,
  };
  // PORT-NOTE: SqlParameter with a null value is not sent (proc default @FixedFee = 0); '' converted to money is 0 in SQL Server.
  if (FixedFee !== null) args.FixedFee = FixedFee.trim() === '' ? 0 : FixedFee;
  // DataUtility.ExecuteSqlSP(Param, "[USP_SUBCATEGORY]") + Param[14] (@Result OUT)
  const { row } = await execSpRow(args, 'USP_SUBCATEGORY');
  const Result = '1'; void Result; // Param[9].Value.ToString() (@STARTROWINDEX input)
  const Resultnew = str(col(row, 'result'));
  if (Resultnew === '4') ret = 'Sub Category inserted successfully.';
  else if (Resultnew === '3') ret = 'Sub Category updated successfully.';
  else if (Resultnew === '6') ret = 'Duplicate names under same category are not allowed.';
  else ret = 'Some error occured.';
  void ret;
  return res.json(Resultnew);
}));

/** public string packageimages(string actiontype, string popupimg) */
async function packageimages(actiontype, popupimg) {
  let imgname = '';
  if (popupimg === null || popupimg === undefined) throw nullRef();
  if (popupimg.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.packageimages || '';
    if (popupimg !== '') {
      base64String = popupimg;
      imgname = cleanName(actiontype) + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(mapPath(SavePaths), imgname);
    const b = legacyBase64Bytes(base64String);
    await loadImage(b); // Image.FromStream
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    // (oldimage == "" => no delete; newWidth1/newHeight1/radio computed but unused)
    saveImageAsIs(b, strValidFullName); // img.Save(strValidFullName)
  }
  return imgname;
}

// ---------------------------------------------------------------- public string packageimages(string actiontype, string popupimg)
// auth (public method => routable in legacy, no session check; writes files => adminAuth)
router.all(`/admin/${C}/packageimages{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.type('text/html').send(await packageimages(nStr(req.p.actiontype), nStr(req.p.popupimg)));
}));

module.exports = router;
