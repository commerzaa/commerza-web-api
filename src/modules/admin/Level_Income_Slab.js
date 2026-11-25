'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Level_Income_Slab.cs (class Level_Income_SlabController, no namespace => /Level_Income_Slab/...)
// Database: affiliate (Db_Affiliate). Tables: payout, tbl_level_income_slab_history, level_income_slab (EF _LEVEL_INCOME_SLAB).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nStr, at, cvtInt, cvtDec, nullRef } = require('./_shared/batch08_common');

const router = express.Router();
const C = 'Level_Income_Slab';

/** string.Trim('^') */
const trimCaret = (s) => s.replace(/^\^+|\^+$/g, '');

/** PartSplit (9 comma-separated values) => typed values, same conversions/order as the C# (FormatException / IndexOutOfRange on bad input). */
function parsePart(PartSplit) {
  const id = cvtInt(at(PartSplit, 0));
  const Income = cvtDec(at(PartSplit, 1));
  const NumberofMembers = cvtInt(at(PartSplit, 2));
  const level = cvtInt(at(PartSplit, 3));
  const Title = String(at(PartSplit, 4));
  const selfAcitvaion = cvtInt(at(PartSplit, 5));
  const SelfInvestments = cvtDec(at(PartSplit, 6));
  const ToSelfInvestment = cvtDec(at(PartSplit, 7));
  const DirectMember = cvtInt(at(PartSplit, 8));
  return { id, Income, NumberofMembers, level, Title, selfAcitvaion, SelfInvestments, ToSelfInvestment, DirectMember };
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Level-Income-Slab" -> Level_Income_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Level-Income-Slab'], adminAuth, asyncHandler(async (req, res) => {
  // select count(PAYID) from PAYOUT  (SqlQuery<Int32>().FirstOrDefault())
  const Count = Number(await db.scalar(DB, 'select count(payid) from payout', {})) || 0;
  return res.json({ view: '~/Views/AdminPanel/Level_Income_Slab/Index.cshtml', Count });
}));

// ---------------------------------------------------------------- JsonResult UpdateLevelIncomSlab(string AlData, string AlDatas)
// auth (reads Session["Admin_User"]; legacy: null session => NullReferenceException inside try => Json(ex.Message))
router.all(`/admin/${C}/UpdateLevelIncomSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AlData = nStr(req.p.AlData);
  let AlDatas = nStr(req.p.AlDatas);
  let returnval = 1;
  // AlData.Trim('^') / AlDatas.Trim('^') are outside the try: null => NullReferenceException => 500
  if (AlData === null) throw nullRef();
  AlData = trimCaret(AlData);
  const MainSpit = AlData.split('^');
  if (AlDatas === null) throw nullRef();
  AlDatas = trimCaret(AlDatas);
  const MainSpits = AlDatas.split('^');
  try {
    const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
    for (const MainItems of MainSpits) {
      const PartSplit = MainItems.split(',');
      if (PartSplit[0] !== '') {
        const v = parsePart(PartSplit);
        // PORT-NOTE: legacy concatenated the values (Title unescaped) into the INSERT; parameterised here.
        await db.exec(DB, `insert into tbl_level_income_slab_history(level, title, income, noofdownlinemember, selfacitvaion, selfinvestments, userid,
          directmember, toselfinvestment, status, activityreport) values (@level, @Title, @Income, @NumberofMembers, @selfAcitvaion, @SelfInvestments,
          @userid, @DirectMember, @ToSelfInvestment, 1, now())`, {
          level: v.level, Title: v.Title, Income: v.Income, NumberofMembers: v.NumberofMembers, selfAcitvaion: v.selfAcitvaion,
          SelfInvestments: v.SelfInvestments, userid, DirectMember: v.DirectMember, ToSelfInvestment: v.ToSelfInvestment,
        });
      }
    }
    for (const MainItems of MainSpit) {
      const PartSplit = MainItems.split(',');
      if (PartSplit[0] !== '') {
        const v = parsePart(PartSplit);
        // Db._LEVEL_INCOME_SLAB.Where(a => a.LISID == id).FirstOrDefault(); if found: set INCOME, NoOfDownlineMember, LEVEL, SelfActivation,
        // SelfInvestments, ToSelfInvestment, DirectMember; SaveChanges() (TITLE is NOT updated)
        returnval = await db.exec(DB, `update level_income_slab set income = @Income, noofdownlinemember = @NumberofMembers, level = @level,
          selfactivation = @selfAcitvaion, selfinvestments = @SelfInvestments, toselfinvestment = @ToSelfInvestment, directmember = @DirectMember
          where lisid = @id`, {
          Income: v.Income, NumberofMembers: v.NumberofMembers, level: v.level, selfAcitvaion: v.selfAcitvaion, SelfInvestments: v.SelfInvestments,
          ToSelfInvestment: v.ToSelfInvestment, DirectMember: v.DirectMember, id: v.id,
        });
      }
    }
    returnval = 1;
    return res.json(String(returnval));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateLevelIncomSlab');
    return res.json(String(ExpObj.message));
  }
}));

module.exports = router;
