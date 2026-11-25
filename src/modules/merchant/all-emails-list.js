'use strict';
// Ported from Franchise\Controllers\CustomerPanel\AllEmailsList.cs (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const DAL_AllemailList = require('../../lib/merchant/DAL_AllemailList');

const router = express.Router();
const guard = [auth, requireType('merchant')];
const DB = 'shopping';
const P = '/merchant/AllEmailsList';
const COLS = ['RowNumber', 'TMCEMID', 'ShortEmail', 'FullEmail', 'Status', 'GROUPNAME', 'CREATEDATE', 'REMARK', 'ISACTIVE', 'EMAIL', 'NoofEmails'];
const bool = (v) => v === true || String(v).toLowerCase() === 'true';
const EXPIRED = 'error^This page has been expired, Please login again';

// auth
router.all(`${P}/Index{/:id}`, ...guard, asyncHandler(async (req, res) => {
  let { fromdate, todate, GroupName, page } = req.p;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (GroupName == null) GroupName = '';
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const Plid = Number(req.user.plid);
  const MaxRows = 20;
  const rows = await db.proc(DB, 'allmaillist', {
    PLID: Plid, FromDate: String(fromdate).trim(), ToDate: String(todate).trim(), GroupName: String(GroupName).trim(),
    STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  // PORT-NOTE: @IntResult OUT read from the 'intresult' column of the first row
  const TotalRecord = rows.length && rows[0].intresult != null ? Number(rows[0].intresult) : 0;
  const ObjGroupName = mapRows(await db.query(DB,
    'Select Distinct GroupName From tbl_member_customer_email Where plid = @plid', { plid: String(parseInt(req.user.plid, 10)) }), ['GroupName']);
  res.json({
    Model: mapRows(rows, COLS), CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    Status: GroupName, fromDate: fromdate, toDate: todate, GroupName: ObjGroupName, IsPopUpCheck: 1,
  });
}));

// auth
router.all(`${P}/ADDNEWEMAIL{/:id}`, ...guard, (req, res) => res.json({}));

// auth
router.all(`${P}/SAVE{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { EMAIL, GroupName } = req.p;
  const CHECK = bool(req.p.CHECK);
  let RESPONSE = '';
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await new DAL_AllemailList().Create(EMAIL, CHECK, Plid, GroupName);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

// auth
router.all(`${P}/Edit{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const TMCEMID = parseInt(req.p.TMCEMID, 10);
  const EMAIL = req.p.EMAIL;
  const row = await db.queryOne(DB, 'Select * from tbl_member_customer_email where tmcemid = @id', { id: TMCEMID });
  res.json({ TMCEMID, Email: EMAIL, Rowvalue: mapRow(row, COLS) });
}));

// auth
router.all(`${P}/MODIFY{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const TMCEMID = parseInt(req.p.TMCEMID, 10);
  const { EMAIL, OldEmail } = req.p;
  const CHECK = bool(req.p.CHECK);
  let RESPONSE = '';
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await new DAL_AllemailList().Modify(TMCEMID, EMAIL, CHECK, Plid, OldEmail);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

// auth
router.all(`${P}/Reject{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const TMCEMID = parseInt(req.p.TMCEMID, 10);
  const EMAIL = req.p.EMAIL;
  let RESPONSE = '';
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await new DAL_AllemailList().Reject(TMCEMID, EMAIL, Plid);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

// auth (legacy: no session check)
router.all(`${P}/Delete{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const TMCEMID = parseInt(req.p.TMCEMID, 10);
  const EMAIL = req.p.EMAIL;
  let RESPONSE = '';
  try {
    let UpdateEmail = '';
    const Obj = await db.queryOne(DB, 'Select EMAIL as FullEmail From tbl_member_customer_email Where tmcemid = @id', { id: TMCEMID });
    if (!Obj) throw new TypeError('Object reference not set to an instance of an object.');
    const Arr = String(Obj.fullemail).split(',');
    if (Arr.length > 1) {
      for (let i = 0; i < Arr.length; i++) {
        if (Arr[i] !== EMAIL) UpdateEmail += Arr[i] + ',';
      }
      UpdateEmail = UpdateEmail.replace(/,+$/, '');
      await db.exec(DB, 'Update tbl_member_customer_email Set email = @e Where tmcemid = @id', { e: UpdateEmail, id: TMCEMID });
    } else {
      await db.exec(DB, 'Update tbl_member_customer_email Set isactive = false, isdeleted = true Where tmcemid = @id', { id: TMCEMID });
    }
    RESPONSE = 'Successfully Deleted!';
  } catch (Exp) {
    console.error(Exp.message);
    return res.json('Some Error Occured!');
  }
  res.json(RESPONSE);
}));

// auth (legacy: no session check)
router.all(`${P}/DeleteOneCompleteRow{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const TMCEMID = parseInt(req.p.TMCEMID, 10);
  let result = '';
  try {
    const Res = await db.exec(DB, 'Update tbl_member_customer_email Set isactive = false, isdeleted = true Where tmcemid = @id', { id: TMCEMID });
    result = Res === 1 ? 'Group Data Successfully deleted.' : 'Some error occured.';
  } catch (Exp) {
    result = String(Exp.stack || Exp.message);
  }
  res.json(result);
}));

module.exports = router;
