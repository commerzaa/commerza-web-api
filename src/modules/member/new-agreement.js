'use strict';
// Ported from Member/Controllers/CustomerPanel/NewAgreementController.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc, procOne, queryOne, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const agreementlist = ['rownumber', 'AGID', 'regno', 'username', 'Name', 'mobileno', 'fathername', 'address', 'packageamount', 'clickamount', 'senddate', 'selectvalues', 'status', 'coname', 'trackno', 'sendvia', 'printdate', 'Relationtypes'];
// Session["member_master"] (Member_Master_Custom).regNo
const regNoOf = (u) => Number(u.regno != null ? u.regno : (u.regNo != null ? u.regNo : (u.member_master && (u.member_master.regNo != null ? u.member_master.regNo : u.member_master.regno)) || u.plid));

// auth (legacy: Session["Plid"] == null -> redirect Home/Index). route-config: url "referral/GCFE2Ctopd_slash_3cDJR_slash_NARGXgn0y1Ve6jZCUaV"
router.all(['/member/NewAgreement/Index{/:id}', '/member/NewAgreement', '/member/referral/GCFE2Ctopd_slash_3cDJR_slash_NARGXgn0y1Ve6jZCUaV'], auth, asyncHandler(async (req, res) => {
  const PLID = Math.trunc(Number(req.user.plid));
  const Regno = PLID;
  const Name = req.user.name; // unused in legacy
  const m = await queryOne(DB, "select FNAME as fname, MNAME as mname, LNAME as lname, coalesce(DOC, timestamp '1900-01-01') as regdate, ADDRESS as address, KYCStatus as kycstatus from MEMBER_MASTER where REGNO = @Regno", { Regno });
  if (!m) throw new TypeError('Object reference not set to an instance of an object.'); // MemberDetails is null
  // PORT-NOTE: legacy SELECT does not return LOGINID / AgreementID / IsActiveCustomeRnGID, so those members keep their C# defaults (0)
  const MemberDetails = { FName: m.fname, MName: m.mname, LName: m.lname, Regdate: m.regdate, address: m.address, KYCStatus: m.kycstatus, LoginId: 0, AgreementID: 0, IsActiveCustomeRnGID: 0 };
  const ViewBag = {};
  ViewBag.Name = (MemberDetails.FName == null ? '' : MemberDetails.FName) + ' ' + (MemberDetails.MName == null ? '' : MemberDetails.MName) + '' + (MemberDetails.LName == null ? '' : MemberDetails.LName);
  ViewBag.DOJ = MemberDetails.Regdate;
  ViewBag.Address = MemberDetails.address;
  ViewBag.Loginid = MemberDetails.LoginId;
  ViewBag.AgreementID = MemberDetails.AgreementID;
  ViewBag.KYCStatus = 0;
  if (MemberDetails.KYCStatus === true) ViewBag.KYCStatus = 1;
  if (MemberDetails.IsActiveCustomeRnGID === 1) {
    return res.json({ View: '~/Views/CustomerPanel/NewAgreement/Index.cshtml', Model: MemberDetails, ViewBag });
  }
  if (MemberDetails.IsActiveCustomeRnGID === 2) {
    return res.json({ View: '~/Views/CustomerPanel/Agreement-red-customer/Index.cshtml', Model: MemberDetails, ViewBag });
  }
  return res.json({ redirect: '/Home/Index' });
}));

// auth (uses Session["member_master"])
router.all('/member/NewAgreement/AddCourierDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const Regno = regNoOf(req.user);
  const ViewBag = {};
  ViewBag.check = await scalar(DB, 'select selectvalues from tbl_Agreement_Details where Regno = @Regno and status = 1 order by AGID desc limit 1', { Regno: String(Regno) });
  if (ViewBag.check === undefined) ViewBag.check = null;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_agreementlist', {
    regno: Regno, mode: '1', startrowindex: 1, maxrows: 1000, searchfield: '', searchvalue: '', fromdate: '', todate: '',
  });
  // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 if none)
  const TotalRecord = rows.length ? Math.trunc(Number(rows[0].totalcount || 0)) : 0;
  ViewBag.CurrentPage = 1;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = '';
  ViewBag.SearchValue = '';
  res.json({ View: '~/Views/MemberPanel/Agreement/AddCourierDetails.cshtml', Model: mapRows(rows, agreementlist), ViewBag });
}));

// auth (uses Session["member_master"])
router.all('/member/NewAgreement/saveagreement{/:id}', auth, asyncHandler(async (req, res) => {
  const { value, updatedate, name, fathername, address, packamt, clkamt } = req.p;
  const Regno = regNoOf(req.user);
  const d = new Date(updatedate);
  if (updatedate == null || isNaN(d.getTime())) throw new Error("The parameters dictionary contains a null entry for parameter 'updatedate' of non-nullable type 'System.DateTime'.");
  const out = await procOne(DB, 'usp_add_agreemnnt', {
    selectvalues: value, updatedate: d, name, fathername, address, regno: Regno, packamt: Number(packamt), clkamt: parseInt(clkamt, 10),
  });
  const Results = out && out.strresult != null ? String(out.strresult).trim() : '';
  res.json(Results);
}));

// auth (uses Session["member_master"])
router.all('/member/NewAgreement/updateagreement{/:id}', auth, asyncHandler(async (req, res) => {
  const { sendvia, trackno, comname, fromdate } = req.p;
  const Regno = regNoOf(req.user);
  const out = await procOne(DB, 'usp_update_agreemnnt', { sendvia, trackno, comname, regno: Regno, senddate: fromdate });
  const Results = out && out.strresult != null ? String(out.strresult).trim() : '';
  res.json(Results);
}));

module.exports = router;
