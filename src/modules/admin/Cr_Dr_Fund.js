'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Cr_Dr_Fund.cs (class Cr_Dr_FundController => /admin/Cr_Dr_Fund/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Trans_Type = require('../../lib/admin/Trans_Type');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Cr_Dr_Fund';

/** private static bool ThumbnailCallback() { throw new NotImplementedException(); } (GetThumbnailImageAbort delegate, never invoked) */
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }
void ThumbnailCallback;

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Cr-Dr-Fund" -> Cr_Dr_Fund/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Cr-Dr-Fund'], adminAuth, asyncHandler(async (req, res) => {
  const obj = new Trans_Type();
  const Empid = req.user.emp_id;
  const menu = await UtilityClass.UpdateAdminMenu(Empid); // Session["Admin_User_Menu"] = UtilityClass.UpdateAdminMenu(Empid)
  sessionStore.set(req, 'Admin_User_Menu', menu);
  return res.json({ view: '~/Views/AdminPanel/Cr_Dr_Fund/Index.cshtml', Model: await obj.Trans_Type_List(), Admin_User_Menu: menu });
}));

// ---------------------------------------------------------------- JsonResult getAvailablebal(string brcode)
// auth (branch balance; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/getAvailablebal{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const brcode = B.nStr(req.p.brcode);
  // db._Branch_Master.Where(a => a.BrCode == brcode && a.Active == true).FirstOrDefault()
  const BM = await db.queryOne(DB, `select brname, braddress, current_balance, mlimit from tbl_branch_master
    where brcode = @brcode and active = true limit 1`, { brcode });
  if (BM === null) return res.json('error|^Invalid Branch Code');
  const str = 'ok|^' + B.str(BM.brname) + '|^' + B.str(BM.braddress) + '|^' + B.dec2(BM.current_balance) + '|^' + B.dec2(BM.mlimit);
  return res.json(str);
}));

// ---------------------------------------------------------------- JsonResult CreditDebit(string brcode, decimal amount, string Type, string remark)
// auth-by-check (legacy returned Json("error^This page has been expired, Please refresh the page") without a session - contract kept)
router.all(`/admin/${C}/CreditDebit{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const amount = B.reqDec(req.p.amount, 'amount'); // model binding happens before the action body
  if (!isAdmin(req)) return res.json('error^This page has been expired, Please refresh the page');
  try {
    const EmpCode = req.user.emp_code;
    // PORT-NOTE: CommandTimeout = 1000 s - pg pool timeout applies.
    const row = await db.procOne(DB, 'Usp_AdminFundCreditDebit', {
      EmpCode, Tobrid: B.nStr(req.p.brcode), FromBRID: '', Amount: amount, Type: B.nStr(req.p.Type), Remark: B.nStr(req.p.remark), IpAddress: '',
    });
    const returnval = B.outStr(row, 'strresult');
    return res.json(returnval);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateBinaryLevelIncomSlab');
    return res.json('error^' + ExpObj.message);
  }
}));

// ---------------------------------------------------------------- JsonResult PaymentTransFromBrToBr(string FromBrCode, string ToBrCode, decimal amount, string PayMode, string DDChkNo, string remark, string image)
// auth (reads Session["Admin_User"] on the first line - NullReference without a session, so the later expiry check was unreachable)
router.all(`/admin/${C}/PaymentTransFromBrToBr{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const amount = B.reqDec(req.p.amount, 'amount');
  const FromBrCode = B.nStr(req.p.FromBrCode);
  const ToBrCode = B.nStr(req.p.ToBrCode);
  const PayMode = B.nStr(req.p.PayMode);
  let DDChkNo = B.nStr(req.p.DDChkNo);
  let remark = B.nStr(req.p.remark);
  const image = B.nStr(req.p.image);
  const EmpCode = req.user.emp_code;
  const emploginid = req.user.emp_loginid;
  // (amount == null) is never true for a decimal
  if (DDChkNo === null) DDChkNo = '';
  if (remark === null) remark = '';
  if (!isAdmin(req)) return res.json('error^This page has been expired, Please refresh the page');
  const cs = (v) => (v === null ? '' : String(v)); // Convert.ToString(null) => ""
  if (cs(FromBrCode) === '') return res.json('error^Please enter from BRID');
  if (cs(ToBrCode) === '') return res.json('error^Please enter to BRID');
  if (cs(FromBrCode).trim() === cs(ToBrCode).trim()) return res.json('error^Both BRID shoul be different');
  if (Number(amount) <= 0) return res.json('error^Payment amount should be greater than 0');

  // #region UploadReciept
  let imgname = '';
  if (image === null) throw B.nullRef(); // image.Trim()
  if (image.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.PaymentReciptPath; // AppSettings["PaymentReciptPath"]
    if (image !== '') {
      base64String = image;
      imgname = B.cleanName(emploginid) + '-Fund Transfer B2B-' + await UtilityClass.GenerateRandomNumber() + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(B.mapPath(SavePaths), imgname);
    const b = B.decodeBase64Image(base64String);
    const oldimage = '';
    if (oldimage !== '') {
      const o = path.join(B.mapPath(SavePaths), oldimage);
      if (fs.existsSync(o)) fs.unlinkSync(o);
    }
    await B.saveScaledImage(b, strValidFullName);
  }
  try {
    const row = await db.procOne(DB, 'usp_PaymentFromBranchToBranch', {
      frombranch: FromBrCode, tobranch: ToBrCode, amount, PayMode, DDChkNo, remarks: remark, sessionID: EmpCode, OpBrCode: '', IpAddress: '',
      Image: imgname,
    });
    const returnval = B.outStr(row, 'strresult');
    return res.json(returnval);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_PaymentFromBranchToBranch');
    return res.json('error^' + ExpObj.message);
  }
}));

module.exports = router;
