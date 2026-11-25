'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Fund_Recieve_From_Agency.cs (class Fund_Recieve_From_AgencyController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Trans_Type = require('../../lib/admin/Trans_Type');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Fund_Recieve_From_Agency';

/** decimal subtraction keeping the larger scale (C# decimal arithmetic / ToString) */
function decSub(a, b) {
  const sa = String(a === null || a === undefined ? 0 : a);
  const sb = String(b === null || b === undefined ? 0 : b);
  const sc = (s) => (s.includes('.') ? s.split('.')[1].length : 0);
  const scale = Math.max(sc(sa), sc(sb));
  return (Number(sa) - Number(sb)).toFixed(scale);
}
/** decimal.ToString("0.00") on a non-nullable model property (null column => 0) */
const fix2 = (v) => Number(v === null || v === undefined ? 0 : v).toFixed(2);

// ---------------------------------------------------------------- ActionResult Index()
// auth
// route-config: "AdminPanel/Fund-Recieve-From-Agency" -> Fund_Recieve_From_Agency/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Fund-Recieve-From-Agency'], adminAuth, asyncHandler(async (req, res) => {
  const Empid = req.user.emp_id;
  sessionStore.set(req, 'Admin_User_Menu', await UtilityClass.UpdateAdminMenu(Empid));
  const Model = await new Trans_Type().Trans_Type_List();
  res.json({ view: '~/Views/AdminPanel/Fund_Recieve_From_Agency/Index.cshtml', Model });
}));

// ---------------------------------------------------------------- string getAvailablebal(string brcode)
// auth (PORT-NOTE: legacy had no session check; exposes branch balances => protected)
router.all(`/admin/${C}/getAvailablebal{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // PORT-NOTE: legacy ignored `brcode` and took the first active branch (db._Branch_Master.Where(a => a.Active == true).FirstOrDefault()).
  const BM = await db.queryOne(DB, 'select * from tbl_branch_master where active::int = 1 limit 1', {});
  let out;
  if (!BM) {
    out = 'error|^Invalid Branch Code';
  } else {
    out = `ok|^${B.str(B.col(BM, 'BrName'))}|^${B.str(B.col(BM, 'BrAddress'))}|^${fix2(B.col(BM, 'Current_Balance'))}|^${fix2(B.col(BM, 'MLimit'))}`;
  }
  res.type('text/html').send(out);
}));

// ---------------------------------------------------------------- JsonResult ValidateMember(string MemberID)
// auth (PORT-NOTE: legacy had no session check; member lookup for the admin page => protected)
router.all(`/admin/${C}/ValidateMember{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const MemberID = B.nStr(req.p.MemberID);
  const RetMsg = 'invalid';
  // a.LoginId.Equals(MemberID) && a.status == true
  let Row = await db.queryOne(DB, 'select regno from member_master where loginid = @MemberID and status::int = 1 limit 1', { MemberID });
  if (!Row) return res.json('invalid');
  // a.LoginId == MemberID && a.Active == true
  Row = await db.queryOne(DB, 'select regno from member_master where loginid = @MemberID and active::int = 1 limit 1', { MemberID });
  if (Row) return res.json('active');
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult ValidateAgency(string AgencyNo, string ClientID)
// auth (PORT-NOTE: legacy had no session check; exposes agency balances => protected)
router.all(`/admin/${C}/ValidateAgency{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const AgencyNo = B.nStr(req.p.AgencyNo);
  const ClientID = B.nStr(req.p.ClientID);
  let RetMsg = 'invalid';
  const Row = await db.queryOne(DB, `select amount, maxpurchase, purchase_balance from tbl_agency_master
    where agencyno = @AgencyNo and active::int = 1 and isblocked::int = 0 and loginid is not distinct from @ClientID limit 1`, { AgencyNo, ClientID });
  if (Row) {
    RetMsg = `valid|^${B.str(B.col(Row, 'Amount'))}|^${decSub(B.col(Row, 'MaxPurchase'), B.col(Row, 'Purchase_Balance'))}`;
  }
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult PaymentTrans(string Tobrid, string FromClient, string AgencyNo, decimal depositAmount, string Paymode, string Reciept, string Remark)
// auth-by-check (legacy returned Json("error^This page has been expired, Please refresh the page") without a session - contract kept)
router.all(`/admin/${C}/PaymentTrans{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const depositAmount = B.reqDec(req.p.depositAmount, 'depositAmount'); // non-nullable decimal: model-binding error before the action runs
  const Tobrid = B.nStr(req.p.Tobrid);
  const FromClient = B.nStr(req.p.FromClient);
  const AgencyNo = B.nStr(req.p.AgencyNo);
  const Paymode = B.nStr(req.p.Paymode);
  const Reciept = B.nStr(req.p.Reciept);
  const Remark = B.nStr(req.p.Remark);
  if (!isAdmin(req)) return res.json('error^This page has been expired, Please refresh the page');
  // Convert.ToString(depositAmount) == null || == "" : never true for a decimal (kept for completeness)
  if (String(depositAmount) === '') return res.json('error^Invalid Deposit amount');
  // PORT-NOTE: MVC binds empty strings as null, so these `== ""` checks (kept verbatim) only match an explicit "" value.
  if (Tobrid === '') return res.json('error^Please Enter To BRID');
  if (FromClient === '') return res.json('error^Please Enter From Client ID');
  if (AgencyNo === '') return res.json('error^Agency No can not be empty');
  if (depositAmount <= 0) return res.json('error^Deposit amount should be greater than 0');
  if (Remark === '') return res.json('error^Remark field can not be empty');

  const opEmpCode = req.user.emp_code;
  const emploginid = req.user.emp_loginid;

  // #region UploadReciept (outside the try in legacy: any failure => unhandled exception / 500)
  let imgname = '';
  if (Reciept === null) throw B.nullRef(); // Reciept.Trim() on null
  if (Reciept.trim() !== '') {
    const SavePaths = (config.app.PaymentReciptPath || '');
    let base64String = '';
    if (Reciept !== '') {
      base64String = Reciept;
      const ProfileImage = B.cleanName(emploginid);
      imgname = `${ProfileImage}-Fund Recieve From Agency-${await UtilityClass.GenerateRandomNumber()}.jpg`;
    } else {
      imgname = ' ';
    }
    const strValidFullName = `${B.mapPath(SavePaths)}/${imgname}`;
    const b = B.decodeBase64Image(base64String); // strips "data:...;base64," like the legacy IndexOf(",") logic
    await B.saveScaledImage(b, strValidFullName); // > 10 KB => 300px JPEG thumbnail, else original bytes
  }
  // #endregion UploadReciept

  try {
    // dbo.usp_Fund_Recieve_From_Agency @Tobrid,@FromClient,@AgencyNo,@depositAmount,@Paymode,@Reciept,@Remark,@brCode,@EmpCode,@Result out
    const row = await db.procOne(DB, 'usp_Fund_Recieve_From_Agency', {
      Tobrid, FromClient, AgencyNo, depositAmount, Paymode, Reciept: imgname, Remark, brCode: '', EmpCode: opEmpCode,
    });
    const returnval = B.outStr(row, 'Result');
    return res.json(returnval);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_Fund_Recieve_From_Agency');
    return res.json(`error^${ExpObj.message}`);
  }
}));

// private static bool ThumbnailCallback() => throw NotImplementedException: never invoked by GetThumbnailImage (sharp resize in saveScaledImage).

module.exports = router;
