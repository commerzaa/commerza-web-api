'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Company_Details.cs (class Company_DetailsController => /admin/Company_Details/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Company_Details';

/** class Company_Details */
const COMPANY_PROPS = ['NAME', 'MOBILE', 'LANDLINE', 'EMAIL', 'ADDRESS_1', 'ADDRESS_2', 'LOGO', 'LOGOBACKGROUND', 'FAVICON', 'GSTNO',
  'UPDATEDON', 'UPDATED_BY', 'SOFTWARE_URL', 'TotalMember', 'TotalBtcReceived', 'TotalBtcRate', 'GSTN', 'SHOPPING_URL', 'STATUS',
  'LOGOBACK', 'MAIN_URL'];

/** private static bool ThumbnailCallback() { throw new NotImplementedException(); }
 *  (only passed as the GetThumbnailImageAbort delegate, which GDI+ never invokes) */
function ThumbnailCallback() {
  throw new Error('The method or operation is not implemented.');
}
void ThumbnailCallback;

/** Convert.FromBase64String (throws FormatException on invalid input) */
function fromBase64(s) {
  const t = String(s).replace(/\s/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) {
    throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  return Buffer.from(t, 'base64');
}

/** ProfileImage name cleaning shared by the three image regions */
function cleanLoginId(loginid) {
  let ProfileImage = String(loginid === null || loginid === undefined ? (() => { throw B.nullRef(); })() : loginid);
  ProfileImage = ProfileImage.trim();
  ProfileImage = ProfileImage.split('&amp;').join('And');
  ProfileImage = ProfileImage.split('&').join(' And ');
  ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
  ProfileImage = ProfileImage.replace(/ /g, '-');
  return ProfileImage;
}

/** strip "data:image/x;base64," prefix like the C# (IndexOf("/")+1 .. IndexOf(";"), then after ",") */
function stripDataUri(base64String) {
  if (base64String.includes('base64,')) {
    const IndexNo1 = base64String.indexOf(',') + 1;
    return base64String.substring(IndexNo1);
  }
  return base64String;
}

/** "C://inetpub//vhosts//" + MainURL + "//" + Loginurl + "//images"
 *  PORT-NOTE: the Windows IIS vhost path is mapped to (config.app.VhostsRoot || <uploadDir>/vhosts)/<MainURL>/<Loginurl>/images. */
function vhostImages(MainURL, Loginurl) {
  const root = config.app.VhostsRoot || path.join(config.uploadDir, 'vhosts');
  return path.join(root, MainURL, Loginurl, 'images');
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/company-management" -> Company_Details/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/company-management'], adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_UPDATECOMPANYDETAILS', { MODE: 2 });
  const spdetail = rows.length ? mapRow(rows[0], COMPANY_PROPS) : null;
  return res.json({ view: '~/Views/AdminPanel/Company_Details/Index.cshtml', Model: spdetail });
}));

// ---------------------------------------------------------------- JsonResult UpdateCompanyProfile(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateCompanyProfile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = (k) => B.nStr(req.p[k]);
  const Comp_Name = p('Comp_Name'); const Comp_Mobile = p('Comp_Mobile'); const LANDLINE = p('LANDLINE'); const Comp_Email = p('Comp_Email');
  const Comp_Address1 = p('Comp_Address1'); const Comp_Address2 = p('Comp_Address2'); const Comp_Logo = p('Comp_Logo');
  const Comp_Favicon = p('Comp_Favicon'); const logocolor = p('logocolor'); const SOFT_URL = p('SOFT_URL'); const GSTN = p('GSTN');
  const ShoppingURL = p('ShoppingURL'); const Status = p('Status'); const Comp_Logoback = p('Comp_Logoback'); const Mainurl = p('Mainurl');
  void logocolor; // bound but unused (legacy)

  const Empid = req.user.emp_id;
  const regNo = req.user.emp_id;
  const loginid = req.user.emp_loginid;
  let Loginurl = await db.scalar(DB, "select coalesce(software_url,'') as software_url from tbl_companymaster limit 1", {});
  let MainURL = await db.scalar(DB, "select coalesce(main_url,'') as software_url from tbl_companymaster limit 1", {});
  if (Loginurl === null || MainURL === null) throw B.nullRef(); // FirstOrDefault() null => .Replace NullReferenceException
  Loginurl = String(Loginurl).split('http://').join('').split('https://').join('');
  MainURL = String(MainURL).split('http://').join('').split('https://').join('');

  let ConStatus = 0;
  if (Status !== null) {
    if (!/^\s*[-+]?\d+\s*$/.test(Status)) throw new Error('Input string was not in a correct format.');
    ConStatus = parseInt(Status, 10);
  } else {
    ConStatus = 0;
  }
  const sharp = require('sharp'); // lazy (System.Drawing replacement)

  // #region LogoImage
  let imgname = '';
  if (Comp_Logo === null) throw B.nullRef();
  if (Comp_Logo.trim() !== '') {
    const SavePaths = vhostImages(MainURL, Loginurl);
    let base64String = '';
    if (Comp_Logo !== '') {
      base64String = Comp_Logo;
      imgname = cleanLoginId(loginid) + '-' + regNo + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(SavePaths, imgname);
    base64String = stripDataUri(base64String);
    const b = fromBase64(base64String);
    await sharp(b).metadata(); // Image.FromStream (throws on invalid image data)
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      if (fs.existsSync(path.join(SavePaths, oldimage))) fs.unlinkSync(path.join(SavePaths, oldimage));
    } else {
      fs.mkdirSync(SavePaths, { recursive: true });
      fs.writeFileSync(strValidFullName, b); // img.Save(path) keeps the raw format
    }
  }
  // #region BackLogoImage
  let imgnameback = '';
  if (Comp_Logoback === null) throw B.nullRef();
  if (Comp_Logoback.trim() !== '') {
    const SavePathsback = vhostImages(MainURL, Loginurl);
    let base64String = '';
    if (Comp_Logoback !== '') {
      base64String = Comp_Logoback;
      imgnameback = 'back_' + cleanLoginId(loginid) + '-' + regNo + '.png';
    } else {
      imgnameback = ' ';
    }
    const strValidFullName = path.join(SavePathsback, imgnameback);
    base64String = stripDataUri(base64String);
    const b = fromBase64(base64String);
    await sharp(b).metadata();
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      if (fs.existsSync(path.join(SavePathsback, oldimage))) fs.unlinkSync(path.join(SavePathsback, oldimage));
    } else {
      fs.mkdirSync(SavePathsback, { recursive: true });
      fs.writeFileSync(strValidFullName, b);
    }
  }
  // #region imgnamefavicon
  let imgnamefavicon = '';
  if (Comp_Favicon === null) throw B.nullRef();
  if (Comp_Favicon.trim() !== '') {
    const SavePaths = vhostImages(MainURL, Loginurl);
    let base64String = '';
    if (Comp_Favicon !== '') {
      base64String = Comp_Favicon;
      imgnamefavicon = cleanLoginId(loginid) + '-' + regNo + '-favicon' + '.jpg';
    } else {
      imgnamefavicon = ' ';
    }
    const strValidFullName = path.join(SavePaths, imgnamefavicon);
    base64String = stripDataUri(base64String);
    const b = fromBase64(base64String);
    const meta = await sharp(b).metadata();
    const filesize = b.length / 1024;
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      if (fs.existsSync(path.join(SavePaths, oldimage))) fs.unlinkSync(path.join(SavePaths, oldimage));
    }
    const W = meta.width; const H = meta.height;
    let newWidth = 0; let newHeight = 0;
    const scaleFactor = 0.5;
    let newWidth1 = Math.trunc(W * scaleFactor);
    let newHeight1 = Math.trunc(H * scaleFactor);
    const radio = newWidth1 / newHeight1;
    fs.mkdirSync(SavePaths, { recursive: true });
    if (filesize > 10) {
      newWidth = 300; newHeight = 300;
      if (radio === 1) {
        newWidth1 = W * scaleFactor; if (newWidth1 > 300) newWidth1 = 300;
        newHeight1 = H * scaleFactor; if (newHeight1 > 300) newHeight1 = 300;
        newHeight = Math.trunc(newHeight1);
        newWidth = Math.trunc(newWidth1);
      }
      if (radio < 1) { newHeight = 300; newWidth1 = 300; newWidth1 *= radio; newWidth = Math.trunc(newWidth1); }
      if (radio > 1) { newWidth = 300; newHeight1 = 300; newHeight1 /= radio; newHeight = Math.trunc(newHeight1); }
      if (radio === 1) { newWidth = 300; newHeight = 300; }
      // GetThumbnailImage(newWidth, newHeight) -> Save(ImageFormat.Jpeg) -> reload -> Save(path) (JPEG)
      const jpeg = await sharp(b).resize(newWidth, newHeight, { fit: 'fill' }).jpeg().toBuffer();
      fs.writeFileSync(strValidFullName, jpeg);
    } else {
      fs.writeFileSync(strValidFullName, b);
    }
  }

  let OutputResult = '';
  // DBO.USP_UPDATECOMPANYDETAILS @MODE,...,@INTRESULT OUT,...
  const row = await db.procOne(DB, 'USP_UPDATECOMPANYDETAILS', {
    MODE: 1, NAME: Comp_Name, MOBILE: Comp_Mobile, LANDLINE, EMAILID: Comp_Email, ADDRESS_1: Comp_Address1, ADDRESS_2: Comp_Address2,
    LOGO: imgname, LOGOBACKGROUND: '', FAVICON: imgnamefavicon, GSTNO: 0, UPDATED_BY: Empid, SOFT_URL, GSTN, SHOPPINGURL: ShoppingURL,
    STATUS: ConStatus, IMAGENAMEBACK: imgnameback, MAINURL: Mainurl,
  });
  OutputResult = B.outStr(row, 'intresult');
  if (OutputResult === '1') return res.json(OutputResult);
  return res.json(OutputResult);
}));

module.exports = router;
