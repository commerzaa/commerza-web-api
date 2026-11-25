'use strict';
// Ported from Franchise/Controllers/CustomerPanel/AllMobileList.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const router = express.Router();
const { query, queryOne, exec, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const DAL_AllMobileList = require('../../lib/franchise/DAL_AllMobileList');

const BASE = '/franchise/AllMobileList';
const PROPS = ['RowNumber', 'TMCSMID', 'ShortMobile', 'Mobile', 'Status', 'GROUPNAME', 'CREATEDATE', 'REMARK', 'ISACTIVE', 'NoofMobiles'];
const EXPIRED = 'error^This page has been expired, Please login again';
const toBool = (v) => v === true || String(v).toLowerCase() === 'true';

// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, GroupName } = req.p;
  let page = req.p.page;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (GroupName == null) GroupName = '';
  if (page == null || page === '') page = 1;
  const MaxRows = 20;
  const Plid = req.user.did;
  const rows = await proc('shopping', 'allmobilelist', {
    plid: Plid, fromdate: fromdate.trim(), todate: todate.trim(), groupname: GroupName.trim(),
    startrowindex: Number(page), maxrows: MaxRows,
  });
  // PORT-NOTE: @IntResult OUT read from "intresult" column of first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].intresult || 0) : 0;
  const ObjGroupName = mapRows(await query('shopping',
    'select distinct groupname from tbl_member_customer_mobile where plid = @plid', { plid: Math.trunc(Number(req.user.did)) }), ['GroupName']);
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      Status: GroupName, fromDate: fromdate, toDate: todate, GroupName: ObjGroupName, IsPopUpCheck: 1,
    },
  });
}));

// auth - returns Add_Mobile view (no data)
router.all(`${BASE}/ADDNEWMOBILE{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json({});
}));

// auth
router.all(`${BASE}/SAVE{/:id}`, auth, asyncHandler(async (req, res) => {
  let RESPONSE = '';
  const Plid = req.user.did;
  if (Plid > 0) {
    RESPONSE = await new DAL_AllMobileList().Create(req.p.MOBILE, toBool(req.p.CHECK), Plid, req.p.GroupName);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

// auth
router.all(`${BASE}/Edit{/:id}`, auth, asyncHandler(async (req, res) => {
  const TMCSMID = parseInt(req.p.TMCSMID, 10);
  const Mobile = req.p.Mobile;
  const row = await queryOne('shopping', 'select * from tbl_member_customer_mobile where tmcsmid = @id', { id: TMCSMID });
  res.json({ ViewBag: { TMCSMID, Mobile, Rowvalue: mapRow(row, PROPS) } });
}));

// auth
router.all(`${BASE}/MODIFY{/:id}`, auth, asyncHandler(async (req, res) => {
  let RESPONSE = '';
  const Plid = req.user.did;
  if (Plid > 0) {
    RESPONSE = await new DAL_AllMobileList().Modify(parseInt(req.p.TMCSMID, 10), req.p.MOBILE, toBool(req.p.CHECK), Plid, req.p.OldMobile);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

// auth
router.all(`${BASE}/Reject{/:id}`, auth, asyncHandler(async (req, res) => {
  let RESPONSE = '';
  const Plid = req.user.did;
  if (Plid > 0) {
    RESPONSE = await new DAL_AllMobileList().Reject(parseInt(req.p.TMCSMID, 10), req.p.MOBILE, Plid);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

// auth
router.all(`${BASE}/DeleteOneCompleteRow{/:id}`, auth, asyncHandler(async (req, res) => {
  let result = '';
  try {
    const Res = await exec('shopping', 'update tbl_member_customer_mobile set isactive = false, isdeleted = true where tmcsmid = @id', { id: parseInt(req.p.TMCSMID, 10) });
    result = Res === 1 ? 'Group Data Successfully deleted.' : 'Some error occured.';
  } catch (Exp) {
    result = String(Exp);
  }
  res.json(result);
}));

// auth
router.all(`${BASE}/Delete{/:id}`, auth, asyncHandler(async (req, res) => {
  const TMCSMID = parseInt(req.p.TMCSMID, 10);
  const MOBILE = req.p.MOBILE;
  let RESPONSE = '';
  try {
    const Obj = await queryOne('shopping', 'select mobile from tbl_member_customer_mobile where tmcsmid = @id', { id: TMCSMID });
    const Arr = String(Obj.mobile).split(',');
    if (Arr.length > 1) {
      let UpdateMobile = '';
      for (let i = 0; i < Arr.length; i++) {
        if (Arr[i] !== MOBILE) UpdateMobile += Arr[i] + ',';
      }
      UpdateMobile = UpdateMobile.replace(/,+$/, '');
      await exec('shopping', 'update tbl_member_customer_mobile set mobile = @m where tmcsmid = @id', { m: UpdateMobile, id: TMCSMID });
    } else {
      await exec('shopping', 'update tbl_member_customer_mobile set isactive = false, isdeleted = true where tmcsmid = @id', { id: TMCSMID });
    }
    RESPONSE = 'Mobile Deleted Successfully.';
  } catch (Exp) {
    RESPONSE = 'Some Error Occured!';
    return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

module.exports = router;
