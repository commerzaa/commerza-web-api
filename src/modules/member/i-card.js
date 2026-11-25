'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/I_Card.cs  (I_CardController, 2 actions)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid. (No SessionExpireCheck in the C#, but both actions dereference the session => auth.)
const express = require('express');
const router = express.Router();
const { queryOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');

const DB = 'affiliate';
const BASE = '/member/I_Card';
const MEMBER_DETAILS = ['regNo', 'LoginId', 'FName', 'LName', 'userName', 'Emailid', 'RegDate', 'address', 'mobile', 'city', 'imagename', 'Dob'];
const COMPANY_INFO = ['Name', 'MOBILE', 'ADDRESS_1', 'ADDRESS_2'];
const MEMBER_SQL = `Select regno, loginid, fname, lname, username, emailid, address, regdate, dob, mobile, c.cityname as city, imagename
  from member_master mm left join city c on c.ctid = mm.ctid where regno = @plid`;

async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index
// route-config: referral/cxy1VCGr5YOMslJB0cZseA==CXR
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/cxy1VCGr5YOMslJB0cZseA==CXR'], auth, asyncHandler(async (req, res) => {
  const memberdetails = mapRow(await queryOne(DB, MEMBER_SQL, { plid: req.user.plid }), MEMBER_DETAILS);
  const CompanyInfo = mapRow(await queryOne(DB, 'select name, mobile, address_1, address_2 from tbl_companymaster limit 1'), COMPANY_INFO);
  // C# dereferences CompanyInfo.Name (NullReferenceException when the table is empty)
  if (!CompanyInfo) throw new Error('Object reference not set to an instance of an object.');
  const ViewBag = { Name: CompanyInfo.Name, ADDRESS_1: CompanyInfo.ADDRESS_1, ADDRESS_2: CompanyInfo.ADDRESS_2, MOBILE: CompanyInfo.MOBILE };
  res.json({ view: '~/Views/I_Card/Index.cshtml', Model: memberdetails, ViewBag });
}));

// check_icard(string memberID) - memberID is unused by the C# (always the session member)
// auth
router.all(`${BASE}/check_icard{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    const memberdetails = mapRow(await queryOne(DB, MEMBER_SQL, { plid: req.user.plid }), MEMBER_DETAILS);
    return res.json(memberdetails);
  } catch (ExpObj) {
    await errInsert(req, 'check_icard', ExpObj);
    return res.json('string^Something went wrong. Please try later');
  }
}));

module.exports = router;
