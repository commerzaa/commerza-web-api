'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Conditional_Binary_Income_Slab.cs
// (namespace Common.Controllers.AdminPanel, class Conditional_Binary_Income_SlabController => /admin/Conditional_Binary_Income_Slab/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Conditional_Binary_Income_Slab';

/** class ConditionalBinary */
const CB_PROPS = ['TBISID', 'LeftVolume', 'RightVolume', 'MatchingVolume', 'Type', 'TypeDescription', 'Active', 'Status', 'Row', 'Emp_Name',
  'ActivityReport'];

/** string.Trim('^') */
const trimCaret = (s) => s.replace(/^\^+|\^+$/g, '');

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Conditional-Binary-Income-Slab" -> Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Conditional-Binary-Income-Slab'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Count = await db.scalar(DB, 'select count(payid) from payout', {});
  ViewBag.Count = Count === null ? 0 : Number(Count);
  const bt = await db.scalar(DB, "select limits from settings where caption = 'BinaryType' and active = 1 limit 1", {});
  ViewBag.BinaryType = bt === null ? 0 : Number(bt);
  const GetBinary = mapRows(await db.query(DB, `select tbisid, typedescription, leftvolume, rightvolume, matchingvolume, type, active, status
    from tbl_conditionalbinaryincomeslab`, {}), CB_PROPS);
  ViewBag.BinaryIncomeLevel = GetBinary;
  const BinarySlab1 = mapRows(await db.query(DB, `select row_number() over (order by bis.tblsid desc) as row, bis.typedescription, bis.leftvolume,
    bis.rightvolume, bis.matchingvolume, em.emp_name, bis.activityreport from tbl_conditionalbinaryincomeslabhistory bis
    left join tbl_employee_master em on bis.userid = em.emp_id order by bis.activityreport desc`, {}), CB_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Conditional_Binary_Income_Slab/Index.cshtml', Model: BinarySlab1, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateBinaryLevelIncomSlab(string AlData, string HAlData)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateBinaryLevelIncomSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AlData = B.nStr(req.p.AlData);
  let HAlData = B.nStr(req.p.HAlData);
  let returnval = 1;
  let id = 0;
  let Leftvolume = 0;
  let RightVoulme = 0;
  let MatchingVoulme = 0;
  let Description = '';
  if (AlData === null || HAlData === null) throw B.nullRef();
  AlData = trimCaret(AlData);
  HAlData = trimCaret(HAlData);
  const userid = req.user.emp_id;
  const MainSpit = AlData.split('^');
  const MHAlData = HAlData.split('^');
  let Pair = 0;
  try {
    for (const MainItem of MHAlData) {
      const Part = MainItem.split(',');
      if (Part[0] !== '') {
        id = B.cvtInt(B.at(Part, 0));
        Leftvolume = B.cvtDec(B.at(Part, 1));
        RightVoulme = B.cvtDec(B.at(Part, 2));
        MatchingVoulme = B.cvtDec(B.at(Part, 3));
        Description = B.at(Part, 4);
        // PORT-NOTE: legacy concatenated the values into the SQL (injection); parameterised here.
        await db.exec(DB, `insert into tbl_conditionalbinaryincomeslabhistory (leftvolume, rightvolume, matchingvolume, userid, status, activityreport, typedescription)
          values (@Leftvolume, @RightVoulme, @MatchingVoulme, @userid, 1, now(), @Description)`, { Leftvolume, RightVoulme, MatchingVoulme, userid, Description });
      }
    }
    for (const MainItems of MainSpit) {
      const PartSplit = MainItems.split(',');
      id = B.cvtInt(B.at(PartSplit, 0));
      Leftvolume = B.cvtDec(B.at(PartSplit, 1));
      RightVoulme = B.cvtDec(B.at(PartSplit, 2));
      MatchingVoulme = B.cvtDec(B.at(PartSplit, 3));
      Description = B.at(PartSplit, 4);
      // Db._TBL_ConditionalBINARY_INCOME_SLAB.Where(a => a.TBISID == id).FirstOrDefault()
      const Row = await db.queryOne(DB, 'select tbisid from tbl_conditionalbinaryincomeslab where tbisid = @id limit 1', { id });
      if (Row !== null) {
        returnval = await db.exec(DB, `update tbl_conditionalbinaryincomeslab set leftvolume = @Leftvolume, rightvolume = @RightVoulme,
          matchingvolume = @MatchingVoulme where tbisid = @id`, { Leftvolume, RightVoulme, MatchingVoulme, id });
        returnval = 1;
      } else {
        const pr = await db.scalar(DB, 'select coalesce(max(pair),0) from tbl_conditionalbinaryincomeslab', {});
        Pair = pr === null ? 0 : Number(pr);
        Pair += 1;
        await db.exec(DB, `insert into tbl_conditionalbinaryincomeslab (leftvolume, rightvolume, matchingvolume, type, status, pair, active, typedescription)
          values (@Leftvolume, @RightVoulme, @MatchingVoulme, 1, 1, @Pair, 1, @desc)`, { Leftvolume, RightVoulme, MatchingVoulme, Pair, desc: 'Pair' + Pair });
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateBinaryLevelIncomSlab');
    returnval = 0;
  }
  void Description;
  return res.json(String(returnval));
}));

// ---------------------------------------------------------------- JsonResult ChnageBinarytypestatus(int status)
// auth (admin setting write; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/ChnageBinarytypestatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const status = B.reqInt(req.p.status, 'status');
  let returnval = 0;
  if (status === 1) {
    await db.exec(DB, "update settings set limits = 2 where caption = 'BinaryType' and active = 1", {});
    returnval = 1;
  } else {
    // PORT-NOTE: legacy used CAPTION='BINARYTYPE' (SQL Server case-insensitive collation) - upper() comparison keeps that behaviour.
    await db.exec(DB, "update settings set limits = 1 where upper(caption) = 'BINARYTYPE' and active = 1", {});
    await db.exec(DB, 'delete from tbl_binary_income_slab where tbisid not in (1) and pair not in (1,2)', {});
    returnval = 1;
  }
  return res.json(String(returnval));
}));

module.exports = router;
