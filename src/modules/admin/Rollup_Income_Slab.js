'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Rollup_Income_Slab.cs (class Rollup_Income_SlabController => /admin/Rollup_Income_Slab/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { nStr, cvtInt, cvtDec, at, firstCol, str, col } = require('./_shared/batch12_common');
const { trimCaret } = require('./_shared/batch12D_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Rollup_Income_Slab';

/** class GetDirectIncomeSlab1 (this file) */
const SLAB_PROPS = ['Row', 'TKSMID', 'InvestmentFromSlot', 'InvestmentToSlot', 'ReferralIncomePercentage', 'Emp_Name', 'ActivityReport', 'NoOfDirectActiveMember'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Refferal-Income-Slab" -> Rollup_Income_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Refferal-Income-Slab'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // (unused @TotalCount output SqlParameter declared in legacy)
  const Count = firstCol(await db.query(DB, 'select count(payid) from payout'));
  ViewBag.Count = Count === null || Count === undefined ? 0 : Number(Count);
  let GetDirectIncome = mapRows(await db.query(DB,
    'select tksmid, investmentfromslot, investmenttoslot, referralincomepercentage, noofdirectactivemember from tbl_direct_income_slab where active = 1'), SLAB_PROPS);
  ViewBag.DirectIncome = GetDirectIncome;
  GetDirectIncome = mapRows(await db.proc(DB, 'Usp_DirectIncomeSlab', { Mode: 2 }), SLAB_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Rollup_Income_Slab/Index.cshtml', Model: GetDirectIncome, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateDirectIncome(string AlData, string AlDatas)
// auth (writes slab data; reads Session["Admin_User"].Emp_ID)
router.all(`/admin/${C}/UpdateDirectIncome{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let returnval = 1;
  let id = 0; let From = 0; let To = 0; let Percentage = 0; let NoOfDirectActiveMember = 0;
  // outside the try in legacy (null => NullReferenceException => 500)
  const AlData = trimCaret(nStr(req.p.AlData));
  const MainSpit = AlData.split('^');
  const AlDatas = trimCaret(nStr(req.p.AlDatas));
  const MainSpits = AlDatas.split('^');
  try {
    for (const MainItem of MainSpits) {
      const PartSplits = MainItem.split(',');
      if (PartSplits[0] !== '') {
        id = cvtInt(at(PartSplits, 0));
        From = cvtDec(at(PartSplits, 1));
        To = cvtDec(at(PartSplits, 2));
        Percentage = cvtDec(at(PartSplits, 3));
        NoOfDirectActiveMember = cvtInt(at(PartSplits, 4));
        const userids = req.user.emp_id;
        // legacy concatenated the values into the SQL text; parameterised here
        await db.exec(DB, `insert into tbl_direct_income_slab_history (investmentfromslot, investmenttoslot, referralincomepercentage, status, userid,
                             activityreport, noofdirectactivemember)
                           values (@From, @To, @Percentage, 1, @userids, fun_getcurrentdate(), @NoOfDirectActiveMember)`,
        { From, To, Percentage, userids, NoOfDirectActiveMember });
      }
    }
    for (const MainItems of MainSpit) {
      const PartSplit = MainItems.split(',');
      if (PartSplit[0] !== '') {
        id = cvtInt(at(PartSplit, 0));
        From = cvtDec(at(PartSplit, 1));
        To = cvtDec(at(PartSplit, 2));
        Percentage = cvtDec(at(PartSplit, 3));
        NoOfDirectActiveMember = cvtInt(at(PartSplit, 4));
        const userid = req.user.emp_id;
        const r = await db.procOne(DB, 'Usp_DirectIncomeSlab', {
          From, To, Percentage, id, Mode: 1, userid, NoOfDirectActiveMember,
        });
        const OutPutMessage = str(col(r, 'IntResult')); // eslint-disable-line no-unused-vars
      }
      returnval = 1;
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_DirectIncomeSlab');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

module.exports = router;
