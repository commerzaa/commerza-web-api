'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_Branch.cs (class All_BranchController)
// Database: affiliate (Db_Affiliate). Table: tbl_branch_master (Branch_Master).
// PORT-NOTE: usp_All_Branch_List / usp_getBranchDataOnBRID / usp_UpdateBranch are not in the Db_Affiliate schema dump.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nint, nstr, reqInt, toInt32, outStr, col, view, mapRows, mapRow } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'All_Branch';

/** class AllBranchList */
const ALLBRANCHLIST_PROPS = ['rowNumber', 'BRID', 'BrCode', 'BrName', 'BranchHolder', 'ContactPerson', 'State', 'City', 'Mobile', 'SID', 'Landline',
  'Email', 'BrAddress', 'Pincode', 'status', 'createdate', 'password'];

const reqLong = (v, name) => {
  const n = v === undefined || v === null || v === '' ? NaN : Number(v);
  if (!Number.isInteger(n)) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int64'`);
    e.status = 500;
    throw e;
  }
  return n;
};

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/All-Branch" -> All_Branch/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/All-Branch'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  let page = nint(req.p.page);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_All_Branch_List', {
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(), ToDate: toDate.trim(),
  });
  const _AllBranchList = mapRows(rows, ALLBRANCHLIST_PROPS);
  const TotalRecord = toInt32(outStr(col(rows[0], 'totalcount')) || 'x'); // int.Parse(DBNull => "") => FormatException (no try in legacy)
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
  };
  return view(res, '~/Views/AdminPanel/All_Branch/Index.cshtml', _AllBranchList, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult getBranchData(Int64 BRID)
// auth (legacy had no session check; branch data incl. password => adminAuth)
router.all(`/admin/${C}/getBranchData{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const BRID = reqLong(req.p.BRID, 'BRID');
  const rows = await db.proc(DB, 'usp_getBranchDataOnBRID', { BRID });
  if (!rows.length) return res.type('application/json').send(''); // Json(null)
  return res.json(mapRow(rows[0], ALLBRANCHLIST_PROPS));
}));

// ---------------------------------------------------------------- JsonResult UpdateBranch(Int64 BRID, string contactPerson, string mobile, string landline, string Email, string BrName, string BrAddress, int SID, int CTID, string Pincode)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateBranch{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const BRID = reqLong(req.p.BRID, 'BRID');
  const SID = reqInt(req.p.SID, 'SID');
  const CTID = reqInt(req.p.CTID, 'CTID');
  const P = (k) => nstr(req.p[k]);
  const row = await db.procOne(DB, 'usp_UpdateBranch', {
    BRID, contactPerson: P('contactPerson'), mobile: P('mobile'), landline: P('landline'), Email: P('Email'), BrName: P('BrName'),
    BrAddress: P('BrAddress'), SID, CTID, Pincode: P('Pincode'),
  });
  const v = outStr(col(row, 'strresult')).trim(); // outparam.Value.ToString().Trim() (DBNull => "")
  if (v !== 'ok') return res.json(v);
  return res.json('ok');
}));

// ---------------------------------------------------------------- JsonResult enableDisableBranch(Int64 BRID, string text)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/enableDisableBranch{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const BRID = reqLong(req.p.BRID, 'BRID');
  const text = nstr(req.p.text);
  // db._Branch_Master (dbo.tbl_Branch_master).Where(b => b.BRID == BRID).FirstOrDefault()
  const BM = await db.queryOne(DB, 'select brid, active from tbl_branch_master where brid = @BRID limit 1', { BRID });
  if (!BM) return res.json('Branch does not exists');
  const Active = text !== 'Enable'; // "Enable" => Active = false (sic), else true
  // EF SaveChanges: UPDATE only when the value changes
  if (col(BM, 'active') !== Active) await db.exec(DB, 'update tbl_branch_master set active = @Active where brid = @BRID', { Active, BRID });
  return res.json('ok');
}));

module.exports = router;
