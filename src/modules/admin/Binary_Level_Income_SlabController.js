'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_Level_Income_SlabController.cs
// (namespace Common.Controllers.AdminPanel, class Binary_Level_Income_SlabController => /Binary_Level_Income_Slab/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, sv, nint, toInt32, toDecimal, nullRef } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Binary_Level_Income_Slab';

/** class Tbl_Binary_Level_Income_Slab1 */
const PROPS = ['Row', 'Title', 'Income', 'NoOfDownlineMember', 'ActivityReport', 'Emp_Name', 'TBLISID', 'LEVEL', 'Type', 'Status', 'GPV',
  'REFLISID', 'REFCOUNT', 'SelfInvestments', 'SelfActivation', 'DirectMember', 'ToSelfInvestment'];

const trimCaret = (s) => s.replace(/^\^+|\^+$/g, ''); // string.Trim('^')
const part = (arr, i) => { if (i >= arr.length) throw new Error('Index was outside the bounds of the array.'); return arr[i]; };

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)
// auth
// route-config: "AdminPanel/Binary-Level-Income-Slab" -> Binary_Level_Income_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Binary-Level-Income-Slab'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromdate = sv(req.p.fromdate);
  let todate = sv(req.p.todate);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  const ViewBag = {};
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  const MaxRows = Number(ddlcustpage);
  if (page === null) page = 1;
  // PORT-NOTE: legacy also added SqlParameter("@LEVELINCOMETYPE", 4) but the command text does not reference it (ignored by SQL Server) => not passed.
  const base = {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromdate.trim(), TODATE: todate.trim(),
  };
  const BinaryLevel = mapRows(await db.proc(DB, 'USP_BINARYLEVELINCOMESLAB', { ...base, MODE: 1 }), PROPS);
  ViewBag.BinaryIncomeLevel = BinaryLevel;
  const BinaryLevel1 = mapRows(await db.proc(DB, 'USP_BINARYLEVELINCOMESLAB', { ...base, MODE: 2 }), PROPS);
  return res.json({ view: '~/Views/AdminPanel/Binary_Level_Income_Slab/Index.cshtml', Model: BinaryLevel1, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateBinaryLevelIncome(string AlData, string AlDatas)
// auth (reads Session["Admin_User"]; legacy NullReference inside the try => "0")
router.all(`/admin/${C}/UpdateBinaryLevelIncome{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AlData = sv(req.p.AlData);
  let AlDatas = sv(req.p.AlDatas);
  let returnval = 1;
  if (AlData === null || AlDatas === null) nullRef();
  AlData = trimCaret(AlData);
  const MainSpit = AlData.split('^');
  AlDatas = trimCaret(AlDatas);
  const MainSpits = AlDatas.split('^');
  const parse = (PartSplit) => ({
    id: toInt32(part(PartSplit, 0)),
    Income: toDecimal(part(PartSplit, 1)),
    NumberofMembers: toInt32(part(PartSplit, 2)),
    Title: part(PartSplit, 3),
    level: toInt32(part(PartSplit, 4)),
    SelfInvestments: toDecimal(part(PartSplit, 5)),
    SelfActivation: toInt32(part(PartSplit, 6)),
    ToSelfInvestment: toDecimal(part(PartSplit, 7)),
    DirectMemeber: toInt32(part(PartSplit, 8)),
  });
  try {
    const userid = req.user.emp_id;
    for (const MainItems of MainSpits) {
      const p = parse(MainItems.split(','));
      // insert into Tbl_Binary_Level_Income_Slab_History(...) values(...)  (parameterised)
      await db.exec(DB, `insert into tbl_binary_level_income_slab_history (level, income, noofdownlinemember, userid, activityreport, status, title,
        selfinvestments, selfactivation, toselfinvestment, directmember) values (@level, @Income, @NumberofMembers, @userid, now(), 1, @Title,
        @SelfInvestments, @SelfActivation, @ToSelfInvestment, @DirectMemeber)`, { ...p, userid });
    }
    for (const MainItems of MainSpit) {
      const p = parse(MainItems.split(','));
      // Db._TBL_BINARYLevel_INCOME_SLAB.Where(a => a.TBLISID == id && a.Status == 1).FirstOrDefault() ... SaveChanges()
      const Row = await db.queryOne(DB, 'select tblisid from tbl_binary_level_income_slab where tblisid = @id and status = 1 limit 1', { id: p.id });
      if (Row) {
        await db.exec(DB, `update tbl_binary_level_income_slab set income = @Income, noofdownlinemember = @NumberofMembers,
          selfinvestments = @SelfInvestments, selfactivation = @SelfActivation, toselfinvestment = @ToSelfInvestment, directmember = @DirectMemeber
          where tblisid = @id`, p);
      }
    }
    returnval = 1;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateBinaryLevelIncome');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

module.exports = router;
