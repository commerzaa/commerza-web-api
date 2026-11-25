'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Landing_Page.cs (class Landing_PageController => /admin/Landing_Page/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Landing_Page';

/** class ReferalLinks */
const REFERAL_PROPS = ['RLID', 'Title', 'Image', 'Url', 'Date', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// PORT-NOTE: USP_ADDREFERAL_LINK declares @DATE DATETIME and @RLID/@Active INT; legacy passed "" / "0" and SQL Server converted them
// implicitly ('' => 1900-01-01 00:00:00, '' => 0, '0' => 0). PostgreSQL does not cast '' to timestamp/int, so the converted values are passed.
const SQL_EMPTY_DATETIME = '1900-01-01 00:00:00';

/** USP_ADDREFERAL_LINK @TITLE,@IMAGE,@URL,@DATE,@MODE,@RLID,@Active,@STRRESULT out */
async function addReferalLink(p) {
  return db.proc(DB, 'USP_ADDREFERAL_LINK', {
    TITLE: p.TITLE, IMAGE: p.IMAGE, URL: p.URL, DATE: SQL_EMPTY_DATETIME, MODE: p.MODE, RLID: p.RLID, Active: p.Active,
  });
}

/** MODE 2 list (used by Index and ExportReport) */
async function listReferalLinks() {
  const rows = await addReferalLink({ TITLE: '', IMAGE: '', URL: '', MODE: 2, RLID: 0, Active: 0 });
  return mapRows(rows, REFERAL_PROPS);
}

// public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'Landing Page_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const ReferalLinks = await listReferalLinks();
  if (ReferalLinks.length > 0) {
    let RowNumber = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Landing Page.xls', Filename,
      headers: ['S.No.', 'Create Date', 'Url', 'Status'],
      rows: ReferalLinks,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(RowNumber)) + ' \t');
        w(B.tab(B.netDateString(item.Date)) + ' \t'); // item.Date.ToString()
        w(B.tab(B.cellStr(item, 'Url')) + ' \t');
        w(B.tab(B.cellStr(item, 'STATUS')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

/**
 * Server.MapPath(AppSettings["ReferalLink"]) (Web.config value "../ReferalLinkImage", resolved against the request folder => app root).
 * PORT-NOTE: leading "~", "/" and "../" segments are dropped so the folder stays inside config.uploadDir.
 */
function referalLinkDir() {
  const SavePaths = config.app.ReferalLink || '';
  return path.join(config.uploadDir, String(SavePaths).replace(/^~/, '').replace(/^([\\/]|\.\.[\\/]|\.[\\/])+/, ''));
}

/** #region LogoImage (identical in AddNewReferalLink and UpdatImageReferalLink) => imgname */
async function saveLogoImage(Images, fileName, loginid) {
  let imgname = '';
  if (Images === null || Images === undefined) throw B.nullRef(); // Images.Trim()
  if (String(Images).trim() !== '') {
    let base64String = '';
    let ImageExt = '';
    if (Images !== '') {
      base64String = String(Images);
      let ProfileImage = loginid;
      if (ProfileImage === null || ProfileImage === undefined) throw B.nullRef();
      ProfileImage = String(ProfileImage).trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '-' + (fileName === null || fileName === undefined ? '' : fileName) + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(referalLinkDir(), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      if (lastIndexNo - IndexNo < 0 || lastIndexNo < 0) {
        throw new Error('Length cannot be less than zero.\r\nParameter name: length'); // Substring ArgumentOutOfRangeException
      }
      ImageExt = base64String.substring(IndexNo, lastIndexNo);
      void ImageExt;
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = base64String.substring(IndexNo1);
    }
    const b = B.decodeBase64Image(base64String); // Convert.FromBase64String
    const sharp = require('sharp'); // System.Drawing.Image.FromStream (throws on an invalid image)
    await sharp(b).metadata();
    const filesize = b.length / 1024; void filesize;
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = ''; // param[9].Value.ToString() (always "" in legacy)
    if (oldimage !== '') {
      const o = path.join(referalLinkDir(), oldimage);
      if (fs.existsSync(o)) fs.unlinkSync(o);
    }
    // PORT-NOTE: img.Save(path) re-encoded with System.Drawing in the image's raw format; the decoded bytes are written as-is.
    fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
    fs.writeFileSync(strValidFullName, b);
  }
  return imgname;
}

// ---------------------------------------------------------------- Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "adminpanel/Landing-Page" -> Landing_Page/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/adminpanel/Landing-Page'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = B.nStr(req.p.btnexel);
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};

  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const perm = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  const ex = B.str(B.col(perm, 'excelstatus'));
  const ie = B.str(B.col(perm, 'isedit'));
  ViewBag.isactive = B.cvtInt(ex === '' ? '0' : ex); // Convert.ToInt16
  ViewBag.isedit = B.cvtInt(ie === '' ? '0' : ie);

  // USP_EXCEL_LINK @url,@ISACTIVE out  (CommandTimeout 1000)
  const lk = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ia = B.str(B.col(lk, 'isactive'));
  const isactive = B.cvtInt(ia === '0' ? '0' : ia);
  ViewBag.excelactive = isactive;

  const ReferalLinks = await listReferalLinks();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Landing_Page/Index.cshtml', Model: ReferalLinks, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult AddNewReferalLink(string Images, string Url, string fileName)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/AddNewReferalLink{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const loginid = req.user.emp_loginid; // Emp_ID / regNo read but unused in legacy
  const imgname = await saveLogoImage(B.nStr(req.p.Images), B.nStr(req.p.fileName), loginid);
  const row = await addReferalLink({ TITLE: '', IMAGE: imgname, URL: B.nStr(req.p.Url), MODE: 1, RLID: 0, Active: 0 });
  const OutPutResult = B.str(B.col(row[0], 'strresult'));
  res.json(OutPutResult);
}));

// ---------------------------------------------------------------- JsonResult UpdatImageReferalLink(string Images, string Url, string fileName, int RLId)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdatImageReferalLink{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RLId = B.reqInt(req.p.RLId, 'RLId');
  const loginid = req.user.emp_loginid;
  const imgname = await saveLogoImage(B.nStr(req.p.Images), B.nStr(req.p.fileName), loginid);
  const row = await addReferalLink({ TITLE: '', IMAGE: imgname, URL: B.nStr(req.p.Url), MODE: 3, RLID: RLId, Active: 0 });
  res.json(B.str(B.col(row[0], 'strresult')));
}));

// ---------------------------------------------------------------- JsonResult UpdateStatus(int RLId, int Status)
// auth (legacy had NO session check; it changes a landing-page link status => protected, see report)
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RLId = B.reqInt(req.p.RLId, 'RLId');
  const Status = B.reqInt(req.p.Status, 'Status');
  const row = await addReferalLink({ TITLE: '', IMAGE: '', URL: '', MODE: 4, RLID: RLId, Active: Status });
  res.json(B.str(B.col(row[0], 'strresult')));
}));

module.exports = router;
