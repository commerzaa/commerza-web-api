'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\manage_kits.cs (class manage_kitsController => /manage_kits/...)
// Database: affiliate (Db_Affiliate). Tables: settings, tbl_companymaster. Procs: USP_EDITPACKAGE, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Kit_Master = require('../../lib/admin/Kit_Master');
const { adminAuth, legacyUrl, getAdminMenu } = require('./_shared/adminSession');
const {
  DB, nStr, nDec, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, tab, cellStr, dec2, col, firstCol, nullRef,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'manage_kits';

/** class KitDetils */
const KIT_DETILS = ['KID', 'PCODE', 'TITLE', 'MININVESTMENT', 'MAXINVESTMENT', 'NOOFDAYSFORACTIVATION', 'SUBSCRIPTIONDETAILS', 'PackageColor',
  'AmountColor', 'ISACTIVE', 'MRP', 'SERVICE_TAX_PER', 'ISTRAILSUBSCRIPTION', 'PURCHASEPRICETYPE', 'IMAGE', 'PRICE', 'NETPAYABLE', 'DirectIncome', 'TYPE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Package_Kit_Master' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const ObjKit_Master = mapRows(await db.proc(DB, 'USP_EDITPACKAGE', { KID: '0' }), KIT_DETILS);
  if (ObjKit_Master.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Package_Kit_Master.xls', downloadName: ' Package_Kit_Master.xls', Filename,
      headers: ['Name', 'Min', 'Max', 'Mrp', 'SUBSCRIPTIONDETAILS', 'Status'],
      rows: ObjKit_Master, innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'PCODE')) + ' \t');
        w(tab(dec2(item.MININVESTMENT)) + ' \t');
        w(tab(dec2(item.MAXINVESTMENT)) + ' \t');
        w(tab(cellStr(item, 'PRICE')) + ' \t');
        w(tab(cellStr(item, 'SUBSCRIPTIONDETAILS')) + ' \t');
        w(tab(Number(item.ISACTIVE) === 0 ? 'Deactive' : 'Active') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(string sortOrder, string currentFilter, string searchString, string ddlOption, int? page, string btnexel)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Manage-kits" -> manage_kits/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manage-kits'], (req, res, next) => {
  url1 = legacyUrl(req).slice(1); // (static set before the session check, like legacy)
  url = '~' + url1;
  next();
}, adminAuth, asyncHandler(async (req, res) => {
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  // DB._Settings.Where(s => s.Active == true && s.caption == "PackagewiseGST").Select(s => s.Active).FirstOrDefault()
  const st = await db.queryOne(DB, "select active from settings where active = true and caption = 'PackagewiseGST' limit 1", {});
  ViewBag.setstatus = st ? col(st, 'active') : false;
  const ba = firstCol(await db.query(DB, "select coalesce(active, false) as binaryactive from settings where caption = 'IsPackageWiseBinary' and limits = 1", {}));
  ViewBag.ClubCode = firstCol(await db.query(DB, "select coalesce(clubcond, '') from settings where caption = 'INVOICEINITIALS'", {}));
  ViewBag.binaryactive = ba === null ? false : ba;
  const ObjKit_Master = mapRows(await db.proc(DB, 'USP_EDITPACKAGE', { KID: '0' }), KIT_DETILS);
  ViewBag.Logintype = 'Admin';
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/manage_kits/Index.cshtml', Model: ObjKit_Master, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Getkitdetils(double Kid)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/Getkitdetils{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Kid = nDec(req.p.Kid);
  if (Kid === null) {
    const e = new Error("The parameters dictionary contains a null entry for parameter 'Kid' of non-nullable type 'System.Double'");
    e.status = 500; throw e;
  }
  const rows = await db.proc(DB, 'USP_EDITPACKAGE', { KID: Kid });
  return res.json(rows.length ? mapRow(rows[0], KIT_DETILS) : null);
}));

// ---------------------------------------------------------------- JsonResult UpdateKit(string Mode, string KID, string PCODE, string PAUTOCODE, string TITLE,
//   string MININVESTMENT, string MAXINVESTMENT, string SUBSCRIPTIONDETAILS, string ISACTIVE, string PackageColor, string AmountColor, string MRP,
//   string IMAGE, string GST, string PACKAGEYPE, string PURCHASEPRICETYPE, string Directincome, string Type)
// auth (legacy dereferenced Session["Admin_User"] BEFORE its null check => NullReferenceException without a session; the
//       "This Page Has Been Expired" reply was unreachable)
// Config: VhostsRoot (optional; legacy hard-coded "C://inetpub//vhosts//")
router.all(`/admin/${C}/UpdateKit{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = (k) => nStr(req.p[k]);
  const regNo = req.user.emp_id;
  const loginid = req.user.emp_loginid;
  let Loginurl = firstCol(await db.query(DB, "select coalesce(software_url, '') as software_url from tbl_companymaster", {}));
  let MainURL = firstCol(await db.query(DB, "select coalesce(main_url, '') as software_url from tbl_companymaster", {}));
  if (Loginurl === null || MainURL === null) throw nullRef();
  Loginurl = Loginurl.split('http://').join('').split('https://').join('');
  MainURL = MainURL.split('http://').join('').split('https://').join('');
  // #region PackageImage
  let imgname = '';
  const IMAGE = P('IMAGE');
  if (IMAGE === null) throw nullRef(); // IMAGE.Trim()
  if (IMAGE.trim() !== '') {
    // PORT-NOTE: "C://inetpub//vhosts//" + MainURL + "//" + Loginurl + "//PackageImage" => (config.app.VhostsRoot || <uploadDir>/vhosts)/<MainURL>/<Loginurl>/PackageImage
    const SavePaths = path.join(config.app.VhostsRoot || path.join(config.uploadDir, 'vhosts'), MainURL, Loginurl, 'PackageImage');
    let base64String = '';
    if (IMAGE !== '') {
      base64String = IMAGE;
      let ProfileImage = String(loginid) + (await UtilityClass.GenerateRandomNumber());
      ProfileImage = ProfileImage.trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '-' + regNo + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(SavePaths, imgname);
    if (base64String.includes('base64,')) {
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = base64String.substring(IndexNo1);
    }
    const t = base64String.replace(/\s/g, '');
    if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) {
      throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
    }
    const b = Buffer.from(t, 'base64');
    const sharp = require('sharp');
    await sharp(b).metadata(); // System.Drawing.Image.FromStream(ms) (throws on invalid image data)
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      // (unreachable in legacy: oldimage is always "")
    } else {
      // PORT-NOTE: img.Save(path) re-encoded with System.Drawing; the decoded bytes are written as-is.
      fs.mkdirSync(SavePaths, { recursive: true });
      fs.writeFileSync(strValidFullName, b);
    }
  }
  // #endregion PackageImage
  const Ret = await new Kit_Master().UpdateKits(P('Mode'), P('KID'), P('PCODE'), P('TITLE'), P('MININVESTMENT'), P('MAXINVESTMENT'),
    P('SUBSCRIPTIONDETAILS'), P('ISACTIVE'), P('PackageColor'), P('AmountColor'), P('MRP'), imgname, P('GST'), P('PACKAGEYPE'), P('PAUTOCODE'),
    P('PURCHASEPRICETYPE'), P('Directincome'), P('Type'));
  return res.json(Ret);
}));

module.exports = router;
