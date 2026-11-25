'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Refferal_Income_Slab.cs (class Refferal_Income_SlabController => /admin/Refferal_Income_Slab/...)
// Database: affiliate (Db_Affiliate). Tables: PAYOUT, Tbl_Rollup_Income_Slab, Tbl_Rollup_Income_Slab_History. Proc: Usp_RollupIncomeSlab.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nStr, cvtInt, cvtDec, at, firstCol } = require('./_shared/batch12-common');
const { trimCaret } = require('./_shared/batch12-d-common');

const router = express.Router();
const C = 'Refferal_Income_Slab';

/** class GetRollupIncome1 */
const ROLLUP_PROPS = ['TRISID', 'Row', 'InvestmentFromSlot', 'InvestmentToSlot', 'RollupIncomePercentage', 'Emp_Name', 'ActivityReport',
  'NOOfRequiredMember', 'MinInvestMents'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Rollup-Income-Slab" -> Refferal_Income_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Rollup-Income-Slab{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // SqlQuery<Int32>("select count(PAYID) from PAYOUT").FirstOrDefault()
  const Count = Number(firstCol(await db.query(DB, 'select count(payid)::int as count from payout', {})) || 0);
  ViewBag.Count = Count;
  let GetRollupIncome = mapRows(await db.query(DB,
    'select trisid, investmentfromslot, investmenttoslot, rollupincomepercentage, noofrequiredmember, mininvestments from tbl_rollup_income_slab where active = 1',
    {}), ROLLUP_PROPS);
  ViewBag.RollupIncome = GetRollupIncome;
  // [Usp_RollupIncomeSlab] @Mode  with @Mode = 2
  // PORT-NOTE: the legacy call was POSITIONAL, so the value 2 was bound to the proc's FIRST parameter @From (and @Mode kept its default 1):
  // the proc ran its Mode-1 branch (UPDATE Tbl_Rollup_Income_Slab ... WHERE TRISID = 0) and returned no result set => empty Model.
  // Reproduced exactly (From = 2, Mode default).
  GetRollupIncome = mapRows(await db.proc(DB, 'Usp_RollupIncomeSlab', { From: 2 }), ROLLUP_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Refferal_Income_Slab/Index.cshtml', Model: GetRollupIncome, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateRollupSlab(string AlData, string AlDatas)
// auth (reads Session["Admin_User"].Emp_ID)
router.all(`/admin/${C}/UpdateRollupSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AlData = nStr(req.p.AlData);
  let AlDatas = nStr(req.p.AlDatas);
  let returnval = 1;
  let id = 0; let From = 0; let To = 0; let Percentage = 0; let NOOfRequiredMember = 0; let MinInvestMents = 0;
  AlDatas = trimCaret(AlDatas);
  if (AlData === null) throw new Error('Object reference not set to an instance of an object.');
  const MainSpits = AlData.split('^');
  AlData = trimCaret(AlData); // (unused afterwards, like the legacy code)
  const MainSpit = AlDatas.split('^');
  try {
    for (const MainItem of MainSpits) {
      const PartSplits = MainItem.split(',');
      if (PartSplits[0] !== '') {
        id = cvtInt(at(PartSplits, 0));
        From = cvtDec(at(PartSplits, 1));
        To = cvtDec(at(PartSplits, 2));
        Percentage = cvtDec(at(PartSplits, 3));
        NOOfRequiredMember = cvtInt(at(PartSplits, 4));
        MinInvestMents = cvtDec(at(PartSplits, 5));
        const userids = req.user.emp_id;
        await db.exec(DB, `insert into tbl_rollup_income_slab_history (investmentfromslot, investmenttoslot, rollupincomepercentage, status, userid,
            noofrequiredmember, mininvestments, activityreport)
          values (@From, @To, @Percentage, 1, @userids, @NOOfRequiredMember, @MinInvestMents, now())`,
        { From, To, Percentage, userids, NOOfRequiredMember, MinInvestMents });
      }
    }
    for (const MainItems of MainSpit) {
      const PartSplit = MainItems.split(',');
      if (PartSplit[0] !== '') {
        id = cvtInt(at(PartSplit, 0));
        From = cvtDec(at(PartSplit, 1));
        To = cvtDec(at(PartSplit, 2));
        Percentage = cvtDec(at(PartSplit, 3));
        NOOfRequiredMember = cvtInt(at(PartSplit, 4));
        MinInvestMents = cvtDec(at(PartSplit, 5));
        const userid = req.user.emp_id;
        // [Usp_RollupIncomeSlab] @From,@To,@Percentage,@id,@Mode,@userid,@NOOfRequiredMember,@MinInvestMents,@IntResult out
        const row = await db.procOne(DB, 'Usp_RollupIncomeSlab', {
          From, To, Percentage, id, Mode: 1, userid, NOOfRequiredMember, MinInvestMents,
        });
        void row; // string OutPutMessage = IntResult.Value.ToString(); (unused)
        returnval = 1;
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_RollupIncomeSlab');
    returnval = 0;
  }
  void id;
  return res.json(String(returnval));
}));

module.exports = router;
