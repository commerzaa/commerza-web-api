'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Show_Member_Profile.cs (class Show_Member_ProfileController => /admin/Show_Member_Profile/...)
// Database: affiliate (Db_Affiliate).
// Coverage: Index -> route ; UpdateMemberProfile -> route ; ThumbnailCallback (private static, never called) -> not routed.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const SaveImage = require('../../lib/admin/SaveImage');
const PancardDetails = require('../../lib/admin/PancardDetails');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'Show_Member_Profile';

/** nested class ShowMemberProfileDetails */
const PROPS = ['LoginId', 'spid', 'spName', 'kitDesc', 'gender', 'dob', 'Regdate', 'ctid', 'cityName', 'sid', 'stateName', 'address', 'cid',
  'Fname', 'Mname', 'Lname', 'Emailid', 'mobile', 'ImageName', 'IFSCCode', 'bankName', 'branchName', 'accountHolderName', 'accountNo', 'Name',
  'PanNo', 'DOB', 'panimage'];

// TempData["MemberId"] / TempData["memberReg"] => sessionStore (per admin). PORT-NOTE: TempData's read-once expiry cannot be observed
// server-side (the view read it); the value is kept until the controller clears it.
const TD_MEMBERID = 'TempData:MemberId';
const TD_MEMBERREG = 'TempData:memberReg';

/** System.IO.Path.GetFileName (both separators; null => null) */
const getFileName = (s) => (s === null || s === undefined ? null : String(s).split(/[\\/]/).pop());

// ---------------------------------------------------------------- Index(string memberid)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Change-Member-Profile" -> Show_Member_Profile/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Change-Member-Profile'], adminAuth, asyncHandler(async (req, res) => {
  const memberid = B.nStr(req.p.memberid);
  const ViewBag = {};
  if (memberid === null) ViewBag.MemberID = '';
  else ViewBag.MemberID = memberid;
  const peek = sessionStore.get(req, TD_MEMBERID);
  if (peek !== undefined && peek !== null) {
    const referer = req.get('referer');
    if (!referer) {
      sessionStore.set(req, TD_MEMBERID, null);
      return res.json({ redirect: '/Show_Member_Profile/Index' }); // RedirectToAction("Index", "Show_Member_Profile")
    }
    // Request.UrlReferrer.Segments.Last().ToLower().Trim()
    let p = referer;
    try { p = new URL(referer).pathname; } catch (_) { /* keep raw */ }
    const segs = p.match(/[^/]*\/|[^/]+$/g) || ['/'];
    const pagename = segs[segs.length - 1].toLowerCase().trim();
    // PORT-NOTE: legacy compared the lower-cased segment with "Change-Member-Profile" (mixed case) => always different. Kept.
    if (pagename !== 'Change-Member-Profile') {
      sessionStore.set(req, TD_MEMBERID, null);
      return res.json({ redirect: '/Show_Member_Profile/Index' });
    }
  } else if (memberid !== null && memberid !== '') {
    const regno = await UtilityClass.GetRegNoFromLoginId(memberid);
    // db._Member_login.Where(m => m.Regno == regno).FirstOrDefault()
    const ML = await db.queryOne(DB, 'select * from member_login where regno = @regno limit 1', { regno });
    if (ML !== null) {
      if (ML.loginid === null || ML.loginid === undefined) throw B.nullRef();
      if (String(ML.loginid).toLowerCase().trim() === memberid.toLowerCase().trim()) {
        sessionStore.set(req, TD_MEMBERID, 'valid');
      }
    } else {
      ViewBag.msg = 'Invalid MemberID';
    }
  }
  const regno = await UtilityClass.GetRegNoFromLoginId(memberid);
  // PORT-NOTE: "usp_getMemberProfilesponsor @Regno" binds positionally; the proc's only parameter is @LOGINID (it receives the regno).
  const row = await db.procOne(DB, 'usp_getMemberProfilesponsor', { LOGINID: regno });
  const spdetail = row ? mapRow(row, PROPS) : null;
  if (spdetail !== null) ViewBag.panimage = spdetail.panimage;
  if (ViewBag.panimage === null || ViewBag.panimage === undefined) ViewBag.panimage = '../PancardImage/As123677FD3.jpeg';
  const TempData = { MemberId: sessionStore.get(req, TD_MEMBERID) === undefined ? null : sessionStore.get(req, TD_MEMBERID) };
  return res.json({ view: '~/Views/AdminPanel/Show_Member_Profile/Index.cshtml', Model: spdetail, ...ViewBag, TempData });
}));

// ---------------------------------------------------------------- JsonResult UpdateMemberProfile(string gender, string email, string mobileno, string stateid,
//   string stateName, string cityid, string addres, string imagename, string FName, string MName, string LName, string memberi, string cityName,
//   string ifscCode, string bankName, string branchName, string AcHolderName, string AcNumber, string name, string panno, string pandob,
//   string Image, string olddabaseimage)
// auth (PORT-NOTE: legacy had no session check on this member-profile update - protected here)
router.all(`/admin/${C}/UpdateMemberProfile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const g = (k) => B.nStr(req.p[k]);
  const gender = g('gender'); const email = g('email'); const mobileno = g('mobileno'); const stateid = g('stateid');
  const stateName = g('stateName'); const addres = g('addres'); const imagename = g('imagename');
  const FName = g('FName'); const MName = g('MName'); const LName = g('LName'); const memberi = g('memberi'); const cityName = g('cityName');
  const ifscCode = g('ifscCode'); const bankName = g('bankName'); const branchName = g('branchName'); const AcHolderName = g('AcHolderName');
  const AcNumber = g('AcNumber'); const name = g('name'); const panno = g('panno'); const pandob = g('pandob'); const Image = g('Image');
  let olddabaseimage = g('olddabaseimage');
  // (cityid is bound but unused, like legacy)

  const regNo = await UtilityClass.GetRegNoFromLoginId(B.trimS(memberi));
  if (regNo <= 0) {
    return res.json('error');
  }
  {
    const objdata = new DataUtility();
    const param = [
      DataUtility.SqlParameter('@mobile', mobileno),
      DataUtility.SqlParameter('@Emailid', email),
      DataUtility.SqlParameter('@PanNo', panno),
      DataUtility.SqlParameter('@mode', 1),
      DataUtility.SqlParameter('@regno', regNo),
      DataUtility.SqlParameter('@strResult', '', 'Output'),
    ];
    const v = await objdata.GetScalerSP(param, 'usp_get_checkDuplicate');
    if (v === null || v === undefined) throw B.nullRef(); // .ToString() on a null scalar
    const returnval = String(v);
    if (!(returnval === '' || returnval === 'ok')) {
      return res.json(returnval);
    }
  }
  const loginid = memberi;
  let imgname = '';
  if (B.trimS(imagename) !== '' && imagename.includes('base64,')) {
    let base64String = '';
    let ImageExt = '';
    const SavePaths = config.app.MemberImagePath || ''; // AppSettings["MemberImagePath"]
    if (imagename !== '') {
      base64String = imagename;
      imgname = B.cleanName(loginid) + '-' + regNo + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(B.mapPath(SavePaths), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      ImageExt = B.csSubstr(base64String, IndexNo, lastIndexNo - IndexNo);
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = B.csSubstr(base64String, IndexNo1, base64String.length - IndexNo1);
    }
    void ImageExt;
    const b = B.decodeBase64Image(base64String); // Convert.FromBase64String
    // Image.FromStream + delete existing file + (filesize > 10 KB => 300px thumbnail saved as JPEG, else original) - see saveScaledImage
    // (oldimage was hard-coded "" in legacy => no old-image delete)
    await B.saveScaledImage(b, strValidFullName);
  }
  let OutputResult = '';
  let PROCEDURENAME = '';
  imgname = getFileName(imgname);
  try {
    PROCEDURENAME = 'usp_MemberProfile';
    // PORT-NOTE: legacy text "dbo.usp_MemberProfile @regno,@loginid,@fname,@mname,@lName,@Gender,@Dob,@Email,@mobile,@stid,@ctid,@CityName,
    // @StateName,@addres,@imagefilename,@tpassword,@cid,@result out" binds POSITIONALLY, but the proc in db/affilate.sql has @PINCODE after
    // @MOBILE (values would shift by one and @result would hit @CID). The values are passed by their intended names here.
    // '' for the int parameters @ctid/@cid was converted to 0 by SQL Server; 0 is passed.
    const p = B.need({
      regno: regNo, loginid, fname: FName, mname: MName, lname: LName, gender, dob: '', email, mobile: mobileno, stid: stateid, ctid: 0,
      cityname: cityName, statename: stateName, addres, imagefilename: imgname, tpassword: '', cid: 0,
    });
    const row = await db.procOne(DB, 'usp_MemberProfile', p);
    OutputResult = B.str(B.col(row, 'result'));
    sessionStore.set(req, TD_MEMBERREG, OutputResult); // TempData["memberReg"]
    if (OutputResult.indexOf('success') > -1) {
      PROCEDURENAME = 'usp_InsertBank_Detail';
      const pb = B.need({ regno: regNo, ifsccode: ifscCode, bankname: bankName, branchname: branchName, Holdername: AcHolderName, accountno: AcNumber });
      await db.proc(DB, 'usp_InsertBank_Detail', pb); // (affected-row count .ToString() unused)
      const objimage = new SaveImage();
      const imgnamee = (panno === null ? '' : panno) + '-' + regNo;
      let filename = '';
      if (Image === null) throw B.nullRef();
      if (Image.includes('base64,')) {
        const strValidFullName = B.mapPath(config.app.PanCardImagePath || ''); // Server.MapPath(AppSettings["PanCardImagePath"])
        filename = await objimage.SaveImageNmae(1, Image, imgnamee, strValidFullName);
        if (getFileName(olddabaseimage) !== filename) {
          olddabaseimage = strValidFullName + '/' + (olddabaseimage === null ? '' : olddabaseimage);
          try { if (fs.existsSync(olddabaseimage) && fs.statSync(olddabaseimage).isFile()) fs.unlinkSync(olddabaseimage); } catch (e) { throw e; }
        }
      } else {
        filename = getFileName(Image);
      }
      if (B.trimS(name) !== '' && panno !== '') {
        await new PancardDetails().PancardsDetail(regNo, name, panno, pandob, filename, 1);
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, PROCEDURENAME);
  }
  return res.json(OutputResult);
}));

module.exports = router;
