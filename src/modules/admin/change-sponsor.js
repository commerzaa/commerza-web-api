'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Change_sponsor.cs (class Change_sponsorController => /Change_sponsor/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { sp, str, outVal } = require('./_shared/batch04-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Change_sponsor';

/** class Change_sponsor */
const CHANGE_SPONSOR_PROPS = ['Regno', 'FNAME', 'Mobile', 'Username', 'EmailId', 'Amount', 'ActivationDate', 'RegDate', 'SponsorName',
  'SponsorUserName', 'KitPrice'];

const MEMBER_SQL = `select mm.regno, mm.fname, mm.mobile, coalesce(mm.kitprice, 0) as kitprice, mm.emailid,
  coalesce(((mm.doc)::date)::varchar(20), '') as activationdate, ((mm.regdate)::date)::varchar(20) as regdate, mm.username,
  mm1.fname as sponsorname, mm1.username as sponsorusername
  from member_master as mm inner join member_master as mm1 on mm1.loginid = mm.sponserid where mm.username = @u`;

// ---------------------------------------------------------------- Index(int? page, string fromdate, ... string TransactionId)
// public (legacy had no session check; only returned the view, parameters unused)
// route-config: "AdminPanel/Change-sponsor" -> Change_sponsor/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Change-sponsor'], asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Change_sponsor/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult ChangeSPONSORName(string Username, string sponsor, string newparent)
// auth (Session["Admin_User"] == null => Response.Redirect("/") then NullReference on the cast)
router.all(`/admin/${C}/ChangeSPONSORName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = sp(req, 'Username');
  const sponsor = sp(req, 'sponsor');
  const empId = req.user.emp_id;
  // PORT-NOTE: MVC binds an empty value as null, so `Username == ""` is only true when the client posts a literal empty
  // string that survives binding (never in practice); kept as in legacy.
  if (Username === '') return res.json('Error^Please Enter the UserName.');
  if (sponsor === '') return res.json('Error^Please Enter the SponsorName..');
  if (Username === sponsor) return res.json('Error^Sponsor and UserName Should Be Different.');
  // PORT-NOTE: legacy command text was "USP_ChangeSPONSORName @Username,@sponsor,@EmpID,@StrResult out,newparent" - the 5th
  // argument is the bare word `newparent` (T-SQL passes it as the string literal 'newparent'), the @newparent SqlParameter was
  // never referenced. Reproduced: the literal 'newparent' is passed.
  const rows = await db.proc(DB, 'USP_ChangeSPONSORName', {
    Username, sponsor, EmpID: empId, newparent: 'newparent',
  });
  const ret = str(outVal(rows, 'StrResult'));
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (acts on member data for the admin; legacy had no session check)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Changesponsor = [];
  try {
    // legacy: ... where mm.USERNAME='" + memberid + "'  (null => '' concatenated) - parameterised
    Changesponsor = mapRows(await db.query(DB, MEMBER_SQL, { u: str(sp(req, 'memberid')) }), CHANGE_SPONSOR_PROPS);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
  }
  return res.json(Changesponsor);
}));

// ---------------------------------------------------------------- JsonResult GetParentDetails(string newparent)
// auth (acts on member data; legacy had no session check)
router.all(`/admin/${C}/GetParentDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Changesponsor = [];
  try {
    Changesponsor = mapRows(await db.query(DB, MEMBER_SQL, { u: str(sp(req, 'newparent')) }), CHANGE_SPONSOR_PROPS);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail'); // legacy PROCEDURENAME copy-paste kept
  }
  return res.json(Changesponsor);
}));

// ---------------------------------------------------------------- JsonResult GetDetailSponsor(string memberid, string Regno)
// auth (acts on member data; legacy had no session check)
router.all(`/admin/${C}/GetDetailSponsor{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberid = sp(req, 'memberid');
  const Regno = sp(req, 'Regno');
  if (memberid !== '') { // null != "" => true (legacy)
    let Changesponsor = [];
    let total = null;
    let failed = false;
    try {
      const rows = await db.proc(DB, 'USP_GETDETAILSPONSOR', { SPONSORID: memberid, REGNO: Regno });
      total = outVal(rows, 'TotalCount');
      Changesponsor = mapRows(rows, CHANGE_SPONSOR_PROPS);
    } catch (ExpObj) {
      failed = true;
      await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
    }
    // legacy: spOutput.Value.ToString() - after an exception the OUT value is null => NullReferenceException (500)
    if (failed) throw new Error('Object reference not set to an instance of an object.');
    // PORT-NOTE: @TOTALCOUNT OUT read from the first result row; with no rows it is unknown => "" (DBNull.ToString()).
    if (str(total) !== 'Successfully') return res.json(str(total));
    return res.json(Changesponsor);
  }
  return res.json(0); // Json(JsonRequestBehavior.AllowGet) serialises the enum value
}));

module.exports = router;
