'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberDashboardSetting.cs (class MemberDashboardSettingController => /MemberDashboardSetting/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/adminSession');
const { DB, nStr, reqInt, outOf, mapPath, decodeBase64Image, str } = require('./_shared/batch10_common');

const router = express.Router();
const C = 'MemberDashboardSetting';

/** class MemberDashboard */
const PROPS = ['TDID', 'URL', 'IMAGE', 'ACTINE', 'DASHBOARDNAME', 'TITLE'];
const SELECT = "select tdid, coalesce(url,'') as url, coalesce(image,'') as image, actine, coalesce(dashboardname,'') as dashboardname, coalesce(title,'') as title from tbl_dashboards";

// private static bool ThumbnailCallback() { throw new NotImplementedException(); }  (never called; not routable)
// eslint-disable-next-line no-unused-vars
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Member-Dashboard-Setting" -> MemberDashboardSetting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-Dashboard-Setting'], adminAuth, asyncHandler(async (req, res) => {
  const spdetail = mapRows(await db.query(DB, SELECT, {}), PROPS);
  res.json({ view: '~/Views/AdminPanel/MemberDashboardSetting/Index.cshtml', Model: spdetail });
}));

// ---------------------------------------------------------------- JsonResult UpdateDashboardData(string URL, string TITLE, string ACTIVEDASHBOARD, string IMAGE, int TMID)
// auth (reads Session["Admin_User"] first thing; legacy threw NullReferenceException without a session)
router.all(`/admin/${C}/UpdateDashboardData{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TMID = reqInt(req.p.TMID, 'TMID');
  const URL = nStr(req.p.URL);
  const TITLE = nStr(req.p.TITLE);
  const ACTIVEDASHBOARD = nStr(req.p.ACTIVEDASHBOARD);
  const IMAGE = nStr(req.p.IMAGE);
  const regNo = req.user.emp_id; // Int64 regNo = Emp_ID
  const loginid = req.user.emp_loginid;
  // #region LogoImage
  let imgname = '';
  if (IMAGE === null) throw new Error('Object reference not set to an instance of an object.'); // IMAGE.Trim()
  if (IMAGE.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.CompanyLogoImage || '';
    if (IMAGE !== '') {
      base64String = IMAGE;
      let ProfileImage = (loginid === null || loginid === undefined ? '' : String(loginid)) + String(await UtilityClass.GenerateRandomNumber());
      ProfileImage = ProfileImage.trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '-' + regNo + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(mapPath(SavePaths), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      const ImageExt = base64String.substring(IndexNo, lastIndexNo); // eslint-disable-line no-unused-vars
    }
    const b = decodeBase64Image(base64String); // Convert.FromBase64String (FormatException => 500)
    // System.Drawing.Image.FromStream(ms) => throws on a non-image (PORT-NOTE: validated with sharp, lazy require)
    const sharp = require('sharp');
    await sharp(b).metadata();
    const filesize = b.length / 1024; // eslint-disable-line no-unused-vars
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      const op = path.join(mapPath(SavePaths), oldimage);
      if (fs.existsSync(op)) fs.unlinkSync(op);
    } else {
      // PORT-NOTE: img.Save(path) re-encoded through System.Drawing; the decoded original bytes are written instead.
      fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
      fs.writeFileSync(strValidFullName, b);
    }
  }
  // #endregion LogoImage
  let OutputResult = '';
  // DBO.USP_UPDATEDASHBARDSETTING @TDID,@URL,@TITLE,@ACTIVEDASHBOARD,@IMAGE,@INTRESULT OUT
  const rows = await db.proc(DB, 'USP_UPDATEDASHBARDSETTING', {
    TDID: TMID, URL, TITLE, ACTIVEDASHBOARD, IMAGE: imgname,
  });
  OutputResult = outOf(rows, 'intresult');
  if (OutputResult !== '') return res.json(OutputResult);
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult DDLCHANGE(string DashboardName)
// auth (PORT-NOTE: legacy had no session check; returns admin dashboard settings => adminAuth per coordinator auth rule)
router.all(`/admin/${C}/DDLCHANGE{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const DashboardName = nStr(req.p.DashboardName);
  if (DashboardName !== '' && DashboardName !== null) {
    // legacy concatenated DashboardName into the SQL (injection) - parameterised here
    const row = await db.queryOne(DB, `${SELECT} where dashboardname = @DashboardName limit 1`, { DashboardName });
    if (row) return res.json(mapRow(row, PROPS));
  }
  return res.json('');
}));

// ---------------------------------------------------------------- JsonResult Edit_Data(int TMID)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Edit_Data{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const TMID = reqInt(req.p.TMID, 'TMID');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    let URL = ''; let IMAGE = ''; let ACTINE = 0; let DASHBOARDNAME = ''; let TITLE = ''; let stringret = '';
    const r = await db.queryOne(DB, "select coalesce(url,'') as url, coalesce(image,'') as image, actine, coalesce(dashboardname,'') as dashboardname, coalesce(title,'') as title from tbl_dashboards where tdid = @TMID limit 1", { TMID });
    if (r) {
      const row = mapRow(r, PROPS);
      URL = row.URL; IMAGE = row.IMAGE; ACTINE = row.ACTINE; DASHBOARDNAME = row.DASHBOARDNAME; TITLE = row.TITLE;
    }
    stringret = stringret + '^' + 'Success' + '^' + str(URL) + '^' + str(IMAGE) + '^' + str(ACTINE) + '^' + str(DASHBOARDNAME) + '^' + str(TITLE);
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Edit_Data');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
