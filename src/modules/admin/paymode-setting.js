'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Paymode_Setting.cs (class Paymode_SettingController, no namespace
// => /admin/Paymode_Setting/...). Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK,
// USP_EXCEL_DOWNLOAD_HISTORY; table tbl_paymode (lib Payment_Mode_New).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { optionalAuth } = require('../../middleware/auth');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Payment_Mode_New = require('../../lib/admin/Payment_Mode_New');
const { adminAuth, isAdmin, legacyUrl, getAdminMenu, errorInsert } = require('./_shared/admin-session');
const {
  nStr, reqInt, reqDec, cellStr, tab, nowStamp, excelHistory, writeXlsExport, excelLink, inlinePerms, nullRef,
} = require('./_shared/batch11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Paymode_Setting';
const SESSION_EXPIRED = 'Session Expired. Please login again';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Paymode_Setting' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename); // (@FILENAME / @MODE are referenced by name in the legacy text => same binding)
  const rm = new Payment_Mode_New();
  const paymode = await rm.paymode();
  if (paymode.length > 0) {
    let srno = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Paymode_Setting.xls', Filename, rows: paymode, downloadName: ' Paymode_Setting.xls',
      headers: ['S.No.', 'Paymode', 'API Key'],
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: async (item, w) => {
        w('\n');
        w(tab(String(srno)) + ' \t');
        w(tab(cellStr(item, 'payMode')) + ' \t');
        const dec = await UtilityClass.Decryptword(item.Secret_pin);
        if (dec === null || dec === undefined) throw nullRef();
        w(tab(String(dec)) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel)
// auth (Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/paymode-setting" -> Paymode_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/paymode-setting'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if ((await getAdminMenu(req)) === null) return res.json({ redirect: '/adminlogin/Index' });
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  const rm = new Payment_Mode_New();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Paymode_Setting/Index.cshtml', Model: await rm.paymode(), ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult statuschange(int id, int value, int mode)
// auth (optionalAuth + legacy Json("Session Expired. Please login again") without a session)
router.all(`/admin/${C}/statuschange{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const id = reqInt(req.p.id, 'id');
  const value = reqInt(req.p.value, 'value');
  const mode = reqInt(req.p.mode, 'mode');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  let stringret = '';
  try {
    let Row = 0; // eslint-disable-line no-unused-vars
    if (mode === 1) {
      Row = await db.exec(DB, 'update tbl_paymode set status = @value where pmoid = @id', { value, id });
      stringret = 'success';
    } else if (mode === 2) {
      Row = await db.exec(DB, 'update tbl_paymode set withdrawal_status = @value where pmoid = @id', { value, id });
      stringret = 'success';
    } else if (mode === 3) {
      Row = await db.exec(DB, 'update tbl_paymode set isadminshow = @value where pmoid = @id', { value, id });
      stringret = 'success';
    }
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'statuschange');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult Edit_Data(int RID)
// auth (optionalAuth + legacy Json("Session Expired. Please login again") without a session)
router.all(`/admin/${C}/Edit_Data{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const RID = reqInt(req.p.RID, 'RID');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    let stringret = ''; let secretkey = ''; let Variablepercentage = 0;
    // db._Payment_Mode_New.Where(a => a.pmoid == RID).FirstOrDefault()
    const row = Payment_Mode_New.map(await db.queryOne(DB, 'select * from tbl_paymode where pmoid = @RID limit 1', { RID }));
    if (row !== null) {
      secretkey = await UtilityClass.Decryptword(row.Secret_pin);
      Variablepercentage = row.VariablePercenatgeForAutoApprove;
    }
    const vp = Variablepercentage === null || Variablepercentage === undefined ? '' : String(Variablepercentage);
    stringret = stringret + '^' + 'Success' + '^' + (secretkey === null || secretkey === undefined ? '' : secretkey) + '^' + vp;
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Edit_Data');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult Updatebtc(int id, string btcaddress, decimal variablepercentauto)
// auth (optionalAuth + legacy Json("Session Expired. Please login again") without a session)
router.all(`/admin/${C}/Updatebtc{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const id = reqInt(req.p.id, 'id');
  const btcaddress = nStr(req.p.btcaddress);
  const variablepercentauto = reqDec(req.p.variablepercentauto, 'variablepercentauto');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  let New_btc_address = ''; let stringret = ''; // eslint-disable-line prefer-const
  try {
    New_btc_address = await UtilityClass.Encryptword(btcaddress);
    // update TBL_PAYMODE set SECRET_PIN='<enc>',VariablePercenatgeForAutoApprove=<v> where PMOID=<id>
    const Ret = await db.exec(DB, 'update tbl_paymode set secret_pin = @New_btc_address, variablepercenatgeforautoapprove = @variablepercentauto where pmoid = @id', // eslint-disable-line no-unused-vars
      { New_btc_address, variablepercentauto, id });
    stringret = 'Success';
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Updatebtc');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
