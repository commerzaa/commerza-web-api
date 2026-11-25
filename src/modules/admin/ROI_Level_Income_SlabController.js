'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ROI_Level_Income_SlabController.cs
// (class Common.Controllers.AdminPanel.ROI_Level_Income_SlabController => /admin/ROI_Level_Income_Slab/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { nStr, cvtInt, cvtDec, at, firstCol } = require('./_shared/batch12_common');
const { trimCaret, chkInt32 } = require('./_shared/batch12D_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ROI_Level_Income_Slab';

/** class GROWTH_LEVEL_INCOME_SLAB1 (this file) */
const SLAB1_PROPS = ['Row', 'Title', 'Income', 'NoOfDownlineMember', 'Emp_Name', 'ActivityReport', 'selfAcitvaion', 'SelfInvestMents',
  'TotalLeftMember', 'TotalRightMember', 'ToSelfInvestment', 'DirectMember'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/ROI-Level-Income-Slab" -> ROI_Level_Income_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ROI-Level-Income-Slab'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Count = firstCol(await db.query(DB, 'select count(payid) from payout'));
  ViewBag.Count = Count === null || Count === undefined ? 0 : Number(Count);
  const Roi = mapRows(await db.query(DB,
    `select row_number() over (order by gli.glisid desc) as row, gli.title, gli.income, gli.noofdownlinemember, em.emp_name, gli.activityreport,
            gli.selfinvestments, gli.selfacitvaion, gli.totalleftmember, gli.totalrightmember, gli.toselfinvestment, gli.directmember
       from tbl_growth_level_income_slab_history gli left join tbl_employee_master em on gli.userid = em.emp_id
      order by gli.activityreport desc`), SLAB1_PROPS);
  return res.json({ view: '~/Views/AdminPanel/ROI_Level_Income_Slab/Index.cshtml', Model: Roi, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateGrowthLevelIncomSlab(string AlData, string AlDatas)
// auth (writes slab data; reads Session["Admin_User"].Emp_ID)
router.all(`/admin/${C}/UpdateGrowthLevelIncomSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let returnval = 1;
  let id = 0; let Income = 0; let NumberofMembers = 0; let level = 0; let Title = ''; let SelfActivation = 0;
  let SelfInvestMents = 0; let ToSelfInvestment = 0; let TotalLeftMember = 0; let TotalRightMember = 0; let DirectMember = 0;
  // outside the try in legacy (null => NullReferenceException => 500)
  const AlData = trimCaret(nStr(req.p.AlData));
  const MainSpit = AlData.split('^');
  const AlDatas = trimCaret(nStr(req.p.AlDatas));
  const MainSpits = AlDatas.split('^');
  try {
    const userid = req.user.emp_id;
    for (const MainItem of MainSpits) {
      const PartSplit = MainItem.split(',');
      if (PartSplit[0] !== '') {
        id = cvtInt(at(PartSplit, 0));
        Income = cvtDec(at(PartSplit, 1));
        NumberofMembers = cvtInt(at(PartSplit, 2));
        level = cvtInt(at(PartSplit, 3));
        Title = at(PartSplit, 4);
        SelfActivation = cvtInt(at(PartSplit, 5));
        SelfInvestMents = cvtDec(at(PartSplit, 6));
        TotalLeftMember = cvtInt(at(PartSplit, 7));
        TotalRightMember = cvtInt(at(PartSplit, 8));
        ToSelfInvestment = cvtDec(at(PartSplit, 9));
        DirectMember = cvtInt(at(PartSplit, 10));
        // legacy concatenated the values into the SQL text; parameterised here
        await db.exec(DB, `insert into tbl_growth_level_income_slab_history (level, income, noofdownlinemember, userid, activityreport, status, title,
                             selfinvestments, selfacitvaion, totalleftmember, totalrightmember, toselfinvestment, directmember)
                           values (@level, @Income, @NumberofMembers, @userid, now(), 1, @Title, @SelfInvestMents, @SelfActivation,
                             @TotalLeftMember, @TotalRightMember, @ToSelfInvestment, @DirectMember)`,
        { level, Income, NumberofMembers: chkInt32(NumberofMembers), userid, Title, SelfInvestMents, SelfActivation, TotalLeftMember, TotalRightMember, ToSelfInvestment, DirectMember });
      }
      for (const MainItems of MainSpit) {
        const PartSplits = MainItems.split(',');
        // PORT-NOTE: legacy tests the OUTER PartSplit[0] here (not PartSplits[0]); kept.
        if (PartSplit[0] !== '') {
          id = cvtInt(at(PartSplits, 0));
          Income = cvtDec(at(PartSplits, 1));
          NumberofMembers = cvtInt(at(PartSplits, 2));
          level = cvtInt(at(PartSplits, 3));
          Title = at(PartSplits, 4);
          SelfActivation = cvtInt(at(PartSplits, 5));
          SelfInvestMents = cvtDec(at(PartSplits, 6));
          TotalLeftMember = cvtInt(at(PartSplits, 7));
          TotalRightMember = cvtInt(at(PartSplits, 8));
          ToSelfInvestment = cvtDec(at(PartSplits, 9));
          DirectMember = cvtInt(at(PartSplits, 10));
          // Db._GROWTH_LEVEL_INCOME_SLAB.Where(a => a.GLISID == id).FirstOrDefault(); update + SaveChanges
          await db.exec(DB, `update growth_level_income_slab set income = @Income, noofdownlinemember = @NumberofMembers, level = @level,
                               selfactivation = @SelfActivation, selfinvestments = @SelfInvestMents, totalleftmember = @TotalLeftMember,
                               totalrightmember = @TotalRightMember, toselfinvestment = @ToSelfInvestment, directmember = @DirectMember
                             where glisid = @id`,
          { Income, NumberofMembers, level, SelfActivation, SelfInvestMents, TotalLeftMember, TotalRightMember, ToSelfInvestment, DirectMember, id });
          returnval = 1;
        }
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateGrowthLevelIncomSlab');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

module.exports = router;
