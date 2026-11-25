'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Fund_Transfer_From_B2B.cs (class Fund_Transfer_From_B2BController => /admin/Fund_Transfer_From_B2B/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; getAvailablebal (public string => routable) -> route + internal function (used by Index) ;
//           PaymentTransFromBrToBr -> route ; private static ThumbnailCallback -> internal function (never invoked).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Trans_Type = require('../../lib/admin/Trans_Type');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Fund_Transfer_From_B2B';

/** private static bool ThumbnailCallback() { throw new NotImplementedException(); } (GetThumbnailImageAbort delegate, never invoked) */
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }
void ThumbnailCallback;

/** public string getAvailablebal(string brcode) */
async function getAvailablebal(brcode) {
  // db._Branch_Master.Where(a => a.BrCode == brcode && a.Active == true).FirstOrDefault()
  const BM = await db.queryOne(DB, `select brname, braddress, current_balance, mlimit from tbl_branch_master
    where brcode = @brcode and active = true limit 1`, { brcode });
  if (BM === null || BM === undefined) return 'error|^Invalid Branch Code';
  return 'ok|^' + B.str(BM.brname) + '|^' + B.str(BM.braddress) + '|^' + B.dec2(BM.current_balance) + '|^' + B.dec2(BM.mlimit);
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Fund-Transfer-From-B2B" -> Fund_Transfer_From_B2B/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Fund-Transfer-From-B2B'], adminAuth, asyncHandler(async (req, res) => {
  const brcode = '';
  const obj = new Trans_Type();
  const Empid = req.user.emp_id;
  const menu = await UtilityClass.UpdateAdminMenu(Empid); // Session["Admin_User_Menu"] = UtilityClass.UpdateAdminMenu(Empid)
  sessionStore.set(req, 'Admin_User_Menu', menu);
  const ViewBag = { getAvailablebal: await getAvailablebal(brcode) };
  return res.json({ view: '~/Views/AdminPanel/Fund_Transfer_From_B2B/Index.cshtml', Model: await obj.Trans_Type_List(), Admin_User_Menu: menu, ...ViewBag });
}));

// ---------------------------------------------------------------- public string getAvailablebal(string brcode)
// auth (branch name/balance; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/getAvailablebal{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // `public string` action => ContentResult (text/html)
  res.type('text/html').send(await getAvailablebal(B.nStr(req.p.brcode)));
}));

// ---------------------------------------------------------------- JsonResult PaymentTransFromBrToBr(string FromBrCode, string ToBrCode, decimal amount, decimal Limitamount, decimal LedgerBal, string PayMode, string DDChkNo, string remark, string image)
// auth (reads Session["Admin_User"] on the first line - NullReference without a session, so the later expiry check was unreachable)
router.all(`/admin/${C}/PaymentTransFromBrToBr{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // non-nullable decimal parameters: MVC model binding fails (500) when missing
  const amount = B.reqDec(req.p.amount, 'amount');
  const Limitamount = B.reqDec(req.p.Limitamount, 'Limitamount'); void Limitamount; // only used by commented-out code
  const LedgerBal = B.reqDec(req.p.LedgerBal, 'LedgerBal'); void LedgerBal;
  const FromBrCode = B.nStr(req.p.FromBrCode);
  const ToBrCode = B.nStr(req.p.ToBrCode);
  const PayMode = B.nStr(req.p.PayMode);
  let DDChkNo = B.nStr(req.p.DDChkNo);
  let remark = B.nStr(req.p.remark);
  const image = B.nStr(req.p.image);
  const EmpCode = req.user.emp_code;
  const emploginid = req.user.emp_loginid;
  // (amount == null) is never true for a decimal => "error^Invalid payment amount" unreachable
  if (DDChkNo === null) DDChkNo = '';
  if (remark === null) remark = '';
  if (!isAdmin(req)) return res.json('error^This page has been expired, Please refresh the page');
  const cs = (v) => (v === null ? '' : String(v)); // Convert.ToString(null) => ""
  if (cs(FromBrCode) === '') return res.json('error^Please enter from BRID');
  if (cs(ToBrCode) === '') return res.json('error^Please enter to BRID');
  if (cs(FromBrCode).trim() === cs(ToBrCode).trim()) return res.json('error^Both BRID shoul be different');
  if (Number(amount) <= 0) return res.json('error^Payment amount should be greater than 0');

  // #region UploadReciept (outside the try in legacy => exceptions are unhandled / 500)
  let imgname = '';
  if (image === null) throw B.nullRef(); // image.Trim()
  if (image.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.PaymentReciptPath || ''; // AppSettings["PaymentReciptPath"]
    if (image !== '') {
      base64String = image;
      imgname = B.cleanName(emploginid) + '-Fund Transfer B2B-' + await UtilityClass.GenerateRandomNumber() + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(B.mapPath(SavePaths), imgname);
    const b = B.decodeBase64Image(base64String);
    const oldimage = ''; // param[9].Value.ToString() (commented)
    if (oldimage !== '') {
      const o = path.join(B.mapPath(SavePaths), oldimage);
      if (fs.existsSync(o)) fs.unlinkSync(o);
    }
    // filesize > 10 KB => 300px thumbnail saved as JPEG; else original image saved (System.Drawing -> sharp)
    await B.saveScaledImage(b, strValidFullName);
  }
  // #endregion UploadReciept
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
